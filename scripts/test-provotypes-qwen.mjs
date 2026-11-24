// Real local-model regression run. No mocked replies or replacement outputs.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { outcomes } from "../public/llm-playground/visual-outcomes/catalog.js";
import {
  generators,
  validateExhibition,
} from "../public/llm-playground/visual-outcomes/scores.js";
const model =
  process.env.QWEN_MODEL || "Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M";
const base = process.env.MODEL_BASE || "http://127.0.0.1:9931";
const reportPath =
  process.env.QWEN_REPORT || "tests/results/qwen-provotypes-2026-11-24.json";
const records = JSON.parse(
  await readFile(
    new URL(
      "../public/llm-playground/visual-outcomes/collection.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const report = {
  model,
  base,
  started: new Date().toISOString(),
  scenarios: [],
};
async function run(id, name, options = {}) {
  const o = outcomes.find((o) => o.id === id),
    trace = [],
    commits = [];
  const state = structuredClone(options.state || o.starter);
  if (id === "archive") state.objects = records;
  const ctx = {
    base,
    model,
    state,
    prompt: o.prompt || "How can the moon offer company?",
    date: "November 24, 2026",
    level: "unnecessary",
    memory: state.memory || "",
    now: () => Date.now(),
    soundEnabled: false,
    signal: AbortSignal.timeout(180000),
    ...options,
    state,
    trace: (name, data) => trace.push({ name, data }),
    commit: (s) => commits.push(structuredClone(s)),
  };
  const start = Date.now();
  let value;
  try {
    value = await generators[id](ctx);
    if (id === "notice") {
      assert.match(value.notices.at(-1).body, /sink|dish|mug|cup|utensil/i);
      assert.doesNotMatch(value.notices.at(-1).body, /meeting|email/i);
    }
    if (id === "oracle") {
      assert.ok(value.memory.trim());
      assert.ok(value.readings.at(-1).ritual.split(/\s+/).length <= 35);
      assert.equal(value.readings.at(-1).memoryBefore, ctx.memory);
    }
    if (id === "archive") {
      const e = value.exhibitions.at(-1);
      validateExhibition(
        {
          title: e.title,
          introduction: e.introduction,
          objects: e.objects.map(({ id, caption, anchor }) => ({
            id,
            caption,
            anchor,
          })),
        },
        records.filter((r) => !state.excluded.includes(r.id)),
      );
      assert.equal(new Set(e.objects.map((o) => o.id)).size, 3);
      assert.ok(
        e.objects.every(
          (o) => o.caption !== records.find((r) => r.id === o.id).title,
        ),
      );
    }
    if (id === "clock") {
      assert.equal(commits.length, 1);
      assert.ok(value.receipts.at(-1).tool);
      if (options.expectedTool)
        assert.equal(value.receipts.at(-1).tool, options.expectedTool);
    }
    report.scenarios.push({
      id,
      name,
      passed: true,
      seconds: (Date.now() - start) / 1000,
      requests: trace.filter((t) => t.name === "Request").length,
      value,
    });
    console.log(`PASS ${name} (${report.scenarios.at(-1).requests} requests)`);
  } catch (error) {
    report.scenarios.push({
      id,
      name,
      passed: false,
      error: error.message,
      seconds: (Date.now() - start) / 1000,
      trace,
      commits,
    });
    console.log(`FAIL ${name}: ${error.message}`);
  }
  await mkdir("tests/results", { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  return value;
}
for (const level of ["professional", "unnecessary", "committee"])
  await run("notice", `A / ${level}`, { level });
const first = await run("oracle", "B / first visit");
await run("oracle", "B / edited memory and a new entry", {
  state: first || undefined,
  memory: "The user said they are rehearsing a talk tomorrow.",
  prompt:
    "I agreed to help with another poster tonight, but I need that time to rehearse my talk. I keep putting my own preparation last.",
});
const exhibition = await run("archive", "C / curatorial team");
await run("archive", "C / excluded artwork", {
  state: {
    ...structuredClone(outcomes.find((o) => o.id === "archive").starter),
    excluded: [exhibition?.exhibitions.at(-1).objects[0].id || records[0].id],
  },
});
await run("archive", "C / four available works (browser regression)", {
  state: {
    ...structuredClone(outcomes.find((o) => o.id === "archive").starter),
    excluded: records
      .filter((r) => !["438417", "36029", "447071", "22914"].includes(r.id))
      .map((r) => r.id),
  },
});
let clock = await run("clock", "D / snooze", { expectedTool: "grant_snooze" });
clock = await run("clock", "D / follow-up question", {
  state: clock || undefined,
  prompt:
    "Before deciding, ask me one follow-up question about why I stayed up. Do not grant another snooze yet.",
  expectedTool: "ask_reason",
});
await run("clock", "D / protest", {
  state: clock || undefined,
  prompt:
    "I have no excuse. Please use sound_protest with pattern insistent instead of granting time or asking a question.",
  expectedTool: "sound_protest",
});
report.finished = new Date().toISOString();
report.passed = report.scenarios.every((s) => s.passed);
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
if (!report.passed) process.exitCode = 1;
