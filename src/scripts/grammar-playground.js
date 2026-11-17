/* global document, Event */
import { RiTa } from "rita";
import { grammarPresets } from "@/lib/grammar-presets.js";
import { bindGeneratorExport, grammarHtml } from "./generator-export.js";

const form = document.querySelector("#grammar-form");
const start = document.querySelector("#grammar-start");
const list = document.querySelector("#grammar-rule-list");
const template = list.firstElementChild.cloneNode(true);
const addButton = document.querySelector("#grammar-add");
const editorStatus = document.querySelector("#grammar-status");
const outputStatus = document.querySelector("#grammar-output-status");
const empty = document.querySelector("#grammar-empty");
const results = document.querySelector("#grammar-results");
const presetButtons = Array.from(
  document.querySelectorAll("[data-grammar-preset]"),
);
const switchPanel = document.querySelector("#grammar-switch");
const switchMessage = document.querySelector("#grammar-switch-message");
const confirmSwitch = document.querySelector("#grammar-switch-confirm");
const cancelSwitch = document.querySelector("#grammar-switch-cancel");
const weightRule = document.querySelector("#grammar-weight-rule");
const weightList = document.querySelector("#grammar-weight-list");
const weightStatus = document.querySelector("#grammar-weight-status");
const percent = new Intl.NumberFormat("en", {
  style: "percent",
  maximumFractionDigits: 1,
});
const ruleLimit = 12;
const outputLimit = 4000;
const symbol = /\$([A-Za-z][A-Za-z0-9_]*)/g;
let selectedPreset = 0;
let pendingPreset = 0;

function readAlternatives(value) {
  return value.split("\n").flatMap((line, index) => {
    const source = line.trim();
    if (!source) return [];

    const suffix = /\s*\(([+-]?\d+(?:\.\d+)?)\)$/.exec(source);
    const weight = suffix ? Number(suffix[1]) : 1;
    const text = suffix ? source.slice(0, suffix.index).trimEnd() : source;
    if (!text || !Number.isInteger(weight) || weight < 1 || weight > 999) {
      throw new Error(
        "Give each alternative text and a whole-number weight from 1 to 999.",
      );
    }
    return [{ index, source, text, weight }];
  });
}

function renderWeights() {
  weightList.replaceChildren();
  weightStatus.textContent = "";
  if (weightRule.selectedIndex < 0) {
    weightStatus.textContent = "Add a named rule to adjust its weights here.";
    return;
  }
  const editor =
    list.children[Number(weightRule.value)].querySelector("[data-choices]");
  let choices;
  try {
    choices = readAlternatives(editor.value);
  } catch (error) {
    weightStatus.textContent = error.message;
    return;
  }
  if (!choices.length) {
    weightStatus.textContent = "Add alternatives to this rule in Step 2.";
    return;
  }

  function updateChances() {
    const total = choices.reduce((sum, choice) => sum + choice.weight, 0);
    choices.forEach(({ weight }, index) => {
      weightList.children[index].lastElementChild.textContent = percent.format(
        weight / total,
      );
    });
  }

  for (const choice of choices) {
    const row = document.createElement("div");
    row.className = "grammar-weight-row";
    const label = document.createElement("label");
    label.textContent = choice.text;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "999";
    input.step = "1";
    input.required = true;
    input.value = String(choice.weight);
    input.setAttribute("form", "grammar-form");
    input.setAttribute("aria-label", `Weight for ${choice.text}`);
    label.append(input);
    const probability = document.createElement("output");
    row.append(label, probability);
    weightList.append(row);

    input.addEventListener("input", () => {
      const value = input.valueAsNumber;
      if (!Number.isInteger(value) || !input.validity.valid) {
        weightStatus.textContent = "Enter a whole-number weight from 1 to 999.";
        return;
      }
      weightStatus.textContent = "";
      choice.weight = value;
      const lines = editor.value.split("\n");
      lines[choice.index] = `${choice.text} (${value})`;
      editor.value = lines.join("\n");
      outputStatus.textContent = results.childElementCount
        ? "Showing the previous generation."
        : "";
      updateChances();
      form.dispatchEvent(new Event("change"));
    });
  }
  updateChances();
}

function refreshWeightRules() {
  const previous = weightRule.selectedOptions[0]?.textContent;
  const options = Array.from(list.children, (row, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent =
      row.querySelector("[data-name]").value.trim() ||
      `Unnamed rule ${index + 1}`;
    return option;
  });
  weightRule.replaceChildren(...options);
  const selected =
    options.find((option) => option.textContent === previous) ??
    options.find((option) => option.textContent === "ADJ") ??
    options.find((option) => option.textContent === "VP") ??
    options[0];
  if (selected) weightRule.value = selected.value;
  weightRule.disabled = options.length === 0;
  renderWeights();
}

function createRule(name = "", choices = []) {
  const row = template.cloneNode(true);
  row.querySelector("[data-name]").value = name;
  row.querySelector("[data-choices]").value = choices.join("\n");
  return row;
}

function hasEdits() {
  const preset = grammarPresets[selectedPreset];
  const originalRules = Object.entries(preset.rules);
  return (
    start.value !== preset.start ||
    list.children.length !== originalRules.length ||
    originalRules.some(([name, choices], index) => {
      const row = list.children[index];
      return (
        row.querySelector("[data-name]").value !== name ||
        row.querySelector("[data-choices]").value !== choices.join("\n")
      );
    })
  );
}

function loadPreset(index) {
  const { start: pattern, rules } = grammarPresets[index];
  start.value = pattern;
  start.rows = Math.max(2, pattern.split("\n").length);
  list.replaceChildren(
    ...Object.entries(rules).map(([name, choices]) =>
      createRule(name, choices),
    ),
  );
  addButton.disabled = list.children.length >= ruleLimit;
  presetButtons[selectedPreset].setAttribute("aria-pressed", "false");
  presetButtons[index].setAttribute("aria-pressed", "true");
  selectedPreset = index;
  switchPanel.hidden = true;
  if (results.childElementCount) {
    outputStatus.textContent = "Showing the previous generation.";
  }
  editorStatus.textContent = "";
  refreshWeightRules();
  form.dispatchEvent(new Event("change"));
}

for (const [index, button] of presetButtons.entries()) {
  button.addEventListener("click", () => {
    if (index === selectedPreset) return;
    if (hasEdits()) {
      pendingPreset = index;
      switchPanel.hidden = false;
      switchMessage.textContent = `Switching to “${grammarPresets[index].label}” will replace your edits to the grammar.`;
      cancelSwitch.focus();
      return;
    }
    loadPreset(index);
  });
}

confirmSwitch.addEventListener("click", () => {
  loadPreset(pendingPreset);
  presetButtons[selectedPreset].focus();
});
cancelSwitch.addEventListener("click", () => {
  switchPanel.hidden = true;
  presetButtons[selectedPreset].focus();
});

function readRules() {
  const pattern = start.value.trim();
  if (!pattern) throw new Error("Write a start rule first.");
  const alternatives = new Map([
    ["start", [{ text: pattern, source: pattern }]],
  ]);
  for (const row of list.children) {
    const name = row.querySelector("[data-name]").value.trim();
    const lines = readAlternatives(row.querySelector("[data-choices]").value);

    if (
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) ||
      Object.hasOwn(Object.prototype, name)
    ) {
      throw new Error(
        "Give every rule a name that starts with a letter. Use letters, digits, or underscores.",
      );
    }
    if (alternatives.has(name))
      throw new Error(`“${name}” is already a rule name.`);
    if (!lines.length)
      throw new Error(`Add at least one alternative to “${name}”.`);
    alternatives.set(name, lines);
  }

  // Check references and bound the longest expansion before calling RiTa.
  const lengths = new Map();
  const visiting = new Set();
  function maxLength(name) {
    if (lengths.has(name)) return lengths.get(name);
    if (visiting.has(name))
      throw new Error(
        `“${name}” refers back to itself. Break the loop before generating.`,
      );
    if (!alternatives.has(name))
      throw new Error(
        `Add a rule named “${name}” or remove the reference $${name}.`,
      );

    visiting.add(name);
    let longest = 0;
    for (const { text } of alternatives.get(name)) {
      const literal = text.replace(symbol, "");
      if (/[$|[\]{}]/.test(literal)) {
        throw new Error(
          `Use plain text and $rule references in “${name}”. Put each alternative on its own line.`,
        );
      }
      let length = literal.length;
      for (const match of text.matchAll(symbol)) length += maxLength(match[1]);
      if (length > outputLimit)
        throw new Error(
          `“${name}” can produce more than ${outputLimit} characters. Shorten its alternatives.`,
        );
      longest = Math.max(longest, length);
    }
    visiting.delete(name);
    lengths.set(name, longest);
    return longest;
  }

  for (const name of alternatives.keys()) maxLength(name);
  return Object.fromEntries(
    Array.from(alternatives, ([name, lines]) => [
      name,
      lines.map(({ source }) => source).join(" | "),
    ]),
  );
}

addButton.addEventListener("click", () => {
  const row = createRule();
  list.append(row);
  addButton.disabled = list.children.length >= ruleLimit;
  editorStatus.textContent = "";
  row.querySelector("[data-name]").focus();
  refreshWeightRules();
  form.dispatchEvent(new Event("change"));
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  button.closest("[data-rule]").remove();
  addButton.disabled = false;
  editorStatus.textContent = "";
  addButton.focus();
  refreshWeightRules();
  form.dispatchEvent(new Event("change"));
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const count = event.submitter?.value === "5" ? 5 : 1;
  try {
    const grammar = RiTa.grammar(readRules());
    const sentences = Array.from({ length: count }, () => {
      const item = document.createElement("li");
      item.textContent = grammar.expand();
      return item;
    });
    results.replaceChildren(...sentences);
    empty.hidden = true;
    editorStatus.textContent = "";
    outputStatus.textContent =
      count === 1 ? "Generated one result." : "Generated five variations.";
  } catch (error) {
    editorStatus.textContent = error.message;
    outputStatus.textContent = error.message;
  }
});

form.addEventListener("input", () => {
  editorStatus.textContent = "";
  outputStatus.textContent = "";
  refreshWeightRules();
});

weightRule.addEventListener("change", renderWeights);
refreshWeightRules();
bindGeneratorExport(form, () => grammarHtml(readRules()), "rita-grammar.html");
