import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { lessons } from "../public/llm-playground/catalog.js";
import {
  ask,
  modelRequest,
  localBase,
  keywords,
  cosine,
} from "../public/llm-playground/shared.js";

const realFetch = globalThis.fetch;
const brokenLayout = [
  { id: "listening", x: 0, y: 0 },
  { id: "table", x: 1, y: 1 },
  { id: "wall", x: 7, y: 5 },
];
const validLayout = [
  { id: "listening", x: 3, y: 0 },
  { id: "table", x: 3, y: 3 },
  { id: "wall", x: 0, y: 3 },
];
function context(lesson) {
  return {
    base: "http://127.0.0.1:9931",
    embeddingBase: "http://127.0.0.1:9932",
    model: "test-chat",
    embeddingModel: "test-embed",
    ...lesson.defaults,
    trace() {},
    sources() {},
    saveMemory(value) {
      this.saved = value;
    },
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("retrieval, similarity, and loopback endpoint validation", () => {
  assert.equal(localBase("http://127.0.0.1:9931/v1"), "http://127.0.0.1:9931");
  for (const url of [
    "https://example.com",
    "http://example.com",
    "http://localhost.evil.test",
    "http://user:pass@localhost",
  ])
    assert.throws(() => localBase(url));
  assert.deepEqual(
    keywords("Who researches housing?", ["A: housing", "B: buses"]).map(
      (r) => r.content,
    ),
    ["A: housing"],
  );
  assert.deepEqual(
    keywords("I need ink", ["Thinking about sculpture", "Two ink colors"]).map(
      (r) => r.content,
    ),
    ["Two ink colors"],
  );
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.throws(() => cosine([0, 0], [1, 0]));
});

test("all ten lessons execute their orchestration against a protocol fixture", async () => {
  try {
    for (const lesson of lessons) {
      let calls = 0;
      const c = context(lesson);
      c.local = lesson.slug === "mcp";
      globalThis.fetch = async (url, options = {}) => {
        const path = String(url);
        if (path.includes("wikipedia.org"))
          return json({
            query: {
              search: [
                { title: "Bauhaus", snippet: "The 1923 exhibition", pageid: 1 },
              ],
            },
          });
        let body = options.body ? JSON.parse(options.body) : {};
        if (path === "/api/model") {
          body = body.body;
        }
        if (path.endsWith("/v1/embeddings"))
          return json({
            data: body.input.map((_, i) => ({
              index: i,
              embedding: i === 0 ? [1, 0] : [1, i / 10],
            })),
          });
        if (path.endsWith("/v1/chat/completions") || path === "/api/model") {
          calls++;
          if (lesson.slug === "multi-agent" && body.response_format) {
            const fields = body.response_format.json_schema.schema.required;
            return json({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: JSON.stringify(
                      Object.fromEntries(
                        fields.map((key) => [key, "Fixture response"]),
                      ),
                    ),
                  },
                },
              ],
            });
          }
          if (lesson.slug === "agents" && body.response_format) {
            return json({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: JSON.stringify({
                      placements: calls === 1 ? brokenLayout : validLayout,
                    }),
                  },
                },
              ],
            });
          }
          if (body.tools && calls === 1)
            return json({
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: null,
                    tool_calls: [
                      {
                        id: "test-call",
                        type: "function",
                        function: {
                          name:
                            lesson.slug === "mcp"
                              ? "search_archive"
                              : lesson.slug === "tool-calling"
                                ? "calculate_materials"
                                : "check_layout",
                          arguments: JSON.stringify(
                            lesson.slug === "tool-calling"
                              ? { items: [{ id: "led", quantity: 6 }] }
                              : lesson.slug === "agents"
                                ? {
                                    placements:
                                      calls === 1 ? brokenLayout : validLayout,
                                  }
                                : { query: "risograph" },
                          ),
                        },
                      },
                    ],
                  },
                },
              ],
            });
          return json({
            choices: [
              {
                message: {
                  role: "assistant",
                  content:
                    lesson.slug === "structured-output"
                      ? JSON.stringify({
                          title: "Repair & Remix",
                          date: "November 27, 2026",
                          time: "6–8 pm",
                          location: "Room 204",
                        })
                      : "Fixture response [1]",
                },
              },
            ],
          });
        }
        throw new Error("Unexpected fixture URL " + path);
      };
      const { run } = await import(
        `../public/llm-playground/examples/${lesson.slug}.js`
      );
      const output = await run(c);
      if (lesson.slug === "structured-output")
        assert.deepEqual(output, {
          title: "Repair & Remix",
          date: "November 27, 2026",
          time: "6–8 pm",
          location: "Room 204",
        });
      else {
        assert.equal(typeof output, "string", lesson.slug);
        assert.ok(output.length, lesson.slug);
      }
      if (lesson.slug === "temperature") assert.equal(calls, 3);
      if (lesson.slug === "multi-agent") assert.equal(calls, 4);
      if (lesson.slug === "memory") {
        assert.equal(calls, 2);
        assert.ok(c.saved);
      }
      if (lesson.slug === "agents") assert.equal(calls, 3);
      if (["tool-calling", "mcp"].includes(lesson.slug)) assert.equal(calls, 2);
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("empty retrieval makes no inference call; invalid JSON and unapproved tools fail visibly", async () => {
  try {
    globalThis.fetch = async () => {
      throw new Error("Should not request inference");
    };
    const { run: rag } = await import(
      "../public/llm-playground/examples/rag.js"
    );
    assert.match(
      await rag({
        ...context(lessons.find((l) => l.slug === "rag")),
        prompt: "quartz",
      }),
      /No matching sources/,
    );
    globalThis.fetch = async () =>
      json({
        choices: [
          {
            message: {
              role: "assistant",
              content: '{"feeling":"sad","intensity":9}',
            },
          },
        ],
      });
    const { run: structured } = await import(
      "../public/llm-playground/examples/structured-output.js"
    );
    await assert.rejects(() => structured(context(lessons[2])), /validation/);
    globalThis.fetch = async () =>
      json({
        choices: [
          {
            message: {
              role: "assistant",
              tool_calls: [
                {
                  id: "x",
                  function: { name: "delete_files", arguments: "{}" },
                },
              ],
            },
          },
        ],
      });
    const { run: agent } = await import(
      "../public/llm-playground/examples/tool-calling.js"
    );
    await assert.rejects(
      () => agent(context(lessons.find((l) => l.slug === "tool-calling"))),
      /Unapproved/,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("agent enforces round budget, then requests a final answer without tools", async () => {
  let toolRounds = 0,
    finals = 0;
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("wikipedia.org"))
        return json({ query: { search: [] } });
      const body = JSON.parse(options.body);
      if (body.response_format) {
        toolRounds++;
        return json({
          choices: [
            {
              message: {
                role: "assistant",
                content: JSON.stringify({ placements: brokenLayout }),
              },
            },
          ],
        });
      }
      finals++;
      return json({
        choices: [
          { message: { role: "assistant", content: "No evidence found." } },
        ],
      });
    };
    const { run } = await import("../public/llm-playground/examples/agents.js");
    assert.match(
      await run(context(lessons.find((l) => l.slug === "agents"))),
      /Round limit reached; layout still fails/,
    );
    assert.equal(toolRounds, 3);
    assert.equal(finals, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("downloaded local server serves the interface and restricts proxy destinations", async () => {
  const available = createServer();
  available.listen(0, "127.0.0.1");
  await once(available, "listening");
  const port = available.address().port;
  await new Promise((r) => available.close(r));
  const server = spawn(process.execPath, ["public/llm-playground/server.mjs"], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await once(server.stdout, "data");
    const base = `http://127.0.0.1:${port}`;
    assert.deepEqual(
      await realFetch(base + "/api/playground").then((r) => r.json()),
      { localPlayground: true },
    );
    const blocked = await realFetch(base + "/api/model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base: "https://example.com", path: "/v1/models" }),
    });
    assert.equal(blocked.status, 502);
    const crossOrigin = await realFetch(base + "/api/playground", {
      headers: { Origin: "https://example.com" },
    });
    assert.equal(crossOrigin.status, 403);
    const classOrigin = "https://tech-b.munusshih.com";
    const preflight = await realFetch(base + "/api/model", {
      method: "OPTIONS",
      headers: {
        Origin: classOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Private-Network": "true",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-origin"),
      classOrigin,
    );
    assert.equal(
      preflight.headers.get("access-control-allow-private-network"),
      "true",
    );
    for (const route of [
      "/app.js",
      "/api/search?q=test",
      "/tools",
      "/api/tools",
    ]) {
      assert.equal(
        (await realFetch(base + route, { headers: { Origin: classOrigin } }))
          .status,
        403,
      );
    }
    assert.equal(
      (
        await realFetch(base + "/api/playground", {
          headers: { Origin: classOrigin + ".evil.example" },
        })
      ).status,
      403,
    );
    const model = createServer((req, res) => {
      assert.equal(req.url, "/v1/models");
      assert.equal(req.headers.origin, undefined);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ id: "local-model" }] }));
    });
    model.listen(0, "127.0.0.1");
    await once(model, "listening");
    try {
      const forwarded = await realFetch(base + "/api/model", {
        method: "POST",
        headers: { Origin: classOrigin, "Content-Type": "application/json" },
        body: JSON.stringify({
          base: `http://127.0.0.1:${model.address().port}`,
          path: "/v1/models",
        }),
      });
      assert.equal(forwarded.status, 200);
      assert.equal(
        forwarded.headers.get("access-control-allow-origin"),
        classOrigin,
      );
      assert.deepEqual(await forwarded.json(), {
        data: [{ id: "local-model" }],
      });
    } finally {
      await new Promise((resolve) => model.close(resolve));
    }
    const unsupported = await realFetch(base + "/api/model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base: "http://127.0.0.1:9931",
        path: "/unexpected",
      }),
    });
    assert.equal(unsupported.status, 400);
    assert.equal((await realFetch(base + "/app.js")).status, 200);
  } finally {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
});

test("every ZIP contains runnable GUI, teaching README, and the actual source modules", () => {
  for (const name of [...lessons.map((l) => l.slug), "llm-playground-all"]) {
    const listing = execFileSync(
      "unzip",
      ["-Z1", `public/llm-playground/downloads/${name}.zip`],
      { encoding: "utf8" },
    );
    for (const file of [
      "index.html",
      "README.md",
      "server.mjs",
      "mcp-server.js",
      "mcp-client.js",
      "mcp-sdk.js",
      "roles.js",
      "materials-tool.js",
      "layout-checker.js",
      "package.json",
      "app.js",
      "shared.js",
      ...lessons.map((l) => `examples/${l.slug}.js`),
    ])
      assert.ok(listing.includes(`${name}/${file}`), `${name}/${file}`);
  }
});

test("continuous workshop has one connection and ten independent editors", async () => {
  const { runnerHTML } = await import("../public/llm-playground/ui.js");
  for (const id of ["base", "model", "connect"])
    assert.equal(
      (runnerHTML.match(new RegExp(`id="${id}"`, "g")) || []).length,
      1,
    );
  assert.equal((runnerHTML.match(/data-experiment/g) || []).length, 10);
  for (const lesson of lessons)
    assert.ok(runnerHTML.includes(`data-lesson="${lesson.slug}"`));
  for (const label of [
    "What the code does:",
    "<strong>Try:",
    "<strong>Look for:",
  ])
    assert.ok(!runnerHTML.includes(label));
});

test("temperature changes only sampling across three separately displayed answers", async () => {
  const sent = [],
    panels = [];
  try {
    globalThis.fetch = async (url, options) => {
      sent.push(JSON.parse(options.body));
      return json({
        choices: [{ message: { role: "assistant", content: "sample" } }],
      });
    };
    const { run } = await import(
      "../public/llm-playground/examples/temperature.js"
    );
    await run({
      ...context(lessons[1]),
      temperatures: [0.1, 0.7, 1.3],
      panel: (title, value) => panels.push({ title, value }),
    });
    assert.deepEqual(
      sent.map((b) => b.temperature),
      [0.1, 0.7, 1.3],
    );
    assert.deepEqual(
      sent.map((b) => b.messages),
      [sent[0].messages, sent[0].messages, sent[0].messages],
    );
    assert.equal(panels.length, 3);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("missing embedding server explains setup and leaves no partial comparison", async () => {
  try {
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    const { run } = await import("../public/llm-playground/examples/rag.js");
    const panels = [];
    await assert.rejects(
      () =>
        run({
          ...context(lessons.find((l) => l.slug === "rag")),
          retrieval: "compare",
          panel: (...args) => panels.push(args),
        }),
      /Embedding request failed at http:\/\/127\.0\.0\.1:9932.*llama serve/s,
    );
    assert.deepEqual(panels, []);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("materials calculator owns prices, sums cents, and rejects invalid quantities", async () => {
  const { calculateCost } = await import(
    "../public/llm-playground/examples/tool-calling.js"
  );
  const receipt = calculateCost(
    [
      { id: "cardboard", quantity: 3 },
      { id: "tape", quantity: 1 },
      { id: "led", quantity: 6 },
      { id: "battery", quantity: 6 },
    ],
    20,
  );
  assert.equal(receipt.total, 2200);
  assert.equal(receipt.remaining, -200);
  for (const items of [
    [{ id: "led", quantity: -1 }],
    [{ id: "discount", quantity: 1 }],
    [
      { id: "led", quantity: 1 },
      { id: "led", quantity: 2 },
    ],
  ])
    assert.throws(() => calculateCost(items), /Unknown material/);
});

test("layout checker reports bounds, collisions and entrance before accepting a repair", async () => {
  const { checkLayout } = await import(
    "../public/llm-playground/examples/agents.js"
  );
  const broken = checkLayout(brokenLayout);
  assert.equal(broken.valid, false);
  assert.ok(broken.issues.some((s) => s.includes("beyond")));
  assert.ok(broken.issues.some((s) => s.includes("overlaps")));
  assert.ok(broken.issues.some((s) => s.includes("entrance")));
  assert.equal(checkLayout(validLayout).valid, true);
  assert.throws(
    () => checkLayout([validLayout[0], validLayout[0], validLayout[2]]),
    /Invalid/,
  );
});

test("specialist reviews get the same draft independently; producer receives both", async () => {
  const sent = [];
  try {
    globalThis.fetch = async (_, options) => {
      const body = JSON.parse(options.body);
      sent.push(body);
      return json({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify(
                Object.fromEntries(
                  body.response_format.json_schema.schema.required.map(
                    (key) => [key, `Output stage ${sent.length}`],
                  ),
                ),
              ),
            },
          },
        ],
      });
    };
    const { run } = await import(
      "../public/llm-playground/examples/multi-agent.js"
    );
    await run(context(lessons.find((l) => l.slug === "multi-agent")));
    assert.equal(sent.length, 4);
    assert.equal(
      sent[1].messages[1].content.split("\n\nYour task:")[0],
      sent[2].messages[1].content.split("\n\nYour task:")[0],
    );
    assert.match(sent[1].messages[1].content, /Output stage 1/);
    assert.doesNotMatch(sent[2].messages[1].content, /Output stage 2/);
    assert.match(
      sent[3].messages[1].content,
      /Accessibility review: .*Output stage 2/,
    );
    assert.match(
      sent[3].messages[1].content,
      /Fabrication review: .*Output stage 3/,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("one RAG experiment switches retrievers and sends the selected sources to chat", async () => {
  try {
    const { run } = await import("../public/llm-playground/examples/rag.js");
    for (const method of ["keyword", "semantic", "compare"]) {
      const sent = [],
        panels = [];
      globalThis.fetch = async (url, options) => {
        const body = JSON.parse(options.body);
        sent.push({ url: String(url), body });
        if (String(url).endsWith("/v1/embeddings"))
          return json({
            data: [
              { index: 0, embedding: [1, 0] },
              { index: 1, embedding: [0, 1] },
              { index: 2, embedding: [1, 0] },
            ],
          });
        return json({
          choices: [
            {
              message: {
                role: "assistant",
                content: "Answer from supplied sources.",
              },
            },
          ],
        });
      };
      await run({
        ...context(lessons.find((l) => l.slug === "rag")),
        retrieval: method,
        prompt: "booklet",
        documents: "A: Booklet cover rules.\nB: Zines use two ink colors.",
        panel: (title, value) => panels.push({ title, value }),
      });
      assert.equal(
        sent.filter((s) => s.url.endsWith("/v1/embeddings")).length,
        method === "keyword" ? 0 : 1,
      );
      const chat = sent.filter((s) => s.url.endsWith("/v1/chat/completions"));
      assert.equal(chat.length, 1);
      assert.match(
        chat[0].body.messages[1].content,
        method === "keyword"
          ? /Booklet cover rules/
          : /Zines use two ink colors/,
      );
      assert.equal(panels.length, method === "compare" ? 2 : 1);
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("browser MCP initializes, discovers and calls a real server without HTTP or Node processes", async () => {
  let session;
  try {
    globalThis.fetch = async () => {
      throw new Error("Browser MCP should not fetch a server endpoint");
    };
    const { connectArchive } = await import(
      "../public/llm-playground/mcp-client.js"
    );
    const messages = [];
    session = await connectArchive((direction, message) =>
      messages.push({ direction, ...message }),
    );
    const discovery = await session.client.listTools();
    assert.equal(discovery.tools[0].name, "search_archive");
    assert.deepEqual(discovery.tools[0].inputSchema.required, ["query"]);
    const response = await session.client.callTool({
      name: "search_archive",
      arguments: { query: "risograph" },
    });
    assert.match(response.content[0].text, /print-ready PDF/);
    assert.deepEqual(
      messages.filter((m) => m.method).map((m) => m.method),
      ["initialize", "notifications/initialized", "tools/list", "tools/call"],
    );
    await assert.rejects(
      () =>
        session.client.callTool({
          name: "search_archive",
          arguments: { query: "" },
        }),
      /nonempty query/,
    );
    await assert.rejects(
      () =>
        session.client.callTool({
          name: "delete_files",
          arguments: { query: "risograph" },
        }),
      /search_archive/,
    );
  } finally {
    if (session) await session.close();
    globalThis.fetch = realFetch;
  }
});

test("GPT-OSS receives room for reasoning and explicit request overrides remain intact", async () => {
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push(JSON.parse(options.body));
    return json({
      choices: [
        { message: { role: "assistant", content: "A visible answer." } },
      ],
    });
  };
  try {
    const ctx = {
      base: "http://127.0.0.1:9931",
      model: "ggml-org/gpt-oss-20b-GGUF:MXFP4",
      trace() {},
    };
    await ask(ctx, [{ role: "user", content: "Hello" }]);
    assert.equal(sent[0].max_tokens, 1800);
    assert.equal(sent[0].reasoning_effort, "low");
    await ask(ctx, [{ role: "user", content: "Hello" }], { max_tokens: 2400 });
    assert.equal(sent[1].max_tokens, 2400);
    await ask({ ...ctx, model: "Qwen2.5-1.5B" }, [
      { role: "user", content: "Hello" },
    ]);
    assert.equal(sent[2].max_tokens, 700);
    assert.ok(!Object.hasOwn(sent[2], "reasoning_effort"));
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("published connection checks the bridge before a blocked direct server and retains it for chat", async () => {
  const calls = [];
  const ctx = {
    base: "http://127.0.0.1:33221",
    bridgeBase: "http://127.0.0.1:3213",
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    assert.ok(
      !url.startsWith(ctx.base),
      "Do not spend the connection timeout on the blocked server",
    );
    if (url === ctx.bridgeBase + "/api/playground")
      return json({ localPlayground: true });
    assert.equal(url, ctx.bridgeBase + "/api/model");
    return json({ data: [{ id: "model" }] });
  };
  try {
    await modelRequest(ctx, "/v1/models");
    await modelRequest(ctx, "/v1/chat/completions", {
      model: "model",
      messages: [],
    });
    assert.equal(calls.length, 3);
    const payload = JSON.parse(calls[2].options.body);
    assert.equal(payload.base, ctx.base);
    assert.equal(payload.path, "/v1/chat/completions");
    assert.deepEqual(payload.body, { model: "model", messages: [] });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("model HTTP errors are not hidden by the bridge fallback", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return json({ error: "Bad request" }, 400);
  };
  try {
    await assert.rejects(
      modelRequest(
        { base: "http://127.0.0.1:33222", bridgeBase: "http://127.0.0.1:3213" },
        "/v1/models",
      ),
      /HTTP 400/,
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});
