// A small browser bundle of the same Shiki highlighter used by Expressive Code.
// Only the JSON grammar and one light theme are included.
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import json from "@shikijs/langs/json";
import githubLight from "@shikijs/themes/github-light";
let highlighter;
function getHighlighter() {
  return (highlighter ||= createHighlighterCore({
    themes: [githubLight],
    langs: [json],
    engine: createJavaScriptRegexEngine(),
  }));
}
export async function appendTrace(target, title, value) {
  target.querySelector("[data-log-empty]")?.remove();
  const entry = document.createElement("section");
  entry.className = "workshop-log-entry";
  const header = document.createElement("div");
  header.className = "workshop-log-entry__header";
  const label = document.createElement("p");
  label.textContent = title;
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "workshop-log-copy";
  copy.textContent = "Copy";
  copy.setAttribute("aria-label", `Copy ${title}`);
  // JSON.stringify both escapes arbitrary model text and preserves its structure.
  const content = JSON.stringify(value, null, 2) ?? "null";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(content);
      copy.textContent = "Copied";
    } catch {
      copy.textContent = "Select text to copy";
    }
  });
  header.append(label, copy);
  const code = document.createElement("div");
  code.className = "workshop-log-entry__code";
  const fallback = document.createElement("pre");
  fallback.textContent = content;
  code.append(fallback);
  entry.append(header, code);
  target.append(entry);
  try {
    const renderer = await getHighlighter();
    code.innerHTML = renderer.codeToHtml(content, {
      lang: "json",
      theme: "github-light",
    });
  } catch {
    /* Keep readable escaped JSON if highlighting cannot load. */
  }
}

export async function highlightJSON(target, value) {
  const text = JSON.stringify(value, null, 2) ?? "null";
  const pre = document.createElement("pre");
  pre.textContent = text;
  target.append(pre);
  try {
    const renderer = await getHighlighter();
    target.innerHTML = renderer.codeToHtml(text, {
      lang: "json",
      theme: "github-light",
    });
  } catch {
    /* Keep the escaped fallback. */
  }
}
