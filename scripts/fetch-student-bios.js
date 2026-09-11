#!/usr/bin/env node

import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { loadCourseConfig, projectRoot } from "./course-config.js";
import { generateStudentMapping } from "./student-mapping.js";
import { fetchOpenSheetRows } from "./opensheet.js";

async function getFetch() {
  if (typeof globalThis.fetch !== "undefined") return globalThis.fetch;
  const { default: nodeFetch } = await import("node-fetch");
  return nodeFetch;
}

export async function fetchStudentBios() {
  let outputPath;

  try {
    const { activeYear, yearConfig } = loadCourseConfig();
    const sheet = yearConfig.sheets.bios;
    if (!sheet.id.trim() || !sheet.name.trim()) {
      console.log(
        `Skipped bio sync: ${activeYear} has no bio sheet ID/name configured.`,
      );
      return { skipped: true, year: activeYear };
    }

    const apiUrl = `https://opensheet.elk.sh/${sheet.id}/${encodeURIComponent(sheet.name)}`;
    outputPath = path.join(
      projectRoot,
      "src/data",
      String(activeYear),
      "student-bios.json",
    );
    const studentEmailToId = generateStudentMapping();
    const fetchFn = await getFetch();

    console.log(`Fetching ${activeYear} student bios from Google Sheet...`);
    console.log(`API URL: ${apiUrl}`);
    console.log(
      `Found ${Object.keys(studentEmailToId).length} students in the active roster`,
    );

    const rawData = await fetchOpenSheetRows(fetchFn, apiUrl);
    const processedBios = rawData
      .map((row) => {
        const studentEmail = row["Email Address"];
        const mappedId = studentEmailToId[studentEmail];
        const fallbackId = studentEmail
          ? studentEmail
              .split("@")[0]
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "")
          : undefined;
        const links = [1, 2, 3]
          .map((number) => ({
            name: row[`Link ${number} Name`],
            url: row[`Link ${number} URL`],
          }))
          .filter((link) => link.name && link.url);

        return {
          timestamp: row.Timestamp,
          studentEmail,
          studentId: mappedId || fallbackId,
          bio: row["Your Bio (max 800 characters)"],
          links,
        };
      })
      .filter((entry) => entry.studentEmail && entry.bio);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(processedBios, null, 2));

    console.log(`Saved ${processedBios.length} student bios to ${outputPath}`);
    return { skipped: false, year: activeYear, count: processedBios.length };
  } catch (error) {
    if (process.env.VERCEL && outputPath && existsSync(outputPath)) {
      console.warn(
        `Bio sync unavailable after retries (${error.message}). Building with the committed student-bios snapshot.`,
      );
      return { skipped: true, stale: true, error };
    }

    console.error("Student bio sync failed:", error);
    process.exitCode = 1;
    return { error };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchStudentBios();
}
