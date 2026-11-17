/* global document, Event */
import { RiTa } from "rita";
import { markovSources } from "@/lib/markov-sources";
import { bindGeneratorExport, markovHtml } from "./generator-export.js";

const training = document.querySelector("#training");
const corpus = document.querySelector("#corpus");
const sourceFile = document.querySelector("#source-file");
const sourceStatus = document.querySelector("#source-status");
const trainingStatus = document.querySelector("#training-status");
const context = document.querySelector("#context");
const contextTokens = document.querySelector("#context-tokens");
const predictionStatus = document.querySelector("#prediction-status");
const probabilities = document.querySelector("#probabilities");
const entropy = document.querySelector("#markov-entropy");
const entropyValue = document.querySelector("#markov-entropy-value");
const draft = document.querySelector("#draft");
const draftStatus = document.querySelector("#draft-status");
const sentenceButton = document.querySelector("#generate-sentence");
const articleButton = document.querySelector("#generate-article");

const percentage = new Intl.NumberFormat("en", {
  style: "percent",
  maximumFractionDigits: 1,
});
const number = new Intl.NumberFormat("en");
const bits = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
let model;
let fileRequest = 0;

function renderPrediction() {
  const remembered = Number(training.elements.ngram.value) - 1;
  const tokens = context.value.trim()
    ? RiTa.tokenize(context.value.trim())
    : [];
  // Only the most recent tokens are part of the current Markov state.
  const state = tokens.slice(-remembered);
  const chips = (state.length ? state : ["Sentence start"]).map((token) => {
    const chip = document.createElement("span");
    chip.textContent = token;
    return chip;
  });
  contextTokens.replaceChildren(...chips);
  probabilities.replaceChildren();
  entropy.hidden = true;

  if (!model) {
    predictionStatus.textContent = "Train the model to see its predictions.";
    return;
  }

  const choices = Object.entries(model.probabilities(state)).sort(
    ([, left], [, right]) => right - left,
  );
  if (!choices.length) {
    predictionStatus.textContent =
      "No next token for that phrase. Try matching the corpus’s spelling, capitalization, and punctuation.";
    return;
  }

  // Calculate Shannon entropy from every RiTa transition before grouping bars.
  const uncertainty = choices.reduce(
    (sum, [, chance]) => (chance > 0 ? sum - chance * Math.log2(chance) : sum),
    0,
  );
  entropyValue.textContent = `${bits.format(uncertainty)} ${uncertainty === 1 ? "bit" : "bits"}`;
  entropy.hidden = false;

  predictionStatus.textContent =
    tokens.length > remembered
      ? `Using the last ${remembered} of ${tokens.length} tokens.`
      : `${number.format(choices.length)} possible next ${choices.length === 1 ? "token" : "tokens"}.`;

  const visible = choices.slice(0, 7);
  const omitted = choices.slice(7);
  if (omitted.length) {
    const remaining = omitted.reduce((total, [, chance]) => total + chance, 0);
    visible.push([`${number.format(omitted.length)} others`, remaining]);
  }

  for (const [token, chance] of visible) {
    const row = document.createElement("li");
    const label = document.createElement("span");
    const bar = document.createElement("meter");
    const value = document.createElement("span");
    label.textContent = token;
    bar.max = 1;
    bar.value = chance;
    bar.setAttribute("aria-hidden", "true");
    value.textContent = percentage.format(chance);
    row.append(label, bar, value);
    probabilities.append(row);
  }
}

function updateModelControls() {
  context.disabled = !model;
  sentenceButton.disabled = !model;
  articleButton.disabled = !model;
  renderPrediction();
}

function trainModel() {
  const source = corpus.value.trim();
  const ngram = Number(training.elements.ngram.value);
  const remembered = ngram - 1;
  const sentences = source ? RiTa.sentences(source) : [];
  const tokens = source ? RiTa.tokenize(source) : [];
  model = undefined;
  draftStatus.textContent = "";

  if (tokens.filter((token) => /[\p{L}\p{N}]/u.test(token)).length < ngram) {
    trainingStatus.textContent = "Add more words or choose a smaller n-gram.";
    updateModelControls();
    return;
  }

  try {
    // An n-gram holds the remembered context plus one candidate next token.
    const nextModel = RiTa.markov(ngram, { disableInputChecks: true });
    nextModel.addText(source);
    model = nextModel;
    // Show an example with more than one possible next token when available.
    const firstSentence = RiTa.tokenize(sentences[0]);
    let example = firstSentence.slice(0, remembered);
    for (let end = remembered; end < firstSentence.length; end++) {
      const candidate = firstSentence.slice(end - remembered, end);
      if (Object.keys(model.probabilities(candidate)).length > 1) {
        example = candidate;
        break;
      }
    }
    context.value = RiTa.untokenize(example);
    trainingStatus.textContent = `Trained on ${number.format(tokens.length)} tokens across ${number.format(sentences.length)} ${sentences.length === 1 ? "sentence" : "sentences"}.`;
  } catch {
    model = undefined;
    trainingStatus.textContent =
      "Training failed. Try a shorter passage or a smaller n-gram.";
  }
  updateModelControls();
}

function markUntrained() {
  model = undefined;
  trainingStatus.textContent =
    "Retrain after changing the corpus or n-gram size.";
  draftStatus.textContent = "";
  updateModelControls();
}

function setSourceText(text, message) {
  if (text.length > corpus.maxLength) {
    sourceStatus.textContent =
      "The training corpus can have up to 50,000 characters.";
    return;
  }
  corpus.value = text;
  sourceStatus.textContent = message;
  markUntrained();
  training.dispatchEvent(new Event("change"));
}

function applyPreset(append) {
  fileRequest++;
  const { text, title } =
    markovSources[Number(training.elements["source-preset"].value)];
  const pieces = append ? [corpus.value.trimEnd(), text.trim()] : [text.trim()];
  setSourceText(
    pieces.filter(Boolean).join("\n\n"),
    append ? `Added ${title}.` : `Loaded ${title}.`,
  );
}

async function openSourceFile() {
  const file = sourceFile.files[0];
  const request = ++fileRequest;
  sourceFile.value = "";
  if (!file) return;

  if (!/\.(txt|md)$/i.test(file.name)) {
    sourceStatus.textContent = "Choose a .txt or .md file.";
    return;
  }

  // Bound the read before decoding, then check the actual text length.
  if (file.size > corpus.maxLength * 4) {
    sourceStatus.textContent = "Choose a file with 50,000 characters or fewer.";
    return;
  }

  try {
    const text = await file.text();
    if (request !== fileRequest) return;
    setSourceText(text, `Loaded ${file.name} into the training corpus.`);
  } catch {
    if (request === fileRequest) {
      sourceStatus.textContent =
        "Couldn’t read that file. Try opening it again.";
    }
  }
}

function generateSentence() {
  // Independent samples work with a small source and can repeat source lines.
  return model.generate({
    numSentences: 1,
    minLength: 1,
    maxLength: 100,
    maxAttempts: 20,
  });
}

function appendDraft(paragraphCount) {
  if (!model) return;

  const article = paragraphCount > 1;
  try {
    const paragraphs = Array.from({ length: paragraphCount }, () =>
      Array.from({ length: article ? 3 : 1 }, generateSentence).join(" "),
    );
    const existing = draft.value.trimEnd();
    const separator = article ? "\n\n" : " ";
    draft.value = [existing, paragraphs.join("\n\n")]
      .filter(Boolean)
      .join(separator);
    draftStatus.textContent = article
      ? `Added three paragraphs. ${number.format(draft.value.length)} characters in the draft.`
      : `Added a sentence. ${number.format(draft.value.length)} characters in the draft.`;
  } catch {
    draftStatus.textContent =
      "RiTa couldn’t finish a sentence. Try a different passage or a smaller n-gram.";
  }
}

training.addEventListener("submit", (event) => {
  event.preventDefault();
  trainModel();
});
corpus.addEventListener("input", () => {
  fileRequest++;
  sourceStatus.textContent = "";
  markUntrained();
});
document
  .querySelector("#replace-source")
  .addEventListener("click", () => applyPreset(false));
document
  .querySelector("#add-source")
  .addEventListener("click", () => applyPreset(true));
sourceFile.addEventListener("change", openSourceFile);
training.addEventListener("change", (event) => {
  if (event.target.name === "ngram") markUntrained();
});
context.addEventListener("input", renderPrediction);
sentenceButton.addEventListener("click", () => appendDraft(1));
articleButton.addEventListener("click", () => appendDraft(3));
bindGeneratorExport(
  training,
  () => {
    const source = corpus.value.trim();
    const ngram = Number(training.elements.ngram.value);
    if (
      !source ||
      RiTa.tokenize(source).filter((token) => /[\p{L}\p{N}]/u.test(token))
        .length < ngram
    ) {
      throw new Error(
        "Add more words to the corpus or choose a smaller n-gram.",
      );
    }
    return markovHtml(source, ngram);
  },
  "rita-markov.html",
);
trainModel();
