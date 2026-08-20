#!/usr/bin/env node

import { loadCourseConfig } from "./course-config.js";

export function generateStudentId(firstName, lastName) {
  return `${firstName.toLowerCase()}-${lastName.toLowerCase()}`
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateStudentMapping() {
  const { yearConfig } = loadCourseConfig();
  return yearConfig.students.reduce((mapping, student) => {
    mapping[student.email] = generateStudentId(
      student.firstName,
      student.lastName,
    );
    return mapping;
  }, {});
}
