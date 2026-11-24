// Live smoke run for lessons 1–10 against an actual local model.
import { lessons } from "../public/llm-playground/catalog.js";
import { writeFile } from "node:fs/promises";
const reportPath =
  process.env.MODEL_REPORT || "tests/results/gpt-oss-lessons-2026-11-24.json";
const report = {
  model: process.env.TEST_MODEL || "ggml-org/gpt-oss-20b-GGUF:MXFP4",
  scenarios: [],
};
for (const lesson of lessons) {
  const panels = [],
    trace = [];
  let memory = "";
  const start = Date.now();
  try {
    const { run } = await import(
      `../public/llm-playground/examples/${lesson.slug}.js`
    );
    const result = await run({
      base: process.env.MODEL_BASE || "http://127.0.0.1:9931",
      model: report.model,
      ...lesson.defaults,
      trace: (name, value) => trace.push({ name, value }),
      sources: (s) => panels.push(s),
      panel: (name, value) => panels.push({ name, value }),
      saveMemory: (s) => (memory = s),
      signal: AbortSignal.timeout(120000),
    });
    if (!result && !panels.length) throw Error("No result or panels");
    report.scenarios.push({
      name: lesson.slug,
      passed: true,
      seconds: (Date.now() - start) / 1000,
      result,
      panels,
      memory,
    });
    console.log("PASS", lesson.slug);
  } catch (e) {
    report.scenarios.push({
      name: lesson.slug,
      passed: false,
      error: e.message,
      trace,
    });
    console.log("FAIL", lesson.slug, e.message);
  }
  await writeFile(reportPath, JSON.stringify(report, null, 2));
}
report.passed = report.scenarios.every((s) => s.passed);
await writeFile(reportPath, JSON.stringify(report, null, 2));

if (!report.passed) process.exitCode = 1;
