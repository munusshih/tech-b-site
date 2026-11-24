import { lessons } from "./catalog.js";
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export const connectionHTML = `<div class="workshop-connection"><label>App<select id="preset"><option value="llama">Llama App</option><option value="ollama">Ollama</option><option value="lmstudio">LM Studio</option></select></label><label>Local server address<input id="base" type="url" value="http://127.0.0.1:9931"/></label><label>Model<select id="model"><option value="">Find models first</option></select></label></div><div class="workshop-actions"><button id="connect" class="workshop-button" type="button">Find models</button><p id="connection-status" role="status">Connect once. Every example below uses this model.</p></div><details><summary>Connection help and optional embedding model</summary><p>Your local API server must be running. Use the same address as the <a href="/week-12/llama/">Week 12 workshop</a>. If your browser blocks local requests, download the playground, unzip it, run <code>npm start</code>, and open <code>http://127.0.0.1:3213</code>.</p><p>Only the optional semantic retrieval mode in RAG needs another model. With Ollama, run <code>ollama pull embeddinggemma</code> and use port 11434 with model name <code>embeddinggemma</code>. With Llama, run <code>llama serve -hf unsloth/embeddinggemma-300m-GGUF --embedding --port 9932</code>.</p><div class="workshop-connection"><label>Embedding server<input id="embedding-base" value="http://127.0.0.1:9932"/></label><label>Embedding model (blank = first model)<input id="embedding-model"/></label></div></details>`;
const noteInline = (text) =>
  escape(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2">$1</a>');
const field = (name, label, value, rows = 3) =>
  `<label class="workshop-field">${label}<textarea data-field="${name}" rows="${rows}" maxlength="60000">${escape(value || "")}</textarea></label>`;
export function lessonHTML(l) {
  let controls = "";
  if (l.slug === "prompting")
    controls += field("instructions", "Instructions", l.defaults.instructions);
  controls += field(
    "prompt",
    l.slug === "structured-output"
      ? "Event announcement"
      : l.slug === "tool-calling"
        ? "Materials request"
        : "Prompt",
    l.defaults.prompt,
  );
  if ("documents" in l.defaults)
    controls += field("documents", "Archive", l.defaults.documents, 4);
  if (l.slug === "rag")
    controls += `<label class="workshop-field">Retrieval method<select data-field="retrieval"><option value="keyword">Keyword (chat model only)</option><option value="semantic">Semantic (embedding model needed)</option><option value="compare">Compare both (answer uses semantic matches)</option></select></label><p data-embedding-hint class="workshop-setup-hint" hidden>Semantic retrieval needs a separate embedding model. Configure it in <a href="#connect-model">Connection help and embedding setup</a>.</p>`;
  if (l.slug === "tool-calling")
    controls += `<p class="workshop-setup-hint">Classroom prices: cardboard sheet $2.50; tape roll $4; LED $0.50; battery $1.25.</p><label class="workshop-field">Budget ($)<input data-field="budget" type="number" min="0" max="10000" step="0.01" value="${l.defaults.budget}" required></label>`;
  if (l.slug === "temperature")
    controls += `<div class="temperature-settings">${[0.1, 0.7, 1.3].map((v, i) => `<label>Temperature ${i + 1}<input data-field="temperature-${i}" type="number" min="0" max="2" step="0.1" value="${v}" required/></label>`).join("")}</div>`;
  if (l.slug === "agents")
    controls +=
      '<label>Maximum tool rounds<input data-field="rounds" type="number" min="1" max="3" value="3" required/></label>';
  if (l.slug === "web-search")
    controls +=
      '<label>Search provider<select data-field="provider"><option value="wikipedia">Wikipedia</option><option value="searxng">Local SearXNG (optional, download required)</option></select></label>';
  if (l.slug === "memory")
    controls +=
      field(
        "memory",
        "Saved summary (editable, supplied with the next message)",
        "",
      ) +
      '<div class="workshop-actions"><button type="button" data-memory="save" class="workshop-button workshop-button--quiet">Save edited summary</button><button type="button" data-memory="forget" class="workshop-button workshop-button--quiet">Forget summary</button><button type="button" data-memory="followup" class="workshop-button workshop-button--quiet">Ask a follow-up</button></div>';
  if (l.slug === "multi-agent")
    controls += `<details><summary>Edit the four roles</summary>${l.roleFields.map((role) => field(role.name, role.label, role.value)).join("")}</details>`;
  if (l.slug === "mcp")
    controls =
      '<p>The demo MCP client and archive server run in this browser. Discover the tools, or ask directly using your connected local model.</p><button data-discover type="button" class="workshop-button">1. Discover archive tools</button><div data-discovered></div>' +
      controls;
  return `${l.paragraphs.map((p) => `<p>${noteInline(p).replace(/`([^`]+)`/g, "<code>$1</code>")}</p>`).join("")}<section class="workshop-interactive"><span class="workshop-sticker" aria-hidden="true">try it out!</span><form data-experiment class="workshop-editor">${controls}<div class="workshop-run-controls"><button type="submit" class="workshop-button" data-run>${escape(l.action)}</button><div class="workshop-run-controls__secondary"><button type="button" data-stop class="workshop-button workshop-button--secondary" disabled hidden>Stop</button><button type="button" data-reset class="workshop-button workshop-button--quiet">Reset</button></div></div><p data-status role="status"></p></form><section class="workshop-output" aria-label="Results" data-output hidden><div class="workshop-output__toolbar"><p class="workshop-output__label">Results</p><button type="button" class="workshop-button workshop-button--quiet" data-copy-results disabled hidden>Copy results</button></div><div data-results class="workshop-results ${l.slug === "temperature" ? "temperature-results" : ["prompting", "structured-output"].includes(l.slug) ? "workshop-results--compare" : l.slug === "multi-agent" ? "workshop-results--team" : ""}" aria-live="polite"><p data-results-empty class="workshop-output__empty">No results yet.</p></div></section><div data-sources></div></section>`;
}
// Buildless downloads use the same lesson controls as the Astro components.
export const runnerHTML = `<h2 id="connect-model">Connect your local model</h2><section class="workshop-interactive">${connectionHTML}</section>${lessons.map((l, index) => `<h2 id="${l.slug}" class="workshop-section-heading"><span class="workshop-section-number">${index + 1}</span><span>${escape(l.concept)}</span></h2><section data-lesson="${l.slug}">${lessonHTML(l)}<aside class="download-note"><p><strong>${escape(l.noteLabel || "note from munus")}</strong></p>${l.noteSteps ? `<ol class="workshop-concept-steps">${l.noteSteps.map((text) => `<li>${noteInline(text)}</li>`).join("")}</ol>` : l.noteParagraphs ? `<div class="workshop-concept-prose">${l.noteParagraphs.map((text) => `<p>${noteInline(text)}</p>`).join("")}</div>` : `<ul class="workshop-concept-notes">${l.noteBullets.map((text) => `<li>${noteInline(text)}</li>`).join("")}</ul>`}</aside><section class="workshop-technical" aria-label="Code and requests"><div class="workshop-technical__header"><p>Code &amp; requests</p></div><details class="week-toc workshop-disclosure workshop-disclosure--flush"><summary><span class="toc-heading-link">Request log</span><span class="toc-disclosure" aria-hidden="true"></span></summary><div class="workshop-disclosure__body"><section class="workshop-request-log" aria-label="Request log"><div data-trace tabindex="0" aria-label="Requests and responses"><p data-log-empty>Requests and responses appear here when you run the example.</p></div></section></div></details><details class="week-toc workshop-disclosure workshop-disclosure--flush"><summary><span class="toc-heading-link">Full source</span><span class="toc-disclosure" aria-hidden="true"></span></summary><div class="workshop-disclosure__body"><pre data-code></pre></div></details></section></section>`).join("")}`;
