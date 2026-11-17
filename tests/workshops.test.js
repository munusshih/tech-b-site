/* global process, fetch, document, Event, DataTransfer, File, MouseEvent, window */
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer";
import { grammarHtml, markovHtml } from "../src/scripts/generator-export.js";
import {
  llamaSetup,
  llamaStarters,
} from "../src/lib/llama-workshop-starters.js";

const base = process.env.WORKSHOP_URL || "http://127.0.0.1:4322";
let server, browser;
const errors = [];
before(async () => {
  if (!process.env.WORKSHOP_URL) {
    server = spawn(
      "npm",
      ["run", "preview", "--", "--host", "127.0.0.1", "--port", "4322"],
      { stdio: "ignore", detached: true },
    );
    for (let i = 0; i < 100; i++) {
      if (
        await fetch(base)
          .then((r) => r.ok)
          .catch(() => false)
      )
        break;
      await delay(200);
    }
  }
  browser = await puppeteer.launch({ headless: true });
});
after(async () => {
  await browser?.close();
  if (server) process.kill(-server.pid, "SIGTERM");
});
async function pageAt(workshop) {
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/week-12/${workshop}/`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => {
    if (document.querySelector("#training-status"))
      return document
        .querySelector("#training-status")
        .textContent.includes("Trained");
    if (document.querySelector("#grammar-weight-rule"))
      return document.querySelector("#grammar-weight-rule").children.length > 0;
    return document
      .querySelector("#canvas-count")
      ?.textContent.includes("colored");
  });
  return page;
}
async function set(page, selector, value, event = "input") {
  await page.$eval(
    selector,
    (el, { value, event }) => {
      el.value = value;
      el.dispatchEvent(new Event(event, { bubbles: true }));
    },
    { value, event },
  );
}
const text = (page, selector) => page.$eval(selector, (el) => el.textContent);
const disabled = (page, selector) => page.$eval(selector, (el) => el.disabled);
async function submit(page, selector) {
  await page.$eval(selector, (el) => el.requestSubmit());
}
async function connect(page) {
  await page.click("#llama-find");
  await page.waitForFunction(
    () => !document.querySelector("#llama-model").disabled,
  );
}
async function mockModel(
  page,
  handler,
  catalog = [{ id: "test-model" }, { id: "other-model" }],
) {
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    if (!/^http:\/\/127\.0\.0\.1:(9931|11434)/.test(request.url()))
      return request.continue();
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "*",
    };
    if (request.method() === "OPTIONS")
      return request.respond({ status: 204, headers });
    if (request.url().endsWith("/models"))
      return request.respond({
        headers,
        contentType: "application/json",
        body: JSON.stringify({
          data: catalog,
        }),
      });
    const body = JSON.parse(request.postData());
    try {
      const result = await handler(body);
      await request.respond({
        headers,
        contentType: "application/json",
        body: JSON.stringify(result),
      });
    } catch {
      await request.abort().catch(() => {});
    }
  });
}
const reply = (content) => ({
  choices: [{ message: { content }, finish_reason: "stop" }],
});

test("Markov: all sources and n-grams generate; edits, unknown contexts, empty/short input recover", async () => {
  const page = await pageAt("markov");
  assert.match(await text(page, "#training-status"), /Trained/);
  for (let source = 0; source < 5; source++) {
    await page.click(`[name="source-preset"][value="${source}"]`);
    await page.click("#replace-source");
    for (let n = 2; n <= 6; n++) {
      await page.click(`[name="ngram"][value="${n}"]`);
      assert.equal(await disabled(page, "#generate-sentence"), true);
      await submit(page, "#training");
      assert.match(await text(page, "#training-status"), /Trained/);
      await page.click("#generate-sentence");
      assert.match(await text(page, "#draft-status"), /Added a sentence/);
    }
  }
  await page.click("#generate-article");
  assert.match(await text(page, "#draft-status"), /three paragraphs/);
  await set(page, "#context", "a_phrase_that_does_not_exist_123");
  assert.match(await text(page, "#prediction-status"), /No next token/);
  for (const corpus of ["", "hello", "!!!"]) {
    await set(page, "#corpus", corpus);
    await submit(page, "#training");
    assert.equal(await disabled(page, "#generate-sentence"), true);
    assert.match(await text(page, "#training-status"), /more words/);
  }
  await page.click('[name="ngram"][value="2"]');
  await set(
    page,
    "#corpus",
    "The robot paints red. The robot paints blue. The artist paints green. The artist paints gold.",
  );
  await submit(page, "#training");
  for (let i = 0; i < 5; i++) await page.click("#generate-sentence");
  assert.match(await text(page, "#draft-status"), /Added a sentence/);
  await set(page, "#context", "The robot paints");
  assert.ok((await page.$$eval("#probabilities li", (els) => els.length)) > 0);
  await page.click("#add-source");
  assert.equal(await disabled(page, "#generate-sentence"), true);
  await page.close();
});

test("Markov: file uploads, oversize/invalid files, export and script escaping", async () => {
  const page = await pageAt("markov");
  async function upload(name, content) {
    await page.$eval(
      "#source-file",
      (el, { name, content }) => {
        const data = new DataTransfer();
        data.items.add(new File([content], name));
        el.files = data.files;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { name, content },
    );
    await delay(100);
  }
  await upload("custom.txt", "A robot paints. A robot sings. A bird sings.");
  assert.match(await text(page, "#source-status"), /Loaded custom.txt/);
  await upload("wrong.exe", "oops");
  assert.match(await text(page, "#source-status"), /Choose a .txt or .md/);
  await upload("huge.txt", "a".repeat(200001));
  assert.match(await text(page, "#source-status"), /50,000/);
  await page.click("[data-view-html]");
  assert.ok(
    (await page.$eval("[data-html-source]", (el) => el.value)).includes(
      "A robot paints",
    ),
  );
  for (const html of [
    markovHtml("</script><script>alert(1)</script>", 2),
    grammarHtml({ start: "</script>" }),
  ]) {
    assert.equal((html.match(/<script/g) || []).length, 1);
    assert.ok(html.includes("\\u003c/script>"));
  }
  await page.close();
});

test("Grammar: every preset, weights, custom rules, errors, limits and switch protection", async () => {
  const page = await pageAt("grammar");
  for (let i = 0; i < 4; i++) {
    await page.click(`[data-grammar-preset="${i}"]`);
    await page.click('button[name="count"][value="5"]');
    assert.equal(
      await page.$$eval("#grammar-results li", (els) => els.length),
      5,
    );
    assert.match(await text(page, "#grammar-output-status"), /five variations/);
  }
  await set(page, "#grammar-start", "My custom $NP.");
  await page.click('[data-grammar-preset="0"]');
  assert.equal(await page.$eval("#grammar-switch", (el) => el.hidden), false);
  await page.click("#grammar-switch-cancel");
  assert.equal(
    await page.$eval("#grammar-start", (el) => el.value),
    "My custom $NP.",
  );
  await page.click('[data-grammar-preset="0"]');
  await page.click("#grammar-switch-confirm");
  await set(page, "#grammar-start", "$NP $VP.");
  await set(
    page,
    "[data-rule]:nth-child(1) [data-choices]",
    "A dancing robot\nA purple comet",
  );
  await page.click('button[name="count"][value="5"]');
  assert.ok(
    (await text(page, "#grammar-results")).includes("robot") ||
      (await text(page, "#grammar-results")).includes("comet"),
  );
  await set(page, "#grammar-weight-list input", "9");
  assert.ok((await text(page, "#grammar-weight-list")).includes("%"));
  for (const [value, pattern] of [
    ["$MISSING", /Add a rule named/],
    ["$start", /refers back/],
    ["", /start rule/],
    ["[bad]", /plain text/],
  ]) {
    await set(page, "#grammar-start", value);
    await submit(page, "#grammar-form");
    assert.match(await text(page, "#grammar-status"), pattern);
  }
  await set(page, "#grammar-start", "$NP $VP.");
  await set(page, "[data-rule]:nth-child(2) [data-name]", "NP");
  await submit(page, "#grammar-form");
  assert.match(await text(page, "#grammar-status"), /already a rule/);
  await set(page, "[data-rule]:nth-child(2) [data-name]", "VP");
  await set(page, "[data-rule]:nth-child(2) [data-choices]", "runs (0)");
  await submit(page, "#grammar-form");
  assert.match(await text(page, "#grammar-status"), /whole-number weight/);
  await set(page, "[data-rule]:nth-child(2) [data-choices]", "runs\ndances");
  await submit(page, "#grammar-form");
  assert.match(await text(page, "#grammar-output-status"), /one result/);
  for (let i = 0; i < 10; i++) await page.click("#grammar-add");
  assert.equal(await disabled(page, "#grammar-add"), true);
  await page.click("[data-rule]:last-child [data-remove]");
  assert.equal(await disabled(page, "#grammar-add"), false);
  await page.close();
});

test("Role chat: edited/custom roles reset context, persist across selection, cancel/error/reset/model change", async () => {
  const page = await pageAt("llama");
  let pending;
  const requests = [];
  await mockModel(page, async (body) => {
    requests.push(body);
    return pending ? await pending : reply("In-character response.");
  });
  await connect(page);
  await set(page, "#llama-user", "Hello");
  await submit(page, "#llama-chat-form");
  await page.waitForFunction(
    () => document.querySelectorAll("#llama-chat-log li").length === 2,
  );
  await set(page, "#llama-system", "You are a botanist. Speak only Spanish.");
  assert.equal(await page.$$eval("#llama-chat-log li", (els) => els.length), 0);
  await set(page, "#llama-user", "What grows here?");
  await submit(page, "#llama-chat-form");
  await page.waitForFunction(
    () => document.querySelectorAll("#llama-chat-log li").length === 2,
  );
  assert.equal(requests.at(-1).messages.length, 2);
  assert.match(requests.at(-1).messages.at(-1).content, /Speak only Spanish/);
  await page.select("#llama-persona", "Custom role");
  assert.equal(await disabled(page, "#llama-send"), true);
  await set(page, "#llama-system", "You are a robot poet.");
  await page.select("#llama-persona", "Pirate captain");
  await page.select("#llama-persona", "Custom role");
  assert.equal(
    await page.$eval("#llama-system", (el) => el.value),
    "You are a robot poet.",
  );
  let resolve;
  pending = new Promise((r) => (resolve = r));
  await set(page, "#llama-user", "Wait");
  await submit(page, "#llama-chat-form");
  await page.click("#llama-cancel");
  resolve(reply("Late reply"));
  pending = undefined;
  await page.waitForFunction(
    () =>
      document.querySelector("#llama-chat-status").textContent ===
      "Reply stopped.",
  );
  assert.equal(await page.$$eval("#llama-chat-log li", (els) => els.length), 0);
  pending = Promise.resolve(reply(""));
  await submit(page, "#llama-chat-form");
  await page.waitForFunction(() =>
    document
      .querySelector("#llama-chat-status")
      .textContent.includes("empty reply"),
  );
  pending = undefined;
  await set(page, "#llama-user", "Try again");
  await submit(page, "#llama-chat-form");
  await page.waitForFunction(
    () => document.querySelectorAll("#llama-chat-log li").length === 2,
  );
  await page.click("#llama-chat-reset");
  assert.equal(await page.$$eval("#llama-chat-log li", (els) => els.length), 0);
  pending = new Promise((r) => (resolve = r));
  await set(page, "#llama-user", "Change model");
  await submit(page, "#llama-chat-form");
  await page.select("#llama-model", "other-model");
  resolve(reply("Stale"));
  pending = undefined;
  assert.match(await text(page, "#llama-chat-status"), /Model changed/);
  assert.equal(await page.$$eval("#llama-chat-log li", (els) => els.length), 0);
  await page.close();
});

test("Stage: eight turns, correct role each turn, edits stop stale requests, empty custom pair blocked", async () => {
  const page = await pageAt("llama");
  const requests = [];
  let pending;
  await mockModel(page, async (body) => {
    requests.push(body);
    return pending ? await pending : reply(`Observation ${requests.length}.`);
  });
  await connect(page);
  await page.click("#stage-toggle");
  await page.waitForFunction(
    () =>
      document.querySelector("#stage-status").textContent ===
      "Conversation complete.",
    { timeout: 15000 },
  );
  assert.equal(await page.$$eval("#stage-dialogue li", (els) => els.length), 8);
  requests.forEach((body, i) => {
    assert.match(
      body.messages.at(-1).content,
      i % 2 === 0 ? /You play ONLY Detective/ : /You play ONLY Suspect/,
    );
    assert.match(body.messages.at(-1).content, /Active role instructions/);
    for (let j = 2; j < body.messages.length; j++)
      assert.notEqual(body.messages[j].role, body.messages[j - 1].role);
  });
  await page.click("#stage-reset");
  let resolve;
  pending = new Promise((r) => (resolve = r));
  await page.click("#stage-toggle");
  await set(page, "[data-actor] textarea", "You are a poet. Speak Spanish.");
  resolve(reply("Stale line"));
  pending = undefined;
  await delay(100);
  assert.equal(await page.$$eval("#stage-dialogue li", (els) => els.length), 0);
  await page.select("#stage-preset", "Custom pair");
  assert.equal(await disabled(page, "#stage-toggle"), true);
  await set(
    page,
    "[data-actor]:nth-child(1) textarea",
    "You are a custom poet.",
  );
  await set(
    page,
    "[data-actor]:nth-child(2) textarea",
    "You are a custom musician.",
  );
  await set(page, "#stage-direction", "An underwater theater.");
  await page.select("#stage-preset", "Detective and suspect");
  await page.select("#stage-preset", "Custom pair");
  assert.equal(
    await page.$eval("[data-actor]:nth-child(1) textarea", (el) => el.value),
    "You are a custom poet.",
  );
  assert.equal(
    await page.$eval("#stage-direction", (el) => el.value),
    "An underwater theater.",
  );
  await page.close();
});

test("Coloring: full RGB schema, invalid output, custom direction edits, reset and human painting race", async () => {
  const page = await pageAt("llama");
  let pending,
    invalid = true;
  const requests = [];
  await mockModel(page, async (body) => {
    requests.push(body);
    if (pending) return await pending;
    const region =
      body.response_format.json_schema.schema.properties.region.enum[0];
    return reply(
      JSON.stringify({ region, color: invalid ? "not-a-color" : "#123456" }),
    );
  });
  await connect(page);
  await page.click("#canvas-toggle");
  await page.waitForFunction(() =>
    document.querySelector("#canvas-status").textContent.includes("paused"),
  );
  assert.match(
    await text(page, "#canvas-status"),
    /available region and color/,
  );
  assert.equal(
    requests[0].response_format.json_schema.schema.properties.color.enum,
    undefined,
  );
  invalid = false;
  let resolve;
  pending = new Promise((r) => (resolve = r));
  await page.click("#canvas-toggle");
  await set(page, "#canvas-brief", "Only red");
  resolve(reply('{"region":"sky-upper","color":"#123456"}'));
  pending = undefined;
  await delay(100);
  assert.match(await text(page, "#canvas-count"), /^0 \/ /);
  assert.match(await text(page, "#canvas-status"), /Art direction changed/);
  pending = new Promise((r) => (resolve = r));
  await page.click("#canvas-toggle");
  // Paint upper sky while the model is choosing a color for it.
  await page.$eval("#llama-canvas canvas", (el) => {
    const rect = el.getBoundingClientRect();
    el.dispatchEvent(
      new MouseEvent("click", {
        clientX: rect.left + (300 / 720) * rect.width,
        clientY: rect.top + (40 / 480) * rect.height,
      }),
    );
  });
  resolve(reply('{"region":"sky-upper","color":"#123456"}'));
  pending = undefined;
  await page.waitForFunction(() =>
    document
      .querySelector("#canvas-status")
      .textContent.includes("Kept your color"),
  );
  await page.click("#canvas-toggle");
  assert.match(await text(page, "#canvas-count"), /^1 \/ /);
  await page.click("#canvas-clear");
  assert.match(await text(page, "#canvas-count"), /^0 \/ /);
  await page.close();
});

test("Bird: arcade, pause/resume/reset, valid and invalid model tools, recovery and model switching", async () => {
  const page = await pageAt("llama");
  let valid = false;
  await mockModel(page, async (body) =>
    valid
      ? {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: "move_bird",
                      arguments: JSON.stringify({
                        action: JSON.parse(
                          body.messages[1].content.split("safe: ")[1],
                        ).suggestedAction,
                      }),
                    },
                  },
                ],
              },
            },
          ],
        }
      : reply("not a tool"),
  );
  await page.click("#bird-stage-control");
  assert.match(await text(page, "#bird-status"), /Flying/);
  await page.click("#bird-pause");
  assert.match(await text(page, "#bird-status"), /paused/);
  await page.click("#bird-pause");
  assert.match(await text(page, "#bird-status"), /Flying/);
  await page.click("#bird-reset");
  assert.equal(await text(page, "#bird-score"), "0");
  await page.click('[data-bird-mode="llama"]');
  assert.equal(await disabled(page, "#bird-ask"), true);
  await connect(page);
  await page.click("#bird-ask");
  await page.waitForFunction(() =>
    document.querySelector("#bird-status").textContent.includes("paused"),
  );
  assert.match(await text(page, "#bird-status"), /valid move_bird/);
  valid = true;
  await page.click("#bird-ask");
  await page.waitForFunction(
    () => document.querySelectorAll("#bird-flight-log li").length >= 2,
  );
  await page.select("#llama-model", "other-model");
  assert.match(await text(page, "#bird-status"), /paused/);
  await page.click("#bird-reset");
  assert.equal(
    await page.$$eval("#bird-flight-log li", (els) => els.length),
    0,
  );
  await page.close();
});

test("Coloring: agent fills every region and the human can repaint the finished illustration", async () => {
  const page = await pageAt("llama");
  let count = 0;
  await mockModel(page, async (body) =>
    reply(
      JSON.stringify({
        region:
          body.response_format.json_schema.schema.properties.region.enum[0],
        color:
          "#" + ((++count * 170111) % 0xffffff).toString(16).padStart(6, "0"),
      }),
    ),
  );
  await connect(page);
  await page.evaluate(() => {
    const schedule = window.setTimeout;
    window.setTimeout = (fn, ms, ...args) =>
      schedule(fn, ms === 700 ? 0 : ms, ...args);
  });
  const total = Number(
    (await text(page, "#canvas-count")).match(/\/ (\d+)/)[1],
  );
  await page.click("#canvas-toggle");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#canvas-status")
        .textContent.includes("Illustration colored"),
    { timeout: 15000 },
  );
  assert.equal(count, total);
  assert.equal(
    await text(page, "#canvas-count"),
    `${total} / ${total} colored`,
  );
  assert.equal(await disabled(page, "#canvas-toggle"), true);
  await page.$eval("#llama-canvas canvas", (el) => {
    const r = el.getBoundingClientRect();
    el.dispatchEvent(
      new MouseEvent("click", {
        clientX: r.left + (300 / 720) * r.width,
        clientY: r.top + (40 / 480) * r.height,
      }),
    );
  });
  assert.deepEqual(
    await page.$eval("#llama-canvas canvas", (el) =>
      Array.from(el.getContext("2d").getImageData(300, 40, 1, 1).data),
    ),
    [242, 138, 181, 255],
  );
  await page.close();
});

test("Grammar: custom added rules, invalid weights and names, recursion and expansion limits recover", async () => {
  const page = await pageAt("grammar");
  await page.click("#grammar-add");
  await set(page, "[data-rule]:last-child [data-name]", "PLACE");
  await set(
    page,
    "[data-rule]:last-child [data-choices]",
    "on Mars\nin the sea",
  );
  await set(page, "#grammar-start", "$NP $VP $PLACE.");
  await submit(page, "#grammar-form");
  assert.match(await text(page, "#grammar-results"), /Mars|sea/);
  for (const name of ["constructor", "__proto__", "bad-name", ""]) {
    await set(page, "[data-rule]:last-child [data-name]", name);
    await submit(page, "#grammar-form");
    assert.match(await text(page, "#grammar-status"), /name that starts/);
  }
  await set(page, "[data-rule]:last-child [data-name]", "PLACE");
  for (const choices of ["word (1.5)", "word (-1)", "word (1000)", ""]) {
    await set(page, "[data-rule]:last-child [data-choices]", choices);
    await submit(page, "#grammar-form");
    assert.match(await text(page, "#grammar-status"), /weight|alternative/);
  }
  await set(page, "[data-rule]:last-child [data-choices]", "$NP");
  await set(page, "[data-rule]:first-child [data-choices]", "$PLACE");
  await submit(page, "#grammar-form");
  assert.match(await text(page, "#grammar-status"), /refers back/);
  await set(page, "[data-rule]:first-child [data-choices]", "a".repeat(1000));
  await set(page, "#grammar-start", "$NP ".repeat(10));
  await submit(page, "#grammar-form");
  assert.match(await text(page, "#grammar-status"), /more than 4000/);
  await set(page, "#grammar-start", "$NP");
  await submit(page, "#grammar-form");
  assert.match(await text(page, "#grammar-output-status"), /one result/);
  await page.close();
});

test("Exports: standalone HTML runs custom Markov and grammar generators, probabilities and variations", async () => {
  for (const [kind, html] of [
    ["markov", markovHtml("A cat sleeps. A cat dances. A cat sings.", 2)],
    [
      "grammar",
      grammarHtml({
        start: "$animal.capitalize $verb.",
        animal: "cat | fox",
        verb: "sleeps | dances",
      }),
    ],
  ]) {
    const page = await browser.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent(html);
    await page.waitForFunction(() => Boolean(window.textGenerator));
    assert.ok(
      (await page.evaluate(
        () => window.textGenerator.generateSentence().length,
      )) > 0,
    );
    if (kind === "markov") {
      assert.ok(
        (
          await page.evaluate(() => window.textGenerator.generateArticle())
        ).split("\n\n").length === 3,
      );
      assert.ok(
        Math.abs(
          (await page.evaluate(() => window.textGenerator.entropy("cat"))) -
            Math.log2(3),
        ) < 0.001,
      );
      assert.equal(
        await page.evaluate(() => window.textGenerator.entropy("unknown")),
        null,
      );
    } else {
      const variants = await page.evaluate(() =>
        window.textGenerator.generateVariations(20),
      );
      assert.equal(variants.length, 20);
      assert.ok(new Set(variants).size >= 2);
      variants.forEach((line) =>
        assert.match(line, /^(Cat|Fox) (sleeps|dances)\.$/),
      );
    }
    await page.close();
  }
});

test("Optional controls: chat sampling, multiline input, runtime switch and Ollama tool envelope", async () => {
  const page = await pageAt("llama");
  const requests = [];
  await mockModel(page, async (body) => {
    requests.push(body);
    if (body.tools) {
      assert.equal(body.thinking_budget_tokens, undefined);
      const observation = JSON.parse(
        body.messages[1].content.split("safe: ")[1],
      );
      return reply(
        JSON.stringify({
          name: "move_bird",
          arguments: { action: observation.suggestedAction },
        }),
      );
    }
    return reply("A short custom reply.");
  });
  await connect(page);
  await set(page, "#llama-temperature", "1.2");
  await set(page, "#llama-top-p", "0.5");
  await set(page, "#llama-limit", "64");
  await set(page, "#llama-user", "line one\nline two");
  await submit(page, "#llama-chat-form");
  await page.waitForFunction(
    () => document.querySelectorAll("#llama-chat-log li").length === 2,
  );
  assert.equal(requests[0].temperature, 1.2);
  assert.equal(requests[0].top_p, 0.5);
  assert.equal(requests[0].max_tokens - requests[0].thinking_budget_tokens, 64);
  assert.ok(
    requests[0].messages.at(-1).content.includes("line one\\nline two"),
  );
  const count = requests.length;
  await set(page, "#llama-user", "   ");
  await submit(page, "#llama-chat-form");
  assert.equal(requests.length, count);
  await page.select("#llama-runtime", "ollama");
  assert.equal(await disabled(page, "#llama-send"), true);
  assert.match(await text(page, "#llama-runtime-address"), /11434/);
  await connect(page);
  await page.click('[data-bird-mode="llama"]');
  await page.click("#bird-ask");
  await page.waitForFunction(
    () => document.querySelectorAll("#bird-flight-log li").length >= 2,
  );
  await page.click("#bird-ask");
  assert.match(await text(page, "#bird-status"), /paused/);
  await page.close();
});

test("Optional exports: both download buttons create working HTML and source updates after edits", async () => {
  const directory = await mkdtemp(join(tmpdir(), "workshop-downloads-"));
  const session = await browser.target().createCDPSession();
  await session.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: directory,
  });
  try {
    for (const kind of ["markov", "grammar"]) {
      const page = await pageAt(kind);
      await page.click("[data-view-html]");
      if (kind === "markov")
        await set(
          page,
          "#corpus",
          "A silver fox waits. A silver fox dances. A golden bird dances.",
        );
      else await set(page, "#grammar-start", "Custom prefix: $NP $VP.");
      const source = await page.$eval("[data-html-source]", (el) => el.value);
      assert.ok(
        source.includes(kind === "markov" ? "silver fox" : "Custom prefix"),
      );
      await page.click("[data-download-html]");
      const filename = `rita-${kind}.html`;
      for (let i = 0; i < 60; i++) {
        if ((await readdir(directory)).includes(filename)) break;
        await delay(50);
      }
      assert.equal(await readFile(join(directory, filename), "utf8"), source);
      assert.match(await text(page, "[data-export-status]"), /Downloaded/);
      await page.close();
    }
  } finally {
    await session.send("Browser.setDownloadBehavior", { behavior: "default" });
    await session.detach();
    await rm(directory, { recursive: true, force: true });
  }
});

test("Reasoning models: chat, speakers, coloring and tools receive final output within short limits", async () => {
  const page = await pageAt("llama");
  const exercises = new Set();
  await mockModel(
    page,
    async (body) => {
      // Model the GPT-OSS failure: thinking consumes the entire output budget.
      if (body.thinking_budget_tokens !== 0)
        return {
          choices: [
            {
              message: { content: "", reasoning_content: "Still thinking..." },
              finish_reason: "length",
            },
          ],
        };
      if (body.tools) {
        exercises.add("tools");
        return {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      name: "move_bird",
                      arguments: '{"action":"flap"}',
                    },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
        };
      }
      if (body.response_format) {
        exercises.add("coloring");
        const region =
          body.response_format.json_schema.schema.properties.region.enum[0];
        return reply(JSON.stringify({ region, color: "#123456" }));
      }
      exercises.add(
        body.messages.at(-1).content.includes("You play ONLY")
          ? "speakers"
          : "chat",
      );
      return reply("A final spoken answer.");
    },
    [{ id: "unfamiliar-model", meta: { n_params: 20e9 } }],
  );
  await connect(page);
  await set(page, "#llama-user", "Hello");
  await submit(page, "#llama-chat-form");
  await page.waitForFunction(
    () => document.querySelectorAll("#llama-chat-log li").length === 2,
  );
  await page.click("#stage-toggle");
  await page.waitForFunction(
    () => document.querySelectorAll("#stage-dialogue li").length > 0,
  );
  await page.click("#stage-toggle");
  await page.click("#canvas-toggle");
  await page.waitForFunction(
    () =>
      !document.querySelector("#canvas-count").textContent.startsWith("0 /"),
  );
  await page.click("#canvas-toggle");
  await page.click('[data-bird-mode="llama"]');
  await page.click("#bird-ask");
  await page.waitForFunction(
    () => document.querySelectorAll("#bird-flight-log li").length > 0,
  );
  await page.click("#bird-ask");
  assert.deepEqual([...exercises].sort(), [
    "chat",
    "coloring",
    "speakers",
    "tools",
  ]);
  await page.close();
});

test("Copyable starters run with small, large and unrecognized model catalogs", async () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const parameters of [1.7e9, 20e9, undefined]) {
    for (const starter of llamaStarters) {
      const requests = [];
      const localFetch = async (url, options) => {
        if (url.endsWith("/models"))
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  id: "student-selected-model",
                  meta: { n_params: parameters },
                },
              ],
            }),
          };
        const body = JSON.parse(options.body);
        requests.push(body);
        const message = body.tools
          ? {
              tool_calls: [
                {
                  function: {
                    name: "move_bird",
                    arguments: '{"action":"flap"}',
                  },
                },
              ],
            }
          : {
              content: body.response_format
                ? '{"region":"area-1","color":"#123456"}'
                : "A complete reply.",
            };
        return { ok: true, json: async () => ({ choices: [{ message }] }) };
      };
      await new AsyncFunction(
        "fetch",
        "console",
        llamaSetup + "\n" + starter.code,
      )(localFetch, { log() {} });
      assert.ok(requests.length > 0, starter.title);
      for (const request of requests) {
        assert.equal(request.model, "student-selected-model");
        assert.ok(request.max_tokens > request.thinking_budget_tokens);
        assert.equal(request.thinking_budget_tokens, 0);
      }
    }
  }
});

test("No uncaught browser errors", () => assert.deepEqual(errors, []));
