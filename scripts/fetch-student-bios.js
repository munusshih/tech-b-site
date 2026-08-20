#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { loadCourseConfig, projectRoot } from "./course-config.js";
import { generateStudentMapping } from "./student-mapping.js";

async function getFetch() {
  if (typeof globalThis.fetch !== "undefined") return globalThis.fetch;
  const { default: nodeFetch } = await import("node-fetch");
  return nodeFetch;
}

export async function fetchStudentBios() {
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
    const studentEmailToId = generateStudentMapping();
    const fetchFn = await getFetch();

    console.log(`Fetching ${activeYear} student bios from Google Sheet...`);
    console.log(`API URL: ${apiUrl}`);
    console.log(
      `Found ${Object.keys(studentEmailToId).length} students in the active roster`,
    );

    const response = await fetchFn(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData = await response.json();
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

    const outputPath = path.join(
      projectRoot,
      "src/data",
      String(activeYear),
      "student-bios.json",
    );
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(processedBios, null, 2));

    console.log(`Saved ${processedBios.length} student bios to ${outputPath}`);
    return { skipped: false, year: activeYear, count: processedBios.length };
  } catch (error) {
    console.error("Student bio sync failed:", error);
    process.exitCode = 1;
    return { error };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchStudentBios();
}
