import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(scriptsDirectory, "..");
export const courseConfigPath = path.join(projectRoot, "src/course-config.json");

export function loadCourseConfig() {
  const config = JSON.parse(readFileSync(courseConfigPath, "utf8"));
  const activeYear = Number(config.activeYear);
  const yearConfig = config.years?.[String(activeYear)];

  if (!Number.isInteger(activeYear) || !yearConfig) {
    throw new Error(
      "src/course-config.json must define an integer activeYear with a matching years entry.",
    );
  }

  return { config, activeYear, yearConfig };
}
