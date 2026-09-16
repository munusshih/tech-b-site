export interface StudentDataEntry {
  timestamp?: string;
  studentEmail?: string;
  studentId?: string;
  assignmentTitle?: string;
  weeklyResponse?: string;
  teacherFeedback?: string;
  [key: string]: unknown;
}

export interface StudentBioEntry {
  timestamp?: string;
  studentEmail?: string;
  studentId?: string;
  bio?: string;
  links?: Array<{ name: string; url: string }>;
}

const assignmentWeekPattern = /\b(?:week|assignment)\s*[-#:]?\s*(\d+)\b/i;

export function getAssignmentWeek(
  assignmentTitle?: string | null,
): number | null {
  const match = assignmentTitle?.match(assignmentWeekPattern);
  if (!match) return null;

  const week = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(week) && week > 0 ? week : null;
}

const studentDataFiles = import.meta.glob<{ default: StudentDataEntry[] }>(
  "../data/*/student-data.json",
  { eager: true },
);

const studentBioFiles = import.meta.glob<{ default: StudentBioEntry[] }>(
  "../data/*/student-bios.json",
  { eager: true },
);

export function getStudentData(year: number): StudentDataEntry[] {
  return studentDataFiles[`../data/${year}/student-data.json`]?.default ?? [];
}

function normalizeStudentEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? "";
}

export function getStudentDataByEmail(
  year: number,
  studentEmail: string,
  fallbackStudentId?: string,
): StudentDataEntry[] {
  const targetEmail = normalizeStudentEmail(studentEmail);

  return getStudentData(year).filter((entry) => {
    const entryEmail = normalizeStudentEmail(entry.studentEmail);
    if (targetEmail && entryEmail) return entryEmail === targetEmail;

    return Boolean(fallbackStudentId && entry.studentId === fallbackStudentId);
  });
}

export function getStudentBios(year: number): StudentBioEntry[] {
  return studentBioFiles[`../data/${year}/student-bios.json`]?.default ?? [];
}

export function getStudentBioByEmail(
  year: number,
  studentEmail: string,
  fallbackStudentId?: string,
): StudentBioEntry | undefined {
  const targetEmail = normalizeStudentEmail(studentEmail);

  return getStudentBios(year).find((bio) => {
    const bioEmail = normalizeStudentEmail(bio.studentEmail);
    if (targetEmail && bioEmail) return bioEmail === targetEmail;

    return Boolean(fallbackStudentId && bio.studentId === fallbackStudentId);
  });
}
