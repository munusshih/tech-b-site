import { lessons } from "./catalog.js";
import { appendTrace } from "./request-log.js";
import { renderResult } from "./result-view.js";
import { localBase, request, modelRequest } from "./shared.js";
const $ = (id) => document.getElementById(id);
const sections = [...document.querySelectorAll("[data-lesson]")];
let local = false;
let active = false;
const memoryKey = "tech-b-week13-summary-v1";
function panel(root, title, value, summary = false) {
  return renderResult(root, title, value, summary);
}

function trace(root, title, value) {
  appendTrace(root.querySelector("[data-trace]"), title, value);
}
function sources(root, items) {
  const target = root.querySelector("[data-sources]");
  target.replaceChildren();
  const list = document.createElement("ul");
  list.className = "workshop-sources";
  for (const [index, item] of items.entries()) {
    try {
      const url = new URL(item.url);
      if (!["http:", "https:"].includes(url.protocol)) continue;
      const li = document.createElement("li"),
        a = document.createElement("a");
      a.href = url.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = `[${index + 1}] ${item.title || "Source"}`;
      li.append(a);
      list.append(li);
    } catch {}
  }
  if (list.childNodes.length) target.append(list);
}
function busy(value, root) {
  active = value;
  for (const el of document.querySelectorAll(
    "[data-run],[data-reset],[data-discover],[data-visual-run],[data-visual-reset],#connect,#base,#preset,#model",
  ))
    el.disabled =
      value ||
      (el.hasAttribute("data-visual-run") &&
        !el.closest("[data-outcome]")?.hasAttribute("data-ready"));
  if (root) {
    root.querySelector("[data-stop]").disabled = !value;
    root.querySelector("[data-stop]").hidden = !value;
  }
}
function connection() {
  return {
    base: localBase($("base").value),
    model: $("model").value,
    embeddingBase: $("embedding-base").value,
    embeddingModel: $("embedding-model").value,
    local,
  };
}
// Visual projects share the same model connection and single-request lock.
export async function withPlaygroundConnection(run) {
  if (active)
    throw new Error(
      "Another example is running. Stop it or wait for it to finish.",
    );
  const current = connection();
  if (!current.model)
    throw new Error(
      "Find models in the connection section at the top of the page first.",
    );
  busy(true);
  try {
    return await run(current);
  } finally {
    busy(false);
  }
}
function setup(root) {
  const lesson = lessons.find((l) => l.slug === root.dataset.lesson);
  const form = root.querySelector("[data-experiment]");
  const field = (name) => form.querySelector(`[data-field="${name}"]`);
  const status = root.querySelector("[data-status]");
  let controller;
  let requestCount = 0;
  root
    .querySelector("[data-copy-results]")
    ?.addEventListener("click", async () => {
      const button = root.querySelector("[data-copy-results]");
      try {
        await navigator.clipboard.writeText(
          root.querySelector("[data-results]").innerText,
        );
        button.textContent = "Copied";
      } catch {
        button.textContent = "Select text to copy";
      }
    });
  field("retrieval")?.addEventListener("change", () => {
    const hint = root.querySelector("[data-embedding-hint]");
    if (hint) hint.hidden = field("retrieval").value === "keyword";
  });
  const memory = field("memory");
  if (memory)
    try {
      memory.value = localStorage.getItem(memoryKey) || "";
    } catch {
      status.textContent = "Browser storage is unavailable.";
    }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (active) return;
    busy(true, root);
    controller = new AbortController();
    requestCount = 0;
    root.querySelector("[data-results]").replaceChildren();
    const output = root.querySelector("[data-output]");
    if (output) output.hidden = true;
    const copyButton = root.querySelector("[data-copy-results]");
    if (copyButton) {
      copyButton.disabled = true;
      copyButton.textContent = "Copy results";
    }
    root.querySelector("[data-sources]").replaceChildren();
    root.querySelector("[data-trace]").replaceChildren();
    status.textContent = "Running…";
    try {
      const ctx = {
        ...connection(),
        signal: controller.signal,
        temperature: 0.7,
        ...Object.fromEntries(
          [...form.querySelectorAll("[data-field]")].map((el) => [
            el.dataset.field,
            el.value,
          ]),
        ),
        temperatures: [0, 1, 2].map((i) =>
          Number(field("temperature-" + i)?.value ?? [0.1, 0.7, 1.3][i]),
        ),
        trace(title, value) {
          trace(root, title, value);
        },
        panel(title, value) {
          panel(root, title, value);
        },
        sources(items) {
          sources(root, items);
        },
        requested(kind) {
          requestCount++;
          status.textContent = `Running… ${requestCount} request${requestCount === 1 ? "" : "s"} sent (${kind}).`;
        },
        saveMemory(value) {
          localStorage.setItem(memoryKey, value);
          memory.value = value;
        },
      };
      if (!ctx.prompt?.trim()) throw new Error("Enter some text first.");
      if (lesson.slug === "rag")
        root
          .querySelector("[data-results]")
          .classList.toggle(
            "workshop-results--compare",
            ctx.retrieval === "compare",
          );
      if (!ctx.model)
        throw new Error("Find models at the top of the page first.");
      const { run } = await import(`./examples/${lesson.slug}.js`);
      const result = await run(ctx);
      if (result)
        panel(
          root,
          lesson.finalLabel || "Result",
          result,
          lesson.slug === "temperature",
        );
      status.textContent = `Done. ${requestCount} request${requestCount === 1 ? "" : "s"} sent.`;
    } catch (e) {
      status.textContent = e.name === "AbortError" ? "Stopped." : e.message;
      trace(root, "Error", e.message);
    } finally {
      controller = null;
      busy(false, root);
    }
  });
  root
    .querySelector("[data-stop]")
    .addEventListener("click", () => controller?.abort());
  root.querySelector("[data-reset]").addEventListener("click", () => {
    form.reset();
    const hint = root.querySelector("[data-embedding-hint]");
    if (hint) hint.hidden = true;
    const output = root.querySelector("[data-output]");
    if (output) output.hidden = true;
    root.querySelector("[data-results]").replaceChildren();
    root.querySelector("[data-sources]").replaceChildren();
    if (memory)
      try {
        memory.value = localStorage.getItem(memoryKey) || "";
      } catch {}
    status.textContent = "";
  });
  for (const button of root.querySelectorAll("[data-memory]"))
    button.addEventListener("click", () => {
      try {
        if (button.dataset.memory === "save") {
          localStorage.setItem(memoryKey, memory.value);
          status.textContent = "Summary saved.";
        }
        if (button.dataset.memory === "forget") {
          localStorage.removeItem(memoryKey);
          memory.value = "";
          status.textContent = "Summary forgotten.";
        }
        if (button.dataset.memory === "followup") {
          field("prompt").value =
            "Suggest materials and a first test for my installation. Keep within my budget, equipment, and interaction constraints.";
          field("prompt").focus();
        }
      } catch (e) {
        status.textContent = e.message;
      }
    });
  root.querySelector("[data-discover]")?.addEventListener("click", async () => {
    if (active) return;
    busy(true, root);
    controller = new AbortController();
    try {
      const { discoverArchive } = await import("./mcp-client.js");
      const data = await discoverArchive(
        (title, value) => trace(root, title, value),
        controller.signal,
      );
      root.querySelector("[data-results]").replaceChildren();
      panel(root, "Available archive tools", data);
      trace(root, "MCP tools/list", data);
      status.textContent = "Tools discovered. Ask a question below.";
    } catch (e) {
      status.textContent = e.message;
    } finally {
      controller = null;
      busy(false, root);
    }
  });
  const code = root.querySelector("pre[data-code]");
  if (code)
    fetch(new URL(`./examples/${lesson.slug}.js`, import.meta.url))
      .then((r) => r.text())
      .then((text) => {
        code.textContent = text;
      });
}
async function init() {
  if (!$("connect")) return;
  for (const root of sections) setup(root);
  busy(true);
  try {
    local =
      (await request("/api/playground", { signal: AbortSignal.timeout(1500) }))
        .localPlayground === true;
  } catch {}
  busy(false);
  try {
    const saved = localStorage.getItem("workshop.local-address.llama");
    if (saved) $("base").value = localBase(saved);
  } catch {}
  $("preset").addEventListener("change", () => {
    $("base").value =
      $("preset").value === "ollama"
        ? "http://127.0.0.1:11434"
        : "http://127.0.0.1:9931";
    $("model").replaceChildren(new Option("Find models first", ""));
    $("connection-status").textContent = "Find models to connect.";
  });
  $("base").addEventListener("input", () => {
    $("model").replaceChildren(new Option("Find models first", ""));
  });
  $("connect").addEventListener("click", async () => {
    if (active) return;
    busy(true);
    $("connection-status").textContent = "Finding models…";
    try {
      const data = await modelRequest(
        { ...connection(), signal: AbortSignal.timeout(10000) },
        "/v1/models",
      );
      if (!data.data?.length)
        throw new Error("No models available. Load a chat model first.");
      const previousModel = $("model").value;
      $("model").replaceChildren(
        ...data.data.map((m) => new Option(m.id, m.id)),
      );
      const preferred = data.data.find((m) => /gpt-oss[-:]20b/i.test(m.id));
      if (data.data.some((m) => m.id === previousModel))
        $("model").value = previousModel;
      else if (preferred) $("model").value = preferred.id;
      $("connection-status").textContent =
        "Connected. Every example below uses this model.";
      try {
        localStorage.setItem(
          "workshop.local-address." + $("preset").value,
          localBase($("base").value),
        );
      } catch {}
    } catch (e) {
      $("connection-status").textContent =
        e instanceof TypeError
          ? `No response at ${$("base").value}. Start your local API server, then find models again.`
          : e.message;
    } finally {
      busy(false);
    }
  });
  // Old links now scroll to a visible lesson, without selecting or hiding anything.
  const requested = new URLSearchParams(location.search).get("example");
  if (!location.hash && requested && lessons.some((l) => l.slug === requested))
    document.getElementById(requested)?.scrollIntoView();
}
init();
