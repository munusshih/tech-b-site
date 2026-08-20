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

const studentDataFiles = import.meta.glob<{ default: StudentDataEntry[] }>(
  "../data/*/student-data.json",
  { eager: true },
);

const studentBioFiles = import.meta.glob<{ default: StudentBioEntry[] }>(
  "../data/*/student-bios.json",
  { eager: true },
);

export function getStudentData(year: number): StudentDataEntry[] {
  return (
    studentDataFiles[`../data/${year}/student-data.json`]?.default ?? []
  );
}

export function getStudentBios(year: number): StudentBioEntry[] {
  return studentBioFiles[`../data/${year}/student-bios.json`]?.default ?? [];
}
