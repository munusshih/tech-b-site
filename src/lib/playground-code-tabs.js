import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { format } from "prettier";
const read = (path) => readFileSync(resolve(path), "utf8");
const shared = read("public/llm-playground/shared.js");

// Excerpts come from the running code. Missing anchors fail the build rather
// than silently showing an outdated teaching example.
function part(source, start, end) {
  const from = source.indexOf(start);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  if (from < 0 || to < 0) throw new Error(`Missing excerpt: ${start}`);
  const lineStart = source.lastIndexOf("\n", from - 1) + 1;
  const lineEnd = end ? source.lastIndexOf("\n", to - 1) + 1 : to;
  const lines = source.slice(lineStart, lineEnd).trimEnd().split("\n");
  const indent = Math.min(
    ...lines
      .filter((line) => line.trim())
      .map((line) => line.match(/^ */)[0].length),
  );
  return lines
    .map((line) => line.slice(indent))
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}
function declaration(source, name) {
  const start = source.search(
    new RegExp(`^(?:export )?(?:async )?(?:function|const) ${name}\\b`, "m"),
  );
  if (start < 0) throw new Error(`Missing source declaration: ${name}`);
  const rest = source.slice(start);
  const next = rest
    .slice(1)
    .search(/^(?:export )?(?:async )?(?:function|const) \w+/m);
  return (next < 0 ? rest : rest.slice(0, next + 1))
    .trim()
    .replace(/(?:\n\s*\/\/[^\n]*)+$/, "")
    .trimEnd();
}
function spaced(code) {
  const lines = [];
  for (const line of code.trim().split("\n")) {
    // Give each explanation room above it, keeping its code directly below it.
    if (
      line.trimStart().startsWith("//") &&
      lines.at(-1)?.trim() &&
      !lines.at(-1).trimStart().startsWith("//")
    )
      lines.push("");
    lines.push(line);
  }
  return lines.join("\n");
}
const step = (comment, code) => `// ${comment}\n${code.trim()}`;
const combine = (...steps) => spaced(steps.join("\n\n"));
const tab = (title, code) => ({ title, code: spaced(code), language: "js" });

// Shared helpers are deliberately excerpts, not whole utility files.
const ask = declaration(shared, "ask");
const askExcerpt = combine(
  step(
    "ask() receives the connection, messages, and request settings.",
    part(ask, "export async function ask", "c.trace").replace(/^export /, ""),
  ),
  step(
    "Send the messages and settings to the connected local model.",
    part(ask, "let data;", "const reply ="),
  ),
  step(
    "Read the assistant message from the server's response.",
    part(ask, "const reply =", "if (!reply)"),
  ),
  step(
    "Error checks and logging are omitted here; Full source includes them.",
    "return reply;\n}",
  ),
);
const semantic = declaration(shared, "semantic");
const keywords = declaration(shared, "keywords");
const search = declaration(shared, "searchWikipedia");
const grounded = declaration(shared, "grounded");
const imports = (source) =>
  [...source.matchAll(/^import\b[\s\S]*?;/gm)]
    .map((match) => match[0])
    .join("\n");
const noExport = (code) => code.replace(/^export /gm, "");
const groundingExcerpt = () =>
  step(
    "grounded(): send source text and the question together, with citation instructions.",
    tail(part(grounded, "const context =")),
  );

function buildLessonCodeTabs(lesson, source, excerpts) {
  const main = excerpts.join("\n\n// ...\n\n");
  const example = (code) =>
    tab(`${lesson.slug}.js`, imports(source) + "\n\n" + code);
  switch (lesson.slug) {
    case "prompting":
      return [
        example(
          combine(
            step(
              "Both requests use exactly the same user message.",
              part(main, "const message =", "// Same message"),
            ),
            step(
              "First ask without instructions, then show that response.",
              part(main, "const plain =", "// This request"),
            ),
            step(
              "Add a system message to change the audience and tone.",
              part(main, "const instructed =", "return text(instructed);"),
            ),
            step(
              "text() extracts the response's content for the interface.",
              "return text(instructed);",
            ),
          ),
        ),
        tab("shared.js", askExcerpt),
      ];
    case "temperature":
      return [
        example(
          combine(
            step(
              "Keep the message fixed so temperature is the only change.",
              part(main, "const messages =", "const temperatures ="),
            ),
            step(
              "Make three separate requests, one at each setting.",
              part(main, "const temperatures =", "const sample ="),
            ),
            step(
              "Count the returned words and display each sample separately.",
              part(main, "const sample ="),
            ),
          ),
        ),
        tab("shared.js", askExcerpt),
      ];
    case "structured-output":
      return [
        example(
          combine(
            step(
              "The schema names the four fields our event card needs.",
              excerpts[0],
            ),
            step(
              "The messages tell the model what to extract; the schema controls its shape.",
              part(source, "const instructions =", "const prose ="),
            ),
            step(
              "Ask for those fields as JSON instead of an ordinary paragraph.",
              part(excerpts[1], "const reply =", "// Valid JSON"),
            ),
            step(
              "The omitted field checks reject missing or unexpected keys.",
              "// Full source includes those checks before returning data.\nreturn data;",
            ),
          ),
        ),
        tab(
          "workshop-results.js",
          combine(
            step(
              "The parsed title becomes text in a regular HTML heading.",
              part(ownView(), "const title =", "const details ="),
            ),
            step(
              "Each named value fills one row; missing details stay visible.",
              part(ownView(), "const details =", "preview.append(details);"),
            ),
          ),
        ),
      ];
    case "tool-calling":
      return [
        example(
          combine(
            step(
              "Offer our calculator; the model supplies item IDs and quantities.",
              part(main, "const reply =", "history.push(reply);"),
            ),
            step(
              "After validating the tool name, JavaScript calculates the cost.",
              "for (const call of reply.tool_calls) {\n" +
                part(main, "const args =", "ctx.panel?."),
            ),
            step(
              "Send the calculated result back as a tool message.",
              part(main, "history.push({", "  // The model can now"),
            ),
            step(
              "A second model request explains the calculated result.",
              "return text(await ask(ctx, history));",
            ),
          ),
        ),
        tab(
          "materials-tool.js",
          combine(
            step(
              "Our program owns the unit prices, expressed in integer cents.",
              noExport(
                declaration(
                  read("public/llm-playground/materials-tool.js"),
                  "materials",
                ),
              ),
            ),
            step(
              "The schema tells the model which arguments this tool accepts.",
              noExport(
                declaration(
                  read("public/llm-playground/materials-tool.js"),
                  "itemSchema",
                ),
              ) +
                "\n\n" +
                noExport(
                  declaration(
                    read("public/llm-playground/materials-tool.js"),
                    "tools",
                  ),
                ),
            ),
            step(
              "Inside calculateCost(): multiply quantity by the fixed price.",
              part(
                declaration(
                  read("public/llm-playground/materials-tool.js"),
                  "calculateCost",
                ),
                "return {",
                "});",
              ),
            ),
            step(
              "Add the line totals; the model does not do this arithmetic.",
              part(
                declaration(
                  read("public/llm-playground/materials-tool.js"),
                  "calculateCost",
                ),
                "const total =",
                "return {",
              ),
            ),
          ),
        ),
      ];
    case "rag":
      return [
        example(
          combine(
            step(
              "Read the passages and the selected retrieval method.",
              part(source, "const archive =", "if (!["),
            ),
            step(
              "Keyword matching is local; semantic matching uses embeddings.",
              part(source, "const wordMatches =", 'if (method !== "semantic")'),
            ),
            step(
              "In comparison mode, use the semantic matches for the answer.",
              part(source, "const selected =", "// teaching:end"),
            ),
          ),
        ),
        tab(
          "shared.js",
          combine(
            step(
              "Inside keywords(): rank by shared words; tokenization is omitted.",
              tail(part(keywords, "return docs")),
            ),
            step(
              "Inside semantic(): embed the question and passages together.",
              part(semantic, "const data =", "if (vectors.length"),
            ),
            step(
              "Compare each passage vector with the question's vector, then sort.",
              tail(part(semantic, "return docs")),
            ),
            groundingExcerpt(),
          ),
        ),
      ];
    case "agents":
      return [
        example(
          combine(
            step(
              "Each attempt includes the previous checker feedback in history.",
              part(main, "let checked;", "history.push(reply);"),
            ),
            step(
              "Parse the proposed positions and run our geometric checks.",
              part(main, "history.push(reply);", "ctx.panel?.("),
            ),
            step(
              "Feed the issues back so the next attempt can correct them.",
              part(main, "history.push({", "// Stop early"),
            ),
            step(
              "Stop on a pass; otherwise continue until the round limit.",
              "if (checked.valid) break;\n}",
            ),
          ),
        ),
        tab(
          "layout-checker.js",
          combine(
            step(
              "Fixed station sizes and the entrance define the layout problem.",
              noExport(
                part(
                  read("public/llm-playground/layout-checker.js"),
                  "export const stations =",
                  "const overlaps =",
                ),
              ),
            ),
            step(
              "Rectangles overlap only if their extents intersect on both axes.",
              declaration(
                read("public/llm-playground/layout-checker.js"),
                "overlaps",
              ),
            ),
            step(
              "Inside checkLayout(): check bounds, the entrance, and station collisions.",
              tail(
                part(
                  declaration(
                    read("public/llm-playground/layout-checker.js"),
                    "checkLayout",
                  ),
                  "const issues =",
                ),
              ),
            ),
          ),
        ),
      ];
    case "web-search":
      return [
        example(
          combine(
            step(
              "Our program chooses to search before asking the model.",
              part(main, "const sources =", "// The next model"),
            ),
            step(
              "grounded() sends the returned snippets with the question.",
              "return grounded(ctx, sources);",
            ),
          ),
        ),
        tab(
          "shared.js",
          combine(
            step(
              "Build a Wikipedia search request from the person's query.",
              part(search, "const url =", "const data ="),
            ),
            step(
              "Fetch directly, or through the downloaded playground's proxy.",
              part(search, "const data =", "if (data.error)"),
            ),
            step(
              "Keep the title, snippet, and link for each source.",
              tail(part(search, "return (data.query")),
            ),
            groundingExcerpt(),
          ),
        ),
      ];
    case "memory": {
      const answer = part(source, "const answer =", "const summary =");
      const summary = part(
        source,
        "const summary =",
        "ctx.saveMemory(summary);",
      );
      return [
        example(
          combine(
            step(
              "Use the editable saved summary as context for this reply.",
              part(source, "const memory =", "ctx.trace") + "\n\n" + answer,
            ),
            step(
              "A second request updates the summary from this new exchange.",
              summary,
            ),
            step(
              "Persist the summary for the next message or visit.",
              "ctx.saveMemory(summary);",
            ),
          ),
        ),
        tab(
          "app.js",
          combine(
            step(
              "Load the saved summary into the textarea when the page opens.",
              declaration(read("public/llm-playground/app.js"), "memoryKey") +
                "\n\n" +
                part(
                  read("public/llm-playground/app.js"),
                  'const memory = field("memory");',
                  'form.addEventListener("submit"',
                ),
            ),
            step(
              "The context callback saves the updated summary after a reply.",
              "const ctx = {\n" +
                (read("public/llm-playground/app.js").match(
                  /saveMemory\(value\) \{[\s\S]*?\n        \}/,
                )?.[0] || "") +
                "\n};",
            ),
          ),
        ),
      ];
    }
    case "multi-agent":
      return [
        example(
          combine(
            step(
              "Inside requestRole(): select this role's instructions.",
              part(
                declaration(source, "requestRole"),
                "async function requestRole",
                "const schema =",
              ),
            ),
            step(
              "Use these as the system message; structured-output settings are omitted here.",
              part(
                declaration(source, "requestRole"),
                "const reply =",
                "      temperature: 0.2,",
              ) +
                "});\nconst result = JSON.parse(text(reply));\nreturn result;\n}",
            ),
            step(
              "The designer creates the draft that both reviewers will read.",
              part(main, "const draft =", "ctx.panel?.("),
            ),
            step(
              "Give both reviewers the same brief and draft.",
              part(main, "const reviewInput =", "// Neither specialist"),
            ),
            step(
              "Run separate reviews; neither sees the other's suggestions.",
              part(main, "const [access, fabrication]", "ctx.panel?.("),
            ),
            step(
              "The producer gets both reviews to revise the original proposal.",
              part(main, "const plan =", "return show(plan"),
            ),
          ),
        ),
        tab(
          "roles.js",
          combine(
            step(
              "Each role has its own goal, even though all use the same model.",
              noExport(
                declaration(read("public/llm-playground/roles.js"), "roles"),
              ),
            ),
            step(
              "Add each role's reference notes (in Full source) to its goal.",
              noExport(
                declaration(
                  read("public/llm-playground/roles.js"),
                  "roleInstructions",
                ),
              ),
            ),
          ),
        ),
      ];
    case "mcp":
      return [
        example(
          combine(
            step(
              "Connect the browser MCP client, then discover the server's tool schema.",
              part(
                source,
                "const session =",
                'ctx.trace("MCP tools/list"',
              ).replace(/^\s*try \{\n/m, ""),
            ),
            step(
              "Offer the discovered tool name, description, and input schema to the model.",
              part(source, "const tools =", "// Route the model"),
            ),
            step(
              "The model chooses arguments; client.callTool sends them through MCP.",
              part(source, "return await toolLoop", "if (result.isError)") +
                "return result;\n});",
            ),
          ),
        ),
        tab(
          "mcp-client.js",
          imports(read("public/llm-playground/mcp-client.js")) +
            "\n\n" +
            combine(
              step(
                "Use the official SDK's linked transport for this browser-only demo.",
                part(
                  read("public/llm-playground/mcp-client.js"),
                  "const [clientTransport",
                  "for (const [transport",
                ),
              ),
              step(
                "The server and client initialize the real MCP session.",
                part(
                  read("public/llm-playground/mcp-client.js"),
                  "const server =",
                  "} catch (error)",
                ).replace(/^\s*try \{\n/m, ""),
              ),
            ),
        ),
        tab(
          "mcp-server.js",
          imports(read("public/llm-playground/mcp-server.js")) +
            "\n\n" +
            combine(
              step(
                "tools/list returns the tool definition and its required inputs.",
                part(
                  read("public/llm-playground/mcp-server.js"),
                  "server.setRequestHandler(\n    ListToolsRequestSchema",
                  "// tools/call",
                ),
              ),
              step(
                "tools/call validates the request, searches the archive, and returns MCP content.",
                part(
                  read("public/llm-playground/mcp-server.js"),
                  "server.setRequestHandler(\n    CallToolRequestSchema",
                  "return server;",
                ),
              ),
            ),
        ),
      ];
  }
}
function tail(code) {
  // Excerpt begins inside this function, so omit its unrelated closing brace.
  return code.replace(/\n\}$/, "");
}
export async function lessonCodeTabs(lesson, source, excerpts) {
  const tabs = buildLessonCodeTabs(lesson, source, excerpts);
  return Promise.all(
    tabs.map(async (tab) => {
      // Formatting as a function body keeps return statements valid while
      // correcting indentation across separately selected source passages.
      const importCode = imports(tab.code);
      const body = tab.code.replace(/^import\b[\s\S]*?;/gm, "").trim();
      const formatted = await format(
        `async function teachingExcerpt() {\n${body}\n}`,
        {
          parser: "babel",
          printWidth: 64,
          tabWidth: 2,
        },
      );
      const lines = formatted.trimEnd().split("\n").slice(1, -1);
      return {
        ...tab,
        code:
          (importCode
            ? (
                await format(importCode, { parser: "babel", printWidth: 64 })
              ).trimEnd() + "\n\n"
            : "") +
          spaced(
            lines
              .map((line) => (line.startsWith("  ") ? line.slice(2) : line))
              .join("\n"),
          ),
      };
    }),
  );
}
function ownView() {
  return declaration(read("src/scripts/workshop-results.js"), "eventPreview");
}
export function lessonSourceFiles(lesson, source) {
  const files = [
    { title: `${lesson.slug}.js`, code: spaced(source), language: "js" },
    { title: "shared.js", code: spaced(shared), language: "js" },
  ];
  const related = {
    mcp: ["mcp-client.js", "mcp-server.js"],
    "multi-agent": ["roles.js"],
    agents: ["layout-checker.js"],
    "tool-calling": ["materials-tool.js"],
  };
  for (const filename of related[lesson.slug] || [])
    files.push({
      title: filename,
      code: spaced(read(`public/llm-playground/${filename}`)),
      language: "js",
    });
  return files;
}
