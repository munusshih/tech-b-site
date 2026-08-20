#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  courseConfigPath,
  loadCourseConfig,
  projectRoot,
} from "./course-config.js";

function fail(message) {
  console.error(`Year advance refused: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const positional = args.filter((arg) => !arg.startsWith("--"));
const unknownFlags = args.filter(
  (arg) => arg.startsWith("--") && arg !== "--confirm",
);

if (unknownFlags.length > 0) {
  fail(`unknown option(s): ${unknownFlags.join(", ")}.`);
}

if (positional.length !== 1 || !/^\d{4}$/.test(positional[0])) {
  fail("use `npm run year:advance -- 2027` (add `--confirm` to apply)." );
}

const targetYear = Number(positional[0]);
const { config, activeYear } = loadCourseConfig();
if (targetYear !== activeYear + 1) {
  fail(`target must be exactly ${activeYear + 1}; activeYear is ${activeYear}.`);
}
if (config.years[String(targetYear)]) {
  fail(`${targetYear} already exists in src/course-config.json.`);
}

const plannedFiles = [
  path.join("src/content/weeks", String(targetYear), ".gitkeep"),
  path.join("src/data", String(targetYear), "student-data.json"),
  path.join("src/data", String(targetYear), "student-bios.json"),
  path.join("public/student-files", String(targetYear), ".gitkeep"),
];

const targetDirectories = [
  path.join("src/content/weeks", String(targetYear)),
  path.join("src/data", String(targetYear)),
  path.join("public/student-files", String(targetYear)),
];

for (const relativePath of targetDirectories) {
  if (existsSync(path.join(projectRoot, relativePath))) {
    fail(`${relativePath} already exists; the target year must be absent.`);
  }
}

for (const relativePath of plannedFiles) {
  if (existsSync(path.join(projectRoot, relativePath))) {
    fail(`${relativePath} already exists.`);
  }
}

let dirtyStatus = "";
try {
  dirtyStatus = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    { cwd: projectRoot, encoding: "utf8" },
  ).trim();
} catch {
  fail("could not inspect the Git working tree.");
}

console.log(`Active year: ${activeYear}`);
console.log(`Target year: ${targetYear}`);
console.log("Planned files:");
for (const relativePath of plannedFiles) console.log(`  + ${relativePath}`);
console.log("  ~ src/course-config.json (add target, then set activeYear)");

if (!confirm) {
  console.log("\nDry run only; no files changed.");
  if (dirtyStatus) {
    console.log("The Git working tree is dirty; a confirmed run will refuse.");
  }
  console.log(
    `After committing current work, apply with: npm run year:advance -- ${targetYear} --confirm`,
  );
  process.exit(0);
}

if (dirtyStatus) {
  fail("commit or stash every tracked and untracked change before using --confirm.");
}

const nextYearConfig = {
  semester: `Fall ${targetYear}`,
  sectionId: "",
  meetingTimes: "",
  location: "",
  marqueeText: "",
  companionSiteUrl: "",
  syllabusUrl: "",
  officeHoursUrl: "",
  submissionLinks: {
    assignmentFormUrl: "",
    projectFormUrl: "",
    bioFormUrl: "",
  },
  sheets: {
    assignments: { id: "", name: "" },
    bios: { id: "", name: "" },
  },
  scheduleSections: [],
  specialProjectWeeks: {},
  students: [],
};

const files = new Map([
  [plannedFiles[0], ""],
  [plannedFiles[1], "[]\n"],
  [plannedFiles[2], "[]\n"],
  [plannedFiles[3], ""],
]);

for (const [relativePath, contents] of files) {
  const absolutePath = path.join(projectRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, { flag: "wx" });
}

config.years[String(targetYear)] = nextYearConfig;
config.activeYear = targetYear;
writeFileSync(courseConfigPath, `${JSON.stringify(config, null, 2)}\n`);

console.log(`\nAdvanced the active course from ${activeYear} to ${targetYear}.`);
console.log(`/${activeYear}/ is now a read-only archive; /${targetYear}/ redirects to /.`);
console.log("Edit the new year's configuration, then copy templates/week.md into its weeks directory before publishing.");
