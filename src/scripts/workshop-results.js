import { budgetReceipt, layoutPreview } from "./workshop-data-views.js";
import { marked } from "marked";
import { highlightJSON } from "./request-log.js";
import { resultCardHTML } from "../../public/llm-playground/result-markup.js";
function link(url) {
  try {
    const u = new URL(url);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
function inline(tokens = []) {
  const fragment = document.createDocumentFragment();
  for (const token of tokens) {
    let node;
    if (["strong", "em", "del", "codespan"].includes(token.type)) {
      node = document.createElement(
        { strong: "strong", em: "em", del: "del", codespan: "code" }[
          token.type
        ],
      );
      if (token.type === "codespan") node.textContent = token.text;
      else node.append(inline(token.tokens));
    } else if (token.type === "link" && link(token.href)) {
      node = document.createElement("a");
      node.href = link(token.href);
      node.target = "_blank";
      node.rel = "noopener noreferrer";
      node.append(inline(token.tokens));
    } else if (token.type === "br") node = document.createElement("br");
    else if (token.tokens) {
      node = document.createElement("span");
      node.append(inline(token.tokens));
    } else node = document.createTextNode(token.text ?? token.raw ?? "");
    fragment.append(node);
  }
  return fragment;
}
function markdown(text) {
  const fragment = document.createDocumentFragment();
  for (const token of marked.lexer(text)) {
    let node;
    if (token.type === "space") continue;
    if (token.type === "paragraph" || token.type === "heading") {
      node = document.createElement(token.type === "heading" ? "h4" : "p");
      node.append(inline(token.tokens));
    } else if (token.type === "list") {
      node = document.createElement(token.ordered ? "ol" : "ul");
      if (token.ordered && token.start !== 1) node.start = token.start;
      for (const item of token.items) {
        const li = document.createElement("li");
        li.append(markdown(item.text));
        node.append(li);
      }
    } else if (token.type === "code") {
      node = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = token.text;
      node.append(code);
    } else if (token.type === "blockquote") {
      node = document.createElement("blockquote");
      node.append(markdown(token.text));
    } else if (token.type === "table") {
      node = document.createElement("div");
      node.className = "workshop-result-table";
      const table = document.createElement("table");
      const head = document.createElement("thead"),
        headRow = document.createElement("tr");
      for (const cell of token.header) {
        const th = document.createElement("th");
        th.append(inline(cell.tokens));
        headRow.append(th);
      }
      head.append(headRow);
      table.append(head);
      const body = document.createElement("tbody");
      for (const row of token.rows) {
        const tr = document.createElement("tr");
        for (const cell of row) {
          const td = document.createElement("td");
          td.append(inline(cell.tokens));
          tr.append(td);
        }
        body.append(tr);
      }
      table.append(body);
      node.append(table);
    } else {
      node = document.createElement("p");
      node.textContent = token.text ?? token.raw ?? "";
    }
    fragment.append(node);
  }
  return fragment;
}
function sourceList(items) {
  const list = document.createElement("ol");
  list.className = "workshop-match-list";
  list.setAttribute("role", "list");
  for (const [i, item] of items.entries()) {
    const li = document.createElement("li"),
      top = document.createElement("div");
    top.className = "workshop-match__heading";
    const rank = document.createElement("span");
    rank.className = "workshop-match__rank";
    rank.textContent = String(i + 1);
    top.append(rank);
    if (item.title) {
      const title = document.createElement("strong");
      title.textContent = item.title;
      top.append(title);
    }
    if (Number.isFinite(item.score)) {
      const score = document.createElement("span");
      score.className = "workshop-match__score";
      score.textContent = Number.isInteger(item.score)
        ? `${item.score} keyword match${item.score === 1 ? "" : "es"}`
        : `Similarity ${item.score.toFixed(3)}`;
      top.append(score);
    }
    li.append(top);
    const text = document.createElement("p");
    text.textContent = item.content || item.text || "";
    li.append(text);
    if (item.url && link(item.url)) {
      const a = document.createElement("a");
      a.href = link(item.url);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Read source";
      li.append(a);
    }
    list.append(li);
  }
  return list;
}
// The model supplies values; this reusable view controls the layout.
function eventPreview(event) {
  const preview = document.createElement("section");
  preview.className = "workshop-event-preview";
  preview.setAttribute("aria-label", "Event card preview");
  const title = document.createElement("h4");
  title.textContent = event.title || "Untitled event";
  preview.append(title);
  const details = document.createElement("dl");
  for (const [key, label] of [
    ["date", "Date"],
    ["time", "Time"],
    ["location", "Where"],
  ]) {
    const term = document.createElement("dt");
    term.textContent = label;
    const value = document.createElement("dd");
    value.textContent = event[key] || "Not provided";
    details.append(term, value);
  }
  preview.append(details);
  return preview;
}
export function renderResult(root, title, value, summary = false) {
  root.querySelector("[data-results-empty]")?.remove();
  const target = root.querySelector("[data-results]");
  const template = root.querySelector("template[data-result-template]");
  let card;
  if (template) card = template.content.firstElementChild.cloneNode(true);
  else {
    const fallback = document.createElement("template");
    fallback.innerHTML = resultCardHTML;
    card = fallback.content.firstElementChild.cloneNode(true);
  }
  if (summary) card.classList.add("result-summary");
  if (
    (root.dataset.lesson === "rag" && !Array.isArray(value)) ||
    (root.dataset.lesson === "multi-agent" && title.startsWith("4."))
  )
    card.classList.add("result-answer");
  card.querySelector("[data-result-title]").textContent = title;
  const body = card.querySelector("[data-result-content]");
  if (value?.kind === "budget") body.append(budgetReceipt(value));
  else if (value?.kind === "layout") body.append(layoutPreview(value));
  else if (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        ("content" in item || "text" in item),
    )
  ) {
    if (value.length) body.append(sourceList(value));
    else {
      const p = document.createElement("p");
      p.className = "workshop-output__empty";
      p.textContent = "No matching passages.";
      body.append(p);
    }
  } else if (value !== null && typeof value === "object") {
    if (
      root.dataset.lesson === "structured-output" &&
      ["title", "date", "time", "location"].every(
        (key) => typeof value[key] === "string",
      )
    ) {
      body.append(eventPreview(value));
    }
    const json = document.createElement("div");
    json.className = "workshop-result-json";
    body.append(json);
    highlightJSON(json, value);
  } else body.append(markdown(String(value ?? "")));
  target.append(card);
  const output = root.querySelector("[data-output]");
  if (output) output.hidden = false;
  const copyButton = root.querySelector("[data-copy-results]");
  if (copyButton) {
    copyButton.disabled = false;
    copyButton.hidden = false;
  }
  return card;
}
