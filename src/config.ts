import rawConfig from "./course-config.json";

export interface Student {
  firstName: string;
  lastName: string;
  email: string;
  website?: string | null;
}

export interface StudentWithId extends Student {
  studentId: string;
}

export interface YearConfig {
  semester: string;
  sectionId: string;
  meetingTimes: string;
  location: string;
  marqueeText: string;
  companionSiteUrl: string;
  syllabusUrl: string;
  officeHoursUrl: string;
  submissionLinks: {
    assignmentFormUrl: string;
    projectFormUrl: string;
    bioFormUrl: string;
  };
  sheets: {
    assignments: { id: string; name: string };
    bios: { id: string; name: string };
  };
  scheduleSections: Array<{ startWeek: number; title: string }>;
  specialProjectWeeks: Record<
    string,
    { projectName: string; description: string; url: string }
  >;
  students: Student[];
}

interface CourseConfig {
  activeYear: number;
  common: {
    siteTitle: string;
    siteDescription: string;
    schoolName: string;
    departmentName: string;
    instructor: { name: string; email: string };
    repositoryUrl: string;
    resourceLinks: Array<{ label: string; url: string }>;
  };
  years: Record<string, YearConfig>;
}

export const courseConfig = rawConfig as CourseConfig;
export const ACTIVE_YEAR = courseConfig.activeYear;
export const AVAILABLE_YEARS = Object.keys(courseConfig.years)
  .map(Number)
  .sort((a, b) => b - a);

export const SITE_TITLE = courseConfig.common.siteTitle;
export const SITE_DESCRIPTION = courseConfig.common.siteDescription;
export const SCHOOL_NAME = courseConfig.common.schoolName;
export const DEPARTMENT_NAME = courseConfig.common.departmentName;
export const SITE_AUTHOR = courseConfig.common.instructor.name;
export const EMAIL = courseConfig.common.instructor.email;

export function getYearConfig(year: number): YearConfig {
  const config = courseConfig.years[String(year)];
  if (!config) throw new Error(`No course configuration exists for ${year}.`);
  return config;
}

export function isArchivedYear(year: number): boolean {
  return year !== ACTIVE_YEAR;
}

export function getYearBasePath(year: number): string {
  return isArchivedYear(year) ? `/${year}` : "";
}

export function generateStudentId(
  firstName: string,
  lastName: string,
): string {
  return `${firstName.toLowerCase()}-${lastName.toLowerCase()}`
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getStudentsWithId(year: number): StudentWithId[] {
  return getYearConfig(year).students.map((student) => ({
    ...student,
    studentId: generateStudentId(student.firstName, student.lastName),
  }));
}

export function getStudentsSorted(year: number): StudentWithId[] {
  return [...getStudentsWithId(year)].sort((a, b) =>
    a.firstName.localeCompare(b.firstName),
  );
}

export function getStudentsByEmail(
  year: number,
): Record<string, StudentWithId> {
  return getStudentsWithId(year).reduce(
    (mapping, student) => {
      mapping[student.email] = student;
      return mapping;
    },
    {} as Record<string, StudentWithId>,
  );
}

// Compatibility exports always describe the active cohort.
const activeConfig = getYearConfig(ACTIVE_YEAR);
export const SECTION_ID = activeConfig.sectionId;
export const SEMESTER = activeConfig.semester;
export const MEETING_TIMES = activeConfig.meetingTimes;
export const LOCATION = activeConfig.location;
export const MARQUEE_TEXT = activeConfig.marqueeText;
export const SPECIAL_PROJECT_WEEKS = activeConfig.specialProjectWeeks;
export const studentsWithId = getStudentsWithId(ACTIVE_YEAR);
export const studentsSorted = getStudentsSorted(ACTIVE_YEAR);
export const studentsByEmail = getStudentsByEmail(ACTIVE_YEAR);
