// Regenerate downloadable source bundles from the actual classroom runtime.
import { mkdtemp, readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { lessons } from "../public/llm-playground/catalog.js";
import { runnerHTML } from "../public/llm-playground/ui.js";
import { outcomes } from "../public/llm-playground/visual-outcomes/catalog.js";
import { outcomesHTML } from "../public/llm-playground/visual-outcomes/ui.js";
import { resourcesHTML } from "../public/llm-playground/resources.js";
const root = fileURLToPath(
  new URL("../public/llm-playground/", import.meta.url),
);
// Ship the same self-contained highlighter to the site and offline downloads.
await build({
  entryPoints: [
    fileURLToPath(
      new URL("../src/scripts/workshop-request-log.js", import.meta.url),
    ),
  ],
  outfile: join(root, "request-log.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "eof",
});
await build({
  entryPoints: [
    fileURLToPath(
      new URL("../src/scripts/workshop-results.js", import.meta.url),
    ),
  ],
  outfile: join(root, "result-view.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  external: ["./request-log.js"],
  legalComments: "eof",
});
await build({
  entryPoints: [
    fileURLToPath(
      new URL("../src/scripts/workshop-mcp-sdk.js", import.meta.url),
    ),
  ],
  outfile: join(root, "mcp-sdk.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "eof",
});
// Bundle each project separately; audio and drawing libraries load on demand.
const visualSource = fileURLToPath(
  new URL("../src/scripts/visual-outcomes/", import.meta.url),
);
await rm(join(root, "visual-outcomes/renderers"), {
  recursive: true,
  force: true,
});
await rm(join(root, "visual-outcomes/sources"), {
  recursive: true,
  force: true,
});
await build({
  entryPoints: outcomes.map((o) => join(visualSource, `${o.id}.js`)),
  outdir: join(root, "visual-outcomes/renderers"),
  bundle: true,
  splitting: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "eof",
});
await cp(visualSource, join(root, "visual-outcomes/sources"), {
  recursive: true,
});
const out = join(root, "downloads");
await mkdir(out, { recursive: true });
for (const obsolete of [
  "visual-weather.zip",
  "visual-museum.zip",
  "visual-map.zip",
  "visual-type.zip",
  "visual-gesture.zip",
  "visual-rhythm.zip",
])
  await rm(join(out, obsolete), { force: true });
const escape = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const files = [
  "app.js",
  "request-log.js",
  "result-view.js",
  "result-markup.js",
  "shared.js",
  "catalog.js",
  "ui.js",
  "style.css",
  "workshop.css",
  "server.mjs",
  "roles.js",
  "materials-tool.js",
  "layout-checker.js",
  "mcp-sdk.js",
  "mcp-client.js",
  "mcp-server.js",
];
for (const selected of [...lessons, ...outcomes, null]) {
  const temp = await mkdtemp(join(tmpdir(), "tech-b-llm-"));
  try {
    const name =
      selected?.slug ||
      (selected?.id ? `visual-${selected.id}` : "llm-playground-all");
    const folder = join(temp, name);
    await mkdir(folder);
    for (const file of files) await cp(join(root, file), join(folder, file));
    await cp(
      new URL("../src/styles/workshop-controls.css", import.meta.url),
      join(folder, "controls.css"),
    );
    await cp(
      new URL("../src/styles/workshop-panels.css", import.meta.url),
      join(folder, "panels.css"),
    );
    await cp(
      new URL("../src/styles/workshop-expressions.css", import.meta.url),
      join(folder, "expressions.css"),
    );
    await cp(
      new URL("../src/styles/workshop-results.css", import.meta.url),
      join(folder, "results.css"),
    );
    await cp(join(root, "visual-outcomes"), join(folder, "visual-outcomes"), {
      recursive: true,
    });
    await cp(join(root, "examples"), join(folder, "examples"), {
      recursive: true,
    });
    await writeFile(
      join(folder, "package.json"),
      JSON.stringify(
        {
          name: "tech-b-llm-playground",
          private: true,
          type: "module",
          scripts: { start: "node server.mjs" },
          engines: { node: ">=24" },
        },
        null,
        2,
      ) + "\n",
    );
    await writeFile(
      join(folder, "index.html"),
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workshop 4: Local Chain of Thoughts / Tech B</title><link rel="stylesheet" href="./style.css"><link rel="stylesheet" href="./workshop.css"><link rel="stylesheet" href="./controls.css"><link rel="stylesheet" href="./panels.css"><link rel="stylesheet" href="./expressions.css"><link rel="stylesheet" href="./results.css"><link rel="stylesheet" href="./visual-outcomes/style.css"></head><body class="playground-content"><main class="shell"><p>Technology B / Week 13 / Input</p><h1>Workshop 4: Local Chain of Thoughts</h1><p>Start by connecting a local model, then work through the examples at your own pace. You can change a prompt, inspect what was sent, and compare the reply with what you expected. The four projects after the workshops use a frustrated note, a personal check-in, a collection of artworks, and an excuse for staying in bed to try four different interactions with a model.</p>${runnerHTML}${outcomesHTML}${resourcesHTML}</main><script type="module">
${selected ? `location.hash='${selected.slug || `outcome-${selected.id}`}';` : ""}
await import('./app.js');
await import('./visual-outcomes/app.js');
</script></body></html>`,
    );
    await writeFile(
      join(folder, "README.md"),
      `# ${selected?.concept || selected?.title || "Workshop 4: Local Chain of Thoughts"}\n\nTechnology B, Week 13. Ten model workshops and four visual outcomes.\n\n## Start\n\n1. Install Node.js 24 LTS from https://nodejs.org/en/download .\n2. Open a terminal in this unzipped folder.\n3. Start Llama App or Ollama, load a local chat model, and start its API server.\n4. Run npm start. Core examples need no npm install.\n5. Open http://127.0.0.1:3213 and connect.\n\nThe MCP client and small demo server run in your browser using the bundled official SDK and a linked in-memory transport. No npm install is required to run the download. Discovery and calls exchange real MCP messages; inspect them in the request log. This classroom demo does not connect to external MCP services.\n\n## Files\n\n- index.html: interface and teaching notes\n- examples/: one short JavaScript lesson per concept\n- shared.js: model requests, keyword retrieval, embeddings, and bounded tool loops\n- app.js: form controls, status, traces, and browser memory\n- server.mjs: loopback-only model proxy and information retrieval\n- mcp-client.js: browser MCP connection and initialization\n- mcp-server.js: tiny read-only MCP archive\n- mcp-sdk.js: bundled official MCP SDK\n\nEdit a lesson file and refresh the browser. No build command is needed. Restart npm start after changing server.mjs.\n\n## Models and connections\n\nLlama App: http://127.0.0.1:9931\nOllama: http://127.0.0.1:11434\n\nKeep npm start running to use this folder as the local model bridge for https://tech-b.munusshih.com. The published workshop will use it if direct browser access is blocked. It allows only that exact website origin, only model-list, chat, and embedding routes, and only loopback model servers. No Llama agent-control routes are exposed. You can also use the downloaded interface at http://127.0.0.1:3213.\n\nUse the model menu to choose a loaded chat model. JSON Schema and tool support depend on model and server. Errors are shown rather than replaced by fake results. Inference never uses a commercial service. Downloads and model installation need internet initially.\n\nThe optional semantic retrieval modes in RAG need a separate embedding model. For Llama run:\n\n    llama serve -hf unsloth/embeddinggemma-300m-GGUF --embedding --port 9932\n\nFor Ollama run ollama pull embeddinggemma, then use embedding server URL http://127.0.0.1:11434 and model name embeddinggemma in the form. The chat and embedding models are different. Download GGUF files at https://huggingface.co/unsloth/embeddinggemma-300m-GGUF/tree/main or see https://ollama.com/library/embeddinggemma .\n\nWeb search needs internet. The layout agent runs entirely locally. Search snippets are incomplete; open source links to verify. Tool loops allow at most three calls per turn and three tool rounds, followed by a final call without tools. The agent trace logs application actions, not hidden reasoning.\n\nSearXNG is optional. Run a local instance at http://127.0.0.1:8080 and enable JSON in settings.yml (search.formats includes json). To use another local address, set SEARXNG_BASE before npm start. Rate limits and blocked search engines can still affect results.\n\nMemory is a model-written summary stored in this browser's localStorage on the local origin. It survives a reload. Edit or forget it using the interface; clearing site data also removes it. Other lessons do not read that summary. It is not stored in a JSON file.\n\n## Creative coding outcomes A–D\n\nThe visual-outcomes folder contains four different provotypes. A turns a frustrated note into a fictional office circular, using GSAP and typography. B writes a reflective oracle and paints a symbolic card using p5.js and p5.brush; an editable memory is stored in this browser. C retrieves public-domain Met artworks, then gives a curator, researcher, and editor separate jobs in constructing an exhibition. D is an alarm-clock negotiation: actual tool calls grant snooze time, ask questions, or request short Tone.js protests. No sound starts until you enable it. This clock runs in the page; it is not a system alarm and does not resume after a reload.\n\nLibraries are bundled locally, with readable originals in visual-outcomes/sources/. Core examples and A, B, and D use only the local model connection. The Met needs internet but no API key. Existing public-domain images stay linked to their original records. Sessions can be exported or cleared in each project. No model-written code is executed.\n\nTo rebuild a modified output, install p5@2.4.0 p5.brush@3.0.0 gsap rough-notation tone and esbuild, then bundle sources/notice.js, sources/oracle.js, sources/archive.js, and sources/clock.js with --bundle --splitting --format=esm --platform=browser --outdir=visual-outcomes/renderers. Run the command from the unzipped root folder and prefix each entry point with visual-outcomes/.\n\nThe model interactions live in visual-outcomes/scores.js. The code has bounded responses, one correction attempt for structured replies, and checked tool arguments. Browser storage belongs to the local origin: opening the downloads on another port starts with a separate memory.\n\n## Teaching questions\n\n${(selected?.slug ? [selected] : lessons).map((l) => `### ${l.concept}\n\n${l.explain}\n\nTry: ${l.first}\n\nChange: ${l.change}\n\nDiscuss: ${l.reflect}`).join("\n\n")}\n\n## Official references\n\n- https://llama.app/docs/api\n- https://llama.app/docs/serve\n- https://docs.ollama.com/api/openai-compatibility\n- https://www.mediawiki.org/wiki/API:Search\n- https://docs.searxng.org/dev/search_api.html\n- https://github.com/modelcontextprotocol/typescript-sdk\n- https://modelcontextprotocol.io/docs/tools/inspector\n`,
    );
    // zip preserves an enclosing folder so students can safely unzip together.
    await rm(resolve(out, name + ".zip"), { force: true });
    execFileSync("zip", ["-qr", resolve(out, name + ".zip"), name], {
      cwd: temp,
    });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
console.log(
  `Created ${lessons.length + outcomes.length + 1} source bundles in public/llm-playground/downloads`,
);
