/* global process, document, console, Event */
import assert from "node:assert/strict";

// Fail if a requested model is absent: page.select alone can silently select none.
export async function connectModel(page) {
  if (process.env.WORKSHOP_ENDPOINT) {
    await page.$eval(
      "#llama-runtime-address",
      (el, address) => {
        el.value = address;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      },
      process.env.WORKSHOP_ENDPOINT,
    );
  }
  await page.click("#llama-find");
  await page.waitForFunction(
    () => !document.querySelector("#llama-model").disabled,
  );
  if (process.env.WORKSHOP_MODEL) {
    const selected = await page.select(
      "#llama-model",
      process.env.WORKSHOP_MODEL,
    );
    assert.deepEqual(
      selected,
      [process.env.WORKSHOP_MODEL],
      "Requested model must be installed",
    );
  }
  console.log("MODEL " + (await page.$eval("#llama-model", (el) => el.value)));
}

export function measureModel(page) {
  const started = new WeakMap();
  const samples = [];
  page.on("request", (request) => {
    if (
      request.url().endsWith("/v1/chat/completions") &&
      request.method() === "POST"
    )
      started.set(request, Date.now());
  });
  page.on("response", async (response) => {
    const start = started.get(response.request());
    if (!start) return;
    try {
      const request = JSON.parse(response.request().postData());
      const data = await response.json();
      samples.push({
        exercise: request.tools
          ? "tools"
          : request.response_format
            ? "coloring"
            : "dialogue",
        ms: Date.now() - start,
        status: response.status(),
        tokens: data.usage?.completion_tokens ?? 0,
        tokensPerSecond: data.timings?.predicted_per_second,
        reasoning: Boolean(data.choices?.[0]?.message?.reasoning_content),
        maxTokens: request.max_tokens,
        thinkingBudget: request.thinking_budget_tokens ?? 0,
        truncated: data.choices?.[0]?.finish_reason === "length",
      });
    } catch {
      /* Functional assertions report failed responses. */
    }
  });
  return () => {
    for (const exercise of ["dialogue", "coloring", "tools"]) {
      const group = samples.filter((sample) => sample.exercise === exercise);
      if (!group.length) continue;
      const times = group.map((sample) => sample.ms).sort((a, b) => a - b);
      const speeds = group
        .map((sample) => sample.tokensPerSecond)
        .filter(Number.isFinite);
      console.log(
        "PERFORMANCE " +
          JSON.stringify({
            exercise,
            requests: group.length,
            medianMs: times[Math.floor(times.length / 2)],
            p95Ms:
              times[
                Math.min(times.length - 1, Math.floor(times.length * 0.95))
              ],
            meanTokensPerSecond: speeds.length
              ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length)
              : null,
            reasoningResponses: group.filter((sample) => sample.reasoning)
              .length,
            budgets: [
              ...new Set(
                group.map(
                  (sample) =>
                    `${sample.maxTokens} total / ${sample.thinkingBudget} thinking`,
                ),
              ),
            ],
            truncated: group.filter((sample) => sample.truncated).length,
            httpErrors: group.filter((sample) => sample.status >= 400).length,
          }),
      );
    }
  };
}
