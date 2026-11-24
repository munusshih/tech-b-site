import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { outcomes } from "../public/llm-playground/visual-outcomes/catalog.js";
import {
  generators,
  noticeSchema,
  oracleSchema,
  check,
  validateExhibition,
  executeClockTool,
  restoreClockState,
  newClockMorning,
  clockGotUp,
  clockDecisionTools,
} from "../public/llm-playground/visual-outcomes/scores.js";
import { fetchArtworks } from "../public/llm-playground/visual-outcomes/data.js";
const realFetch = globalThis.fetch;
const collection = JSON.parse(
  readFileSync("public/llm-playground/visual-outcomes/collection.json", "utf8"),
);
const json = (data) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
const reply = (message) =>
  json({ choices: [{ message: { role: "assistant", ...message } }] });
const notice = {
  subject: "The studio sink",
  headline: "A Collective Opportunity for Cleanliness",
  body: "Please remove your dishes from the studio sink. The committee appreciates your cooperation.",
  closing: "With measured optimism, the department",
};
const oracle = {
  title: "Leave a little space",
  reading:
    "Your entry describes saying yes before you have checked whether there is room in your day. Today, let one small finished thing be enough.",
  ritual: "Decline one optional task before opening your work.",
  remember: "The user said they have been agreeing to too much.",
  motif: "growth",
  palette: "fern",
};
function ctx(id) {
  return {
    base: "http://127.0.0.1:9931",
    model: "fixture-model",
    state: structuredClone(outcomes.find((o) => o.id === id).starter),
    prompt: "My actual situation",
    date: "November 24, 2026",
    trace() {},
    commit() {},
  };
}
function afterClockQuestion(c) {
  c.state.memory = {
    morning: 1,
    appeals: 1,
    grantedMinutes: 0,
    entries: [
      {
        kind: "appeal",
        morning: 1,
        at: 1,
        excuse: "I need some rest.",
        tool: "ask_reason",
        args: { question: "What has changed?" },
        reply: "What has changed?",
      },
    ],
  };
  return c;
}
const editor = (ids = collection.slice(0, 3).map((r) => r.id)) => ({
  title: "Borrowed Light",
  introduction:
    "These three objects let us ask how the moon becomes a way of imagining company. The relationship is a proposal, rather than proof that the makers shared an intention.",
  objects: ids.map((id) => ({
    id,
    caption: "A distinct contribution to an interpretive relationship.",
    anchor: "maker",
  })),
});
test("the circular preserves the supplied grievance as data and uses the selected register", async () => {
  const c = ctx("notice");
  c.level = "committee";
  c.prompt = "Please stop taking my mug.";
  const requests = [];
  globalThis.fetch = async (u, o) => {
    const request = JSON.parse(o.body);
    requests.push(request);
    const { body, ...headers } = notice;
    return reply({
      content: request.response_format ? JSON.stringify(headers) : body,
    });
  };
  try {
    const result = await generators.notice(c);
    assert.match(requests[0].messages[0].content, /committee/);
    assert.equal(requests[0].messages.at(-1).content, c.prompt);
    assert.equal(result.notices[0].source, c.prompt);
    assert.equal(c.state.notices.length, 0);
    assert.equal(result.notices[0].headline, notice.headline);
  } finally {
    globalThis.fetch = realFetch;
  }
});
test("structured replies reject extra fields and get only one correction attempt", async () => {
  assert.throws(() => check({ ...notice, execute: "alert(1)" }, noticeSchema));
  assert.throws(() => check({ ...oracle, motif: "eval" }, oracleSchema));
  const c = ctx("notice");
  c.level = "unnecessary";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return reply({ content: '{"headline":"incomplete"}' });
  };
  try {
    await assert.rejects(generators.notice(c));
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});
test("the oracle sends only the editable memory, and stores its updated memory with the actual card", async () => {
  const c = ctx("oracle");
  c.memory = "I edited this note myself.";
  c.state.readings = [{ entry: "This old private entry must not be sent." }];
  const requests = [];
  globalThis.fetch = async (u, o) => {
    const body = JSON.parse(o.body);
    requests.push(body);
    const name = body.response_format?.json_schema.name;
    return reply({
      content:
        name === "daily_oracle"
          ? JSON.stringify({
              title: oracle.title,
              motif: oracle.motif,
              palette: oracle.palette,
            })
          : name === "oracle_memory"
            ? JSON.stringify({ remember: oracle.remember })
            : body.messages[0].content.includes("ONE tiny action")
              ? oracle.ritual
              : oracle.reading,
    });
  };
  try {
    const result = await generators.oracle(c);
    assert.match(requests[0].messages[1].content, /I edited this note myself/);
    assert.doesNotMatch(JSON.stringify(requests), /old private entry/);
    assert.equal(result.memory, oracle.remember);
    assert.equal(result.readings.at(-1).memoryBefore, c.memory);
    assert.equal(result.readings.at(-1).motif, "growth");
  } finally {
    globalThis.fetch = realFetch;
  }
});
test("curation references must be unique, retrieved, and use real record field names", () => {
  validateExhibition(editor(), collection);
  const bad = editor();
  bad.objects[0].anchor = "invented";
  assert.throws(() => validateExhibition(bad, collection));
  bad.objects[0].anchor = "maker";
  bad.objects[0].id = "unknown";
  assert.throws(
    () => validateExhibition(bad, collection),
    /supplied collection/,
  );
});
test("curator, researcher, and editor receive the actual preceding work; excluded records never enter requests", async () => {
  const c = ctx("archive");
  c.state.objects = collection;
  c.state.excluded = [collection[0].id];
  c.prompt = "What kinds of company do these objects offer?";
  let introductions = 0;
  const requests = [],
    ids = collection.slice(1, 4).map((r) => r.id);
  globalThis.fetch = async (u, o) => {
    const body = JSON.parse(o.body);
    requests.push(body);
    const name = body.response_format?.json_schema.name,
      input = body.messages[1].content,
      task = body.messages[0].content;
    assert.ok(!input.includes(`ID ${collection[0].id}.`));
    if (name === "curator") {
      return reply({
        content: JSON.stringify({ title: "Borrowed Light", ids }),
      });
    }
    if (name === "exhibition_editor")
      return reply({ content: JSON.stringify({ title: "Borrowed Light" }) });
    if (task.startsWith("Propose ONE")) {
      assert.ok(!input.includes(`ID ${collection[4].id}.`));
      assert.ok(!input.includes(`ID ${collection[5].id}.`));
      return reply({ content: "A tentative curatorial argument." });
    }
    if (task.includes("checking a curator")) {
      assert.match(input, /tentative curatorial argument/);
      return reply({ content: "Do not claim a shared historical intention." });
    }
    assert.match(input, /shared historical intention/);
    if (task.startsWith("Edit this proposal")) {
      assert.ok(!input.includes(`ID ${collection[4].id}.`));
      introductions++;
      return reply({
        content:
          introductions === 1
            ? "ID 438417: Two Men Contemplating the Moon.\nID 36029: Water-moon Avalokiteshvara."
            : `${editor(ids).introduction} ${"Additional interpretation ".repeat(150)}ends here.`,
      });
    }
    assert.match(input, /These three objects/);
    return reply({
      content:
        "This work contributes a distinct perspective to the proposed relationship.",
    });
  };
  try {
    const result = await generators.archive(c);
    assert.equal(requests.length, 9);
    assert.equal(introductions, 2);
    assert.equal(result.exhibitions[0].introduction, editor(ids).introduction);
    assert.equal(result.exhibitions[0].objects[0].fact, collection[1].title);
    assert.match(
      result.exhibitions[0].editorial.research.review,
      /shared historical/,
    );
    assert.equal(c.state.exhibitions.length, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
test("the editor cannot substitute an unselected artwork, even if it was in the larger retrieval", async () => {
  const c = ctx("archive");
  c.state.objects = collection;
  const ids = collection.slice(0, 3).map((r) => r.id);
  globalThis.fetch = async (u, o) => {
    const name = JSON.parse(o.body).response_format?.json_schema.name;
    return reply({
      content:
        name === "curator"
          ? JSON.stringify({ title: "Title", ids })
          : name === "exhibition_editor"
            ? JSON.stringify(editor([ids[0], ids[1], collection[4].id]))
            : "An interpretive proposal grounded in the supplied records.",
    });
  };
  try {
    await assert.rejects(generators.archive(c));
  } finally {
    globalThis.fetch = realFetch;
  }
});
test("clock tools own the timer, bound snoozes, and reject invented tools or arguments", () => {
  const s = ctx("clock").state;
  assert.equal(
    executeClockTool("grant_snooze", { minutes: 5 }, s, 10000).next.until,
    310000,
  );
  assert.equal(s.until, null);
  for (const [name, args] of [
    ["grant_snooze", { minutes: 999 }],
    ["grant_snooze", { minutes: 1, eval: "bad" }],
    ["delete_alarm", {}],
    ["sound_protest", { pattern: "unknown" }],
  ])
    assert.throws(() => executeClockTool(name, args, s, 10000));
  assert.throws(() =>
    executeClockTool(
      "grant_snooze",
      { minutes: 1 },
      { ...s, awake: true },
      10000,
    ),
  );
});
test("the clock commits a real action before a failed explanation and feeds its receipt back as tool feedback", async () => {
  const c = afterClockQuestion(ctx("clock"));
  let now = 10000;
  c.now = () => now;
  c.soundEnabled = false;
  const commits = [];
  c.commit = (s) => commits.push(s);
  let calls = 0;
  globalThis.fetch = async (u, o) => {
    const body = JSON.parse(o.body);
    calls++;
    if (calls === 1) {
      now = 90000;
      return reply({
        tool_calls: [
          {
            id: "snooze-1",
            type: "function",
            function: { name: "grant_snooze", arguments: '{"minutes":2}' },
          },
        ],
      });
    }
    assert.equal(commits.length, 1);
    assert.equal(
      JSON.parse(body.messages.find((m) => m.role === "tool").content).until,
      210000,
    );
    throw Error("Disconnected after tool");
  };
  try {
    await assert.rejects(generators.clock(c), /Disconnected/);
    assert.equal(commits[0].until, 210000);
  } finally {
    globalThis.fetch = realFetch;
  }
});
test("the next clock turn contains complete exchanges and can respond to the previous question", async () => {
  const c = ctx("clock");
  c.now = () => 10000;
  let turn = 0;
  globalThis.fetch = async (u, o) => {
    const body = JSON.parse(o.body);
    if (body.tools) {
      turn++;
      if (turn === 2)
        assert.match(JSON.stringify(body.messages), /What kept you up/);
      return reply({
        tool_calls: [
          {
            id: "question-" + turn,
            type: "function",
            function: {
              name: "ask_reason",
              arguments: '{"question":"What kept you up?"}',
            },
          },
        ],
      });
    }
    return reply({ content: "What kept you up?" });
  };
  try {
    for (let i = 0; i < 5; i++) c.state = await generators.clock(c);
    const retained = c.state.turns;
    assert.equal(retained[0].role, "user");
    for (let i = 0; i < retained.length; i++)
      if (retained[i].role === "tool") assert.ok(retained[i - 1].tool_calls);
    assert.equal(retained.filter((m) => m.role === "user").length, 4);
  } finally {
    globalThis.fetch = realFetch;
  }
});
test("the Met uses the current paginated endpoint and only public-domain images", async () => {
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (String(url).includes("/search"))
      return json({ objectIDs: [1, 2, 3, 4, 5, 6] });
    const id = Number(String(url).split("/").at(-1));
    return json({
      objectID: id,
      title: "Object " + id,
      isPublicDomain: id !== 1,
      primaryImageSmall: "https://images.metmuseum.org/a.jpg",
      objectURL: "https://www.metmuseum.org/art/collection/search/" + id,
      medium: "Ink",
      artistDisplayName: "A maker",
      objectDate: "1900",
    });
  };
  try {
    const records = await fetchArtworks("moon");
    assert.equal(records.length, 5);
    assert.ok(!records.some((r) => r.id === "1"));
    assert.match(urls[0], /v1\.1\/search/);
  } finally {
    globalThis.fetch = realFetch;
  }
});
test("every download contains its readable renderer and interaction source, without retired projects", () => {
  for (const o of outcomes) {
    const zip = `public/llm-playground/downloads/visual-${o.id}.zip`,
      files = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" });
    for (const name of [
      `renderers/${o.id}.js`,
      `sources/${o.id}.js`,
      "visual-outcomes/data.js",
      "visual-outcomes/scores.js",
      "server.mjs",
    ])
      assert.ok(files.includes(name), name);
    assert.ok(!files.includes("sources/rhythm.js"));
    assert.ok(!files.includes("sources/gesture.js"));
    const html = execFileSync(
      "unzip",
      ["-p", zip, `visual-${o.id}/index.html`],
      { encoding: "utf8", maxBuffer: 3000000 },
    );
    assert.ok(html.includes(`data-outcome="${o.id}"`));
    assert.ok(html.includes(`location.hash='outcome-${o.id}'`));
    assert.ok(!html.includes("Four taps"));
    assert.ok(
      html.indexOf('id="resources"') > html.indexOf('data-outcome="clock"'),
    );
  }
});

test("clock prose is never executed; a focused retry must return an actual native call", async () => {
  const c = afterClockQuestion(ctx("clock"));
  c.now = () => 10000;
  const commits = [];
  c.commit = (s) => commits.push(s);
  let calls = 0;
  globalThis.fetch = async (u, o) => {
    const body = JSON.parse(o.body);
    calls++;
    if (calls === 1)
      return reply({
        content: "I grant you 99 minutes. grant_snooze({minutes:99})",
      });
    assert.equal(commits.length, calls < 4 ? 0 : 1);
    if (calls === 2) {
      assert.equal(body.response_format.json_schema.name, "clock_action");
      return reply({ content: '{"tool":"grant_snooze"}' });
    }
    if (calls === 3) {
      assert.equal(body.tool_choice.function.name, "grant_snooze");
      assert.equal(body.tools.length, 1);
      return reply({
        tool_calls: [
          {
            id: "real-call",
            type: "function",
            function: { name: "grant_snooze", arguments: '{"minutes":2}' },
          },
        ],
      });
    }
    return reply({ content: "Two minutes of snooze have been granted." });
  };
  try {
    const result = await generators.clock(c);
    assert.equal(calls, 4);
    assert.equal(result.until, 130000);
    assert.equal(result.receipts.length, 1);
    assert.equal(result.receipts[0].args.minutes, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("clock executes validated structured arguments when native syntax fails twice", async () => {
  const c = afterClockQuestion(ctx("clock"));
  c.now = () => 10000;
  const commits = [];
  c.commit = (s) => commits.push(s);
  let calls = 0;
  globalThis.fetch = async (u, o) => {
    const body = JSON.parse(o.body);
    calls++;
    if (calls === 1 || calls === 3)
      return reply({ content: "grant_snooze({minutes:99})" });
    if (calls === 2) return reply({ content: '{"tool":"grant_snooze"}' });
    if (calls === 4) {
      assert.equal(commits.length, 0);
      assert.equal(body.response_format.json_schema.name, "clock_arguments");
      return reply({ content: '{"minutes":999}' });
    }
    if (calls === 5) {
      assert.equal(commits.length, 0);
      return reply({ content: '{"minutes":3}' });
    }
    assert.equal(commits.length, 1);
    assert.ok(
      body.messages.some((m) => m.content?.includes('"dispatch":"structured"')),
    );
    assert.ok(!body.messages.some((m) => m.role === "tool"));
    return reply({ content: "Three minutes, then report for duty." });
  };
  try {
    const result = await generators.clock(c);
    assert.equal(result.until, 190000);
    assert.equal(result.receipts[0].dispatch, "structured");
    assert.equal(result.receipts[0].args.minutes, 3);
    assert.equal(commits.length, 1);
    assert.equal(calls, 6);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("clock can concede more than five minutes, extend an existing concession, and refuse without adding time", () => {
  const state = ctx("clock").state;
  const first = executeClockTool("grant_snooze", { minutes: 35 }, state, 10000);
  assert.equal(first.next.until, 2110000);
  const extended = executeClockTool(
    "grant_snooze",
    { minutes: 20 },
    first.next,
    70000,
  );
  assert.equal(extended.next.until, 3310000);
  const refused = executeClockTool(
    "refuse_snooze",
    { reason: "That excuse is already on file." },
    extended.next,
    80000,
  );
  assert.equal(refused.next.until, extended.next.until);
  assert.equal(refused.next.message, "That excuse is already on file.");
  assert.throws(() =>
    executeClockTool("grant_snooze", { minutes: 121 }, state),
  );
});

test("clock restores its record without restoring a timer, carries it across mornings, and sends it into the next appeal", async () => {
  const c = afterClockQuestion(ctx("clock"));
  c.prompt = "My first appointment was moved; I have twenty-five minutes free.";
  c.now = () => 10000;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    calls++;
    if (body.tools) {
      if (calls > 2) {
        const input = body.messages.at(-1).content;
        assert.match(input, /first appointment was moved/);
        assert.match(input, /"grantedMinutes":25/);
        assert.match(input, /"kind":"got_up"/);
        assert.match(input, /"morning":2/);
      }
      return reply({
        tool_calls: [
          {
            id: "actual-call-" + calls,
            type: "function",
            function:
              calls === 1
                ? { name: "grant_snooze", arguments: '{"minutes":25}' }
                : {
                    name: "ask_reason",
                    arguments:
                      '{"question":"Yesterday’s concession is still on file. What has changed?"}',
                  },
          },
        ],
      });
    }
    return reply({
      content: "Twenty-five minutes. Your promise has been recorded.",
    });
  };
  try {
    const first = await generators.clock(c);
    assert.equal(first.memory.appeals, 2);
    assert.equal(first.memory.grantedMinutes, 25);
    const saved = JSON.parse(JSON.stringify(first));
    const restored = restoreClockState(saved);
    assert.equal(restored.until, null);
    assert.equal(restored.awake, false);
    assert.deepEqual(restored.turns, []);
    assert.equal(restored.memory.entries.at(-1).excuse, c.prompt);
    assert.equal(saved.until, 1510000);
    const nextDay = newClockMorning(clockGotUp(restored, 20000));
    assert.equal(nextDay.memory.morning, 2);
    c.state = nextDay;
    c.prompt = "Can I have another twenty-five minutes?";
    const second = await generators.clock(c);
    assert.equal(second.until, null);
    assert.equal(second.memory.appeals, 3);
    assert.equal(second.memory.grantedMinutes, 25);
    assert.match(second.message, /Yesterday’s concession/);
    assert.equal(second.memory.entries.at(-1).tool, "ask_reason");
    assert.equal(second.memory.entries.at(-1).reply, second.message);
    assert.throws(() =>
      restoreClockState({
        memory: { ...second.memory, entries: [{ kind: "invented", at: 1 }] },
      }),
    );
    assert.equal(
      restoreClockState(ctx("clock").state).memory.entries.length,
      0,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("clock withholds concessions on opening appeals, immediate follow-ups, and repeated excuses", () => {
  const c = ctx("clock");
  const hasGrant = (prompt) =>
    clockDecisionTools(c.state, prompt).some(
      (t) => t.function.name === "grant_snooze",
    );
  assert.equal(hasGrant("Give me thirty minutes."), false);
  afterClockQuestion(c);
  assert.equal(hasGrant("My appointment moved; I have a concrete plan."), true);
  assert.equal(hasGrant("I NEED SOME REST!!!"), false);
  c.state.memory.entries.push({
    kind: "appeal",
    morning: 1,
    at: 2,
    excuse: "A convincing case.",
    tool: "grant_snooze",
    args: { minutes: 25 },
    reply: "Granted.",
  });
  assert.equal(hasGrant("Another forty-five, please."), false);
  c.state = newClockMorning(c.state);
  assert.equal(hasGrant("A completely new case."), false);
});
