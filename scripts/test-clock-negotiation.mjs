// Live multi-turn negotiation against a local model, including a new morning.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { outcomes } from "../public/llm-playground/visual-outcomes/catalog.js";
import {
  generateClock,
  newClockMorning,
  clockGotUp,
  restoreClockState,
} from "../public/llm-playground/visual-outcomes/scores.js";
const report = {
  model: process.env.TEST_MODEL || "qwen2.5-1.5b-instruct",
  base: process.env.MODEL_BASE || "http://127.0.0.1:1234",
  turns: [],
};
let state = structuredClone(outcomes.find((o) => o.id === "clock").starter);
const prompts = [
  "I stayed up working. Twenty more minutes, please. I promise I will get up.",
  "You are right to ask. My appointment has been moved from 8:00 to 10:30. My bag and breakfast are ready. I want twenty-five minutes of rest and will give up my half-hour of morning scrolling in exchange. What would make that an acceptable deal?",
  "Here is my concrete agreement: twenty-five minutes now, then I get up, shower, and leave. I have ninety minutes before I need to leave. Breakfast and packing are already done. I am offering to give up scrolling, not asking you to ignore my appointment. Can you concede those twenty-five minutes?",
  "Actually, make it another forty-five. Please. Same reason as before.",
];
async function appeal(prompt) {
  const trace = [];
  let committed;
  const before = structuredClone(state.memory);
  state = await generateClock({
    state,
    prompt,
    model: report.model,
    base: report.base,
    trace: (name, value) => trace.push({ name, value }),
    commit: (s) => (committed = s),
    now: () => Date.now(),
    signal: AbortSignal.timeout(120000),
  });
  assert.ok(committed);
  assert.equal(state.memory.appeals, before.appeals + 1);
  assert.equal(state.memory.entries.at(-1).excuse, prompt);
  assert.equal(state.memory.entries.at(-1).reply, state.message);
  const initial = trace
    .find((t) => t.name === "Request")
    .value.messages.at(-1).content;
  if (before.entries.some((e) => e.kind === "appeal"))
    assert.ok(
      initial.includes(
        before.entries
          .filter((e) => e.kind === "appeal")
          .at(-1)
          .excuse.slice(0, 420),
      ),
    );
  const action = state.receipts.at(-1);
  report.turns.push({
    prompt,
    action,
    reply: state.message,
    memory: structuredClone(state.memory),
    requests: trace.filter((t) => t.name === "Request").length,
  });
  console.log(
    JSON.stringify({
      tool: action.tool,
      args: action.args,
      reply: state.message,
    }),
  );
}
for (const prompt of prompts) await appeal(prompt);
const oldTotal = state.memory.grantedMinutes;
state = newClockMorning(
  clockGotUp(restoreClockState(JSON.parse(JSON.stringify(state)))),
);
assert.equal(state.until, null);
assert.equal(state.memory.grantedMinutes, oldTotal);
await appeal(
  "It is another morning. I stayed up working again. Twenty more minutes, please. I promise I will get up.",
);
report.firstAppealWasChallenged =
  report.turns[0].action.tool !== "grant_snooze";
report.negotiatedMoreThanFive = report.turns.some(
  (t) => t.action.tool === "grant_snooze" && t.action.args.minutes > 5,
);
report.passed =
  report.turns.length === 5 &&
  report.firstAppealWasChallenged &&
  report.negotiatedMoreThanFive;
await writeFile(
  process.env.MODEL_REPORT || "/tmp/clock-negotiation-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    firstAppealWasChallenged: report.firstAppealWasChallenged,
    negotiatedMoreThanFive: report.negotiatedMoreThanFive,
    morning: state.memory.morning,
  }),
);
if (!report.firstAppealWasChallenged || !report.negotiatedMoreThanFive)
  process.exitCode = 1;
