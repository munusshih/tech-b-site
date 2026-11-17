/* global process, document, console, Event */
import assert from "node:assert/strict";
import puppeteer from "puppeteer";
import { modelQualityChecks } from "./model-quality.js";
const { quality, report } = modelQualityChecks();
const base = process.env.WORKSHOP_URL || "http://127.0.0.1:4321";
const browser = await puppeteer.launch({ headless: true });
function rgb(color) {
  return color
    .slice(1)
    .match(/../g)
    .map((value) => parseInt(value, 16));
}
function warm(color) {
  const [r, g, b] = rgb(color).map((value) => value / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  if (d < 0.1 || max < 0.15) return false;
  let hue =
    max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return hue < 70 || hue > 330;
}
try {
  const page = await browser.newPage();
  await page.goto(`${base}/week-12/llama/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    document.querySelector("#canvas-count").textContent.includes("colored"),
  );
  await page.click("#llama-find");
  await page.waitForFunction(
    () => !document.querySelector("#llama-model").disabled,
  );
  console.log("MODEL " + (await page.$eval("#llama-model", (el) => el.value)));
  if (process.env.WORKSHOP_MODEL)
    await page.select("#llama-model", process.env.WORKSHOP_MODEL);
  const marks = [];
  page.on("response", async (response) => {
    if (
      !response.url().endsWith("/v1/chat/completions") ||
      response.request().method() !== "POST"
    )
      return;
    try {
      const request = JSON.parse(response.request().postData());
      if (request.response_format?.json_schema?.name !== "poster_color") return;
      const data = await response.json(),
        mark = JSON.parse(data.choices[0].message.content);
      marks.push(mark);
      console.log(JSON.stringify(mark));
    } catch (error) {
      console.log("Response error: " + error.message);
    }
  });
  const cases = [
    "",
    "Use only red.",
    "Use only #123456.",
    "A quiet winter morning. No warm colors.",
    "Use #8e44ad for every sky area, #ffffff for every cloud, and #228b22 for mountains and mountain faces. Choose varied colors freely for the other objects.",
  ];
  const selected = process.env.WORKSHOP_COLOR_CASE
    ? cases.filter((brief) => brief.includes(process.env.WORKSHOP_COLOR_CASE))
    : cases;
  assert.ok(selected.length, "No matching art-direction cases");
  for (const brief of selected) {
    await page.click("#canvas-clear");
    await page.$eval(
      "#canvas-brief",
      (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      },
      brief,
    );
    const total = Number(
      (await page.$eval("#canvas-count", (el) => el.textContent)).match(
        /\/ (\d+)/,
      )[1],
    );
    console.log("RUN " + JSON.stringify(brief || "default"));
    await page.click("#canvas-toggle");
    await page.waitForFunction(
      () =>
        document.querySelector("#canvas-toggle").textContent ===
        "Start model coloring",
      { timeout: 240000 },
    );
    const last = JSON.parse(
      await page.$eval("#canvas-json", (el) => el.textContent),
    );
    const painted = {
      ...last.observation.coloredRegions,
      [last.mark.region]: last.mark.color,
    };
    const run = Object.entries(painted).map(([region, color]) => ({
      region,
      color,
    }));
    const status = await page.$eval("#canvas-status", (el) => el.textContent);
    console.log(
      "SUMMARY " +
        JSON.stringify({
          brief: brief || "default",
          count: run.length,
          unique: [...new Set(run.map((m) => m.color.toLowerCase()))],
          status,
        }),
    );
    assert.match(status, /Illustration colored/);
    assert.equal(run.length, total);
    if (!brief) {
      quality.ok(
        new Set(run.map((m) => m.color.toLowerCase())).size >= 8,
        "Default color variety",
      );
      for (const id of ["sky-upper", "sky-middle", "sky-lower"]) {
        const [r, g, b] = rgb(run.find((m) => m.region === id).color);
        quality.ok(b > r && b >= g, `Expected blue sky for ${id}`);
      }
    }
    if (brief === "Use only red.")
      quality.ok(
        run.every((m) => m.color.toLowerCase() === "#ff0000"),
        "Red-only direction",
      );
    if (brief === "Use only #123456.")
      quality.ok(
        run.every((m) => m.color.toLowerCase() === "#123456"),
        "Exact arbitrary RGB direction",
      );
    if (brief.includes("No warm colors"))
      quality.deepEqual(
        run.filter((m) => warm(m.color)),
        [],
        "Honor excluded warm colors",
      );
    if (brief.includes("every sky area")) {
      const freelyColored = run.filter(
        (mark) => !/^(sky-|cloud-|mountains$|peak-)/.test(mark.region),
      );
      quality.ok(
        new Set(freelyColored.map((mark) => mark.color.toLowerCase())).size >=
          4,
        "Unspecified objects retain creative color variety",
      );
      for (const mark of run) {
        if (mark.region.startsWith("sky-"))
          quality.equal(mark.color.toLowerCase(), "#8e44ad");
        if (mark.region.startsWith("cloud-"))
          quality.equal(mark.color.toLowerCase(), "#ffffff");
        if (mark.region === "mountains" || mark.region.startsWith("peak-"))
          quality.equal(mark.color.toLowerCase(), "#228b22");
      }
    }
  }
  await page.click('[data-bird-mode="llama"]');
  await page.click("#bird-ask");
  await page.waitForFunction(
    () =>
      document.querySelector("#bird-score").textContent !== "0" ||
      document.querySelector("#bird-status").textContent.includes("paused"),
    { timeout: 60000 },
  );
  console.log(
    "BIRD " + (await page.$eval("#bird-status", (el) => el.textContent)),
  );
  quality.ok(
    (await page.$eval("#bird-score", (el) => el.textContent)) !== "0",
    "The model should clear at least one pipe",
  );
  await page.click("#bird-ask");
  report();
  console.log(
    "PASS: selected illustrations completed. Model quality is reported separately.",
  );
} finally {
  await browser.close();
}
