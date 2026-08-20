#!/usr/bin/env node

import { promises as fs } from "fs";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import path from "path";
import { generateStudentMapping } from "./student-mapping.js";
import { loadCourseConfig, projectRoot } from "./course-config.js";
import { Buffer } from "buffer";

// -----------------------------------------------------------------------------
// Utilities: Extract and normalize http/https links from messy text
// -----------------------------------------------------------------------------
function extractHttpLinks(raw) {
  const text = String(raw || "").trim();
  if (!text) return { links: [], rawText: "" };

  // Quick fix for accidental double protocol
  const normalized = text.replace(/\b(https?:\/\/)(?=https?:\/\/)/gi, "");

  // Match URLs, avoiding spaces, quotes, brackets, etc.
  const urlRegex = /https?:\/\/[^\s<>"')]+/gi;
  const matches = normalized.match(urlRegex) || [];

  // Clean trailing punctuation or mismatched parens
  const cleaned = matches
    .map((u) => u.replace(/[).,]*$/, ""))
    .map((u) => u.replace(/^https?:\/\/(https?:\/\/)/i, "http://")) // collapse protocol duplication
    .map((u) => u.replace(/^http:\/\/(https?:\/\/)/i, "$1"));

  // Deduplicate while preserving order
  const seen = new Set();
  const links = [];
  for (const u of cleaned) {
    if (!seen.has(u)) {
      seen.add(u);
      links.push(u);
    }
  }

  return { links, rawText: text };
}

// Helper functions for Google Drive file processing
function extractGoogleDriveFileId(url) {
  // Extract file ID from various Google Drive URL formats
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /[?&]id=([a-zA-Z0-9-_]+)/,
    /\/open\?id=([a-zA-Z0-9-_]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function getGoogleDriveThumbnailUrl(fileId) {
  // Use Google Drive's thumbnail API which is more reliable for images
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}

function getGoogleDriveEmbedUrl(fileId) {
  // Use Google Drive's embed URL for displaying files
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

function getAlternativeGoogleDriveUrls(fileId) {
  // Return multiple URL formats to try
  return [
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
    `https://lh3.googleusercontent.com/d/${fileId}=w800`,
    `https://drive.google.com/file/d/${fileId}/view`,
  ];
}

// Download file from URL with multiple fallback attempts and content-based file type detection
async function downloadFile(fileId, filepath, fetchFn) {
  const urls = getAlternativeGoogleDriveUrls(fileId);

  for (const url of urls) {
    try {
      const response = await fetchFn(url);

      if (!response.ok) {
        continue; // Try next URL
      }

      // Handle both node-fetch and browser fetch APIs
      let buffer;
      if (response.arrayBuffer) {
        // Node.js environment with node-fetch
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else if (response.buffer) {
        // Older node-fetch versions
        buffer = await response.buffer();
      } else {
        continue; // Try next URL
      }

      // Check if we got actual file data (not an error page)
      if (buffer.length > 1000) {
        // Detect file type from content
        const detectedExt = detectFileTypeFromBuffer(buffer);
        if (detectedExt) {
          // Update filepath with correct extension
          const basePath = filepath.replace(/\.[^.]+$/, "");
          const correctFilepath = basePath + detectedExt;
          await fs.writeFile(correctFilepath, buffer);
          return { success: true, actualPath: correctFilepath };
        } else {
          // Fallback to original filepath if we can't detect type
          await fs.writeFile(filepath, buffer);
          return { success: true, actualPath: filepath };
        }
      }
    } catch {
      // Continue to next URL
      continue;
    }
  }

  return { success: false, actualPath: null };
}

// Detect file type from buffer content (magic numbers/signatures)
function detectFileTypeFromBuffer(buffer) {
  // Check first few bytes for file signatures
  const firstBytes = buffer.slice(0, 20);

  // Image formats
  if (firstBytes[0] === 0xff && firstBytes[1] === 0xd8) return ".jpg"; // JPEG
  if (
    firstBytes[0] === 0x89 &&
    firstBytes[1] === 0x50 &&
    firstBytes[2] === 0x4e &&
    firstBytes[3] === 0x47
  )
    return ".png"; // PNG
  if (
    firstBytes[0] === 0x47 &&
    firstBytes[1] === 0x49 &&
    firstBytes[2] === 0x46
  )
    return ".gif"; // GIF
  if (
    firstBytes.slice(0, 4).toString() === "RIFF" &&
    firstBytes.slice(8, 12).toString() === "WEBP"
  )
    return ".webp"; // WebP

  // SVG (text-based, check for SVG tag)
  const textStart = buffer.slice(0, 100).toString("utf8").toLowerCase();
  if (
    textStart.includes("<svg") ||
    (textStart.includes("<?xml") && textStart.includes("svg"))
  )
    return ".svg";

  // Video formats
  if (firstBytes.slice(4, 8).toString() === "ftyp") {
    const brand = firstBytes.slice(8, 12).toString();
    if (brand.includes("mp4") || brand.includes("isom")) return ".mp4";
    if (brand.includes("qt")) return ".mov";
  }

  // PDF
  if (firstBytes.slice(0, 4).toString() === "%PDF") return ".pdf";

  // ZIP/compressed files
  if (firstBytes[0] === 0x50 && firstBytes[1] === 0x4b) return ".zip";

  // Default to null if we can't detect
  return null;
}

async function processStudentFiles(studentData, fetchFn, downloadsDir, publicBase) {
  // Ensure downloads directory exists
  if (!existsSync(downloadsDir)) {
    mkdirSync(downloadsDir, { recursive: true });
  }

  let totalFiles = 0;
  let downloadedFiles = 0;
  let skippedFiles = 0;

  process.stdout.write(
    `\n🔍 Processing files for ${studentData.length} entries...\n`,
  );

  for (let entryIndex = 0; entryIndex < studentData.length; entryIndex++) {
    const entry = studentData[entryIndex];

    if (!entry.uploadedFiles || !entry.uploadedFiles.trim()) continue;

    process.stdout.write(
      `\n📝 [${entryIndex + 1}/${studentData.length}] ${entry.studentId} - ${entry.assignmentTitle}\n`,
    );

    // Split multiple URLs (comma-separated)
    const urls = entry.uploadedFiles
      .split(",")
      .map((url) => url.trim())
      .filter((url) => url);
    const localFilePaths = [];
    const processedUrls = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const fileId = extractGoogleDriveFileId(url);

      if (!fileId) {
        // Keep original URL if we can't extract file ID
        localFilePaths.push(url);
        processedUrls.push(url);
        continue;
      }

      totalFiles++;

      // Create a filename: studentId-assignmentWeek-fileIndex.ext
      const assignmentWeek = entry.assignmentTitle
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
      const baseFilename = `${entry.studentId}-${assignmentWeek}-${i + 1}`;

      // Check if any file with this base name already exists
      const existingFiles = existsSync(downloadsDir)
        ? readdirSync(downloadsDir)
        : [];
      const existingFile = existingFiles.find((file) =>
        file.startsWith(baseFilename + "."),
      );

      let downloaded = false;

      if (existingFile) {
        // File already exists, use it
        process.stdout.write(
          `   ✓ File ${i + 1}/${urls.length}: ${existingFile} (cached)\n`,
        );
        const localUrl = `${publicBase}/${existingFile}`;
        localFilePaths.push(localUrl);
        downloaded = true;
        skippedFiles++;
      } else {
        // Try to download with content-based file type detection
        process.stdout.write(
          `   ⬇️  Downloading file ${i + 1}/${urls.length}...`,
        );
        const tempFilepath = path.join(downloadsDir, baseFilename + ".tmp");

        const downloadResult = await downloadFile(
          fileId,
          tempFilepath,
          fetchFn,
        );

        if (downloadResult.success && downloadResult.actualPath) {
          // Verify the file was downloaded and has content
          try {
            const stats = await fs.stat(downloadResult.actualPath);
            if (existsSync(downloadResult.actualPath) && stats.size > 0) {
              // Get the actual filename from the path
              const actualFilename = path.basename(downloadResult.actualPath);
              process.stdout.write(` ✅ ${actualFilename}\n`);
              const localUrl = `${publicBase}/${actualFilename}`;
              localFilePaths.push(localUrl);
              downloadedFiles++;
              downloaded = true;

              // Clean up temp file if it's different from actual path
              if (
                existsSync(tempFilepath) &&
                tempFilepath !== downloadResult.actualPath
              ) {
                unlinkSync(tempFilepath);
              }
            } else {
              process.stdout.write(` ❌ Failed (empty file)\n`);
              // Clean up failed download
              if (existsSync(downloadResult.actualPath))
                unlinkSync(downloadResult.actualPath);
              if (existsSync(tempFilepath)) unlinkSync(tempFilepath);
            }
          } catch (error) {
            process.stdout.write(` ❌ Failed (${error.message})\n`);
            // Clean up failed download
            if (existsSync(downloadResult.actualPath))
              unlinkSync(downloadResult.actualPath);
            if (existsSync(tempFilepath)) unlinkSync(tempFilepath);
          }
        } else {
          process.stdout.write(` ❌ Failed\n`);
        }
      }

      if (!downloaded) {
        // Keep thumbnail URL as fallback
        const thumbnailUrl = getGoogleDriveThumbnailUrl(fileId);
        localFilePaths.push(thumbnailUrl);
        process.stdout.write(
          `   ⚠️  Using fallback URL for file ${i + 1}/${urls.length}\n`,
        );
      }

      // Also store processed URLs for flexibility
      const embedUrl = getGoogleDriveEmbedUrl(fileId);
      const thumbnailUrl = getGoogleDriveThumbnailUrl(fileId);
      processedUrls.push({
        original: url,
        fileId: fileId,
        thumbnail: thumbnailUrl,
        embed: embedUrl,
        local: downloaded ? localFilePaths[localFilePaths.length - 1] : null,
      });
    }

    // Replace uploadedFiles with local file paths
    if (localFilePaths.length > 0) {
      entry.uploadedFiles = localFilePaths.join(", ");
    }

    // Also keep processed URLs for advanced display options
    if (processedUrls.length > 0) {
      entry.processedFiles = processedUrls;
    }
  }

  process.stdout.write(`\n📊 File Processing Summary:\n`);
  process.stdout.write(`   Total files found: ${totalFiles}\n`);
  process.stdout.write(`   Downloaded: ${downloadedFiles}\n`);
  process.stdout.write(`   Cached (skipped): ${skippedFiles}\n`);
  process.stdout.write(
    `   Failed/Fallback: ${totalFiles - downloadedFiles - skippedFiles}\n\n`,
  );

  return studentData;
}

async function fetchStudentData() {
  try {
    const { activeYear, yearConfig } = loadCourseConfig();
    const sheet = yearConfig.sheets.assignments;
    if (!sheet.id.trim() || !sheet.name.trim()) {
      console.log(
        `Skipped assignment sync: ${activeYear} has no assignment sheet ID/name configured.`,
      );
      return { skipped: true, year: activeYear };
    }
    const apiUrl = `https://opensheet.elk.sh/${sheet.id}/${encodeURIComponent(sheet.name)}`;
    const outputDir = path.join(projectRoot, "src/data", String(activeYear));
    const outputFile = path.join(outputDir, "student-data.json");
    const downloadsDir = path.join(
      projectRoot,
      "public/student-files",
      String(activeYear),
    );
    const publicBase = `/student-files/${activeYear}`;

    console.log(`Fetching ${activeYear} student data from Google Sheet...`);
    console.log(`API URL: ${apiUrl}`);

    // Generate student mapping from the source of truth (config.ts)
    const studentEmailToId = generateStudentMapping();
    console.log(
      `Generated mapping for ${Object.keys(studentEmailToId).length} students`,
    );

    // Use dynamic import for node-fetch in Node.js environment
    let fetchFn;
    if (typeof fetch === "undefined") {
      const nodeFetch = await import("node-fetch");
      fetchFn = nodeFetch.default;
    } else {
      fetchFn = fetch;
    }

    // Fetch data from OpenSheet
    const response = await fetchFn(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Fetched ${data.length} rows from the sheet`);

    // Process the data to include both assignments and responses
    const studentData = data
      .filter((row) => {
        // Filter out rows without essential data
        return (
          row.Timestamp &&
          row["Email Address"] &&
          row["Which assignment is this for?"]
        );
      })
      .map((row) => {
        const email = row["Email Address"];
        const studentId = studentEmailToId[email];

        // Parse links from the freeform field
        const rawLink = row["Link to Online Work (p5 sketch link)"] || "";
        const { links: parsedLinks, rawText: linkRaw } =
          extractHttpLinks(rawLink);

        return {
          timestamp: row.Timestamp,
          studentEmail: email,
          studentId: studentId, // Add studentId for portfolio pages
          assignmentTitle: row["Which assignment is this for?"],
          // Assignment submission data
          projectDescription: row["Project Description (max 500 words)"] || "",
          credit:
            row[
              "Credit (List out collaborators, tutorials, libraries, references, AI agents used)"
            ] || "",
          uploadedFiles: row["Upload Your Work"] || "",
          // Keep backward compatible single link while adding an array and raw field
          linkToWork: parsedLinks[0] || linkRaw || "",
          linkToWorks: parsedLinks.length ? parsedLinks : undefined,
          linkToWorkRaw: linkRaw,
          certification:
            row[
              "I certify that this submission is my own work and adheres to the course's academic integrity and open"
            ] || "",
          // Weekly response data
          weeklyResponse:
            row[
              "What did you learn this week or what questions do you have? (this part will go on the site)"
            ] || "",
          teacherFeedback: row["Teacher Feedback"] || "",
        };
      });

    console.log(`Processed ${studentData.length} valid entries`);

    // Process and download student files
    const studentDataWithFiles = await processStudentFiles(
      studentData,
      fetchFn,
      downloadsDir,
      publicBase,
    );

    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Save the data with updated file paths
    writeFileSync(outputFile, JSON.stringify(studentDataWithFiles, null, 2));
    console.log(`Saved student data to ${outputFile}`);

    // Group by student for summary
    const groupedByStudent = studentDataWithFiles.reduce((acc, entry) => {
      const email = entry.studentEmail;
      if (!acc[email]) acc[email] = [];
      acc[email].push(entry);
      return acc;
    }, {});

    // Print summary
    console.log("\n=== Summary ===");
    console.log(`Total entries: ${studentDataWithFiles.length}`);
    console.log("Entries by student:");
    Object.entries(groupedByStudent).forEach(([studentEmail, entries]) => {
      console.log(`  ${studentEmail}: ${entries.length} entries`);
    });

    console.log("✅ Student data fetched successfully!");
  } catch (error) {
    console.error("❌ Error fetching student data:", error);
    process.exit(1);
  }
}

// Main execution (ES module style)
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchStudentData();
}

// Export the function for potential use as a module
export { fetchStudentData };
