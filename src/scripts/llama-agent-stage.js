/* global AbortController, AbortSignal, clearTimeout, document, setTimeout */
import { interactiveSettings, modelProfile } from "./llama-generation.js";
import { stageMessages } from "./llama-instructions.js";

const turnLimit = 8;

export function initAgentStage({ complete, getModel }) {
  const root = document.querySelector("#llama-stage");
  const direction = root.querySelector("#stage-direction");
  const toggle = root.querySelector("#stage-toggle");
  const reset = root.querySelector("#stage-reset");
  const status = root.querySelector("#stage-status");
  const log = root.querySelector("#stage-dialogue");
  const inspect = root.querySelector("#stage-json");
  const preset = root.querySelector("#stage-preset");
  const speakers = [...root.querySelectorAll("[data-actor]")].map((card) => ({
    card,
    nameInput: card.querySelector("input"),
    instructions: card.querySelector("textarea"),
  }));
  let run;
  let timer;
  let history = [];
  let selectedPreset = preset.value;
  const sceneDrafts = new Map();

  const nameOf = (index) =>
    speakers[index].nameInput.value.trim() || `Speaker ${index + 1}`;

  function update() {
    if (run && run.model !== getModel()) {
      clearScene();
      status.textContent = "Model changed. Start a new conversation.";
      return;
    }
    const missingRole = speakers.some(
      ({ instructions }) => !instructions.value.trim(),
    );
    preset.disabled = Boolean(run);
    toggle.disabled = !run && (!getModel() || missingRole);
    toggle.textContent = run
      ? "Pause conversation"
      : history.length && history.length < turnLimit
        ? "Resume conversation"
        : "Start conversation";
  }

  function stop(message) {
    clearTimeout(timer);
    run?.controller.abort();
    run = undefined;
    status.textContent = message;
    for (const { card } of speakers) card.dataset.active = "false";
    update();
  }

  function clearScene() {
    stop("Ready for the first line.");
    history = [];
    log.replaceChildren();
    inspect.textContent =
      "The latest speaker’s request and response will appear here.";
    update();
  }

  function appendLine(index, name, text) {
    const item = document.createElement("li");
    item.dataset.speaker = String(index);
    const speaker = document.createElement("strong");
    speaker.textContent = name;
    const line = document.createElement("p");
    line.textContent = text;
    item.append(speaker, line);
    log.append(item);
    log.scrollTop = log.scrollHeight;
  }

  async function next(current) {
    const index = history.length % 2;
    const speaker = speakers[index];
    const name = nameOf(index);
    const otherName = nameOf(1 - index);
    const cue = direction.value.trim();
    const instructions = speaker.instructions.value.trim();
    const messages = stageMessages({
      name,
      otherName,
      instructions,
      cue,
      history,
      index,
      compact: !modelProfile(current.model).large,
    });
    speakers.forEach(({ card }, i) => {
      card.dataset.active = String(i === index);
    });
    status.textContent = `${name} is about to respond…`;
    try {
      const request = {
        ...interactiveSettings(current.model, { small: 256, large: 512 }),
        messages,
        temperature: 0.7,
      };
      const data = await complete(
        current.model,
        request,
        AbortSignal.any([
          current.controller.signal,
          AbortSignal.timeout(120000),
        ]),
      );
      if (run !== current) return;
      inspect.textContent = JSON.stringify(
        { speaker: name, request, response: data },
        null,
        2,
      );
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) throw new Error("The speaker returned no response.");
      history.push({ index, text: reply });
      appendLine(index, name, reply);
      if (history.length >= turnLimit) {
        stop("Conversation complete.");
        return;
      }
      status.textContent = `${history.length} of ${turnLimit} lines.`;
      timer = setTimeout(() => next(current), 650);
    } catch (error) {
      if (run !== current) return;
      stop(
        `Conversation paused. ${error.name === "TimeoutError" ? "The request took too long." : error.message}`,
      );
    }
  }

  toggle.addEventListener("click", () => {
    if (run) {
      stop("Conversation paused.");
      return;
    }
    const model = getModel();
    if (
      !model ||
      speakers.some(({ instructions }) => !instructions.value.trim())
    )
      return;
    if (history.length === turnLimit) {
      history = [];
      log.replaceChildren();
    }
    run = {
      model,
      controller: new AbortController(),
    };
    update();
    next(run);
  });
  reset.addEventListener("click", clearScene);
  for (const field of [
    direction,
    ...speakers.flatMap(({ nameInput, instructions }) => [
      nameInput,
      instructions,
    ]),
  ]) {
    field.addEventListener("input", () => {
      clearScene();
      status.textContent =
        "Roles or setting updated. Start a new conversation.";
    });
  }
  preset.addEventListener("change", () => {
    sceneDrafts.set(selectedPreset, {
      context: direction.value,
      speakers: speakers.map(({ nameInput, instructions }) => ({
        name: nameInput.value,
        instructions: instructions.value,
      })),
    });
    selectedPreset = preset.value;
    const selected =
      sceneDrafts.get(selectedPreset) ??
      JSON.parse(preset.selectedOptions[0].dataset.preset);
    selected.speakers.forEach((speaker, i) => {
      speakers[i].nameInput.value = speaker.name;
      speakers[i].instructions.value = speaker.instructions;
    });
    direction.value = selected.context;
    clearScene();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && run)
      stop("Conversation paused while this tab was hidden.");
  });
  clearScene();
  return update;
}
