/* global AbortController, AbortSignal, clearTimeout, document, setTimeout */

const turnLimit = 8;

// Small models sometimes begin with their own name or wrap a line in quotes.
function cleanLine(text, name) {
  const label = new RegExp(
    `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`,
    "i",
  );
  let line = text.trim();
  while (label.test(line)) line = line.replace(label, "");
  return line.replace(/^["“](.*)["”]$/s, "$1").trim();
}

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

  const nameOf = (index) =>
    speakers[index].nameInput.value.trim() || `Speaker ${index + 1}`;

  function update() {
    preset.disabled = Boolean(run);
    toggle.disabled = !run && !getModel();
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
    const systemMessage = [
      `You are playing ${name} in a conversation with ${otherName}.`,
      instructions,
      cue && `Setting: ${cue}`,
      `Stay in character as ${name} and keep your own point of view. Do not simply agree with ${otherName}, do not repeat earlier lines, and do not write ${otherName}’s lines. Do not start with your name. Write only spoken dialogue, with no stage directions or notes in parentheses.`,
    ]
      .filter(Boolean)
      .join("\n");
    // Each speaker’s earlier lines are assistant messages; the other speaker’s are user messages.
    const messages = [{ role: "system", content: systemMessage }];
    if (index === 0) {
      messages.push({
        role: "user",
        content: `Begin the conversation as ${name} by saying something to ${otherName}.`,
      });
    }
    history.forEach((line, i) => {
      const own = line.index === index;
      const latest = i === history.length - 1;
      // A short reminder on the latest line keeps a small model in its own role.
      messages.push({
        role: own ? "assistant" : "user",
        content:
          !own && latest
            ? `${line.text}\n\n(Reply as ${name} in one to three sentences, responding to something specific ${otherName} said.)`
            : line.text,
      });
    });
    speakers.forEach(({ card }, i) => {
      card.dataset.active = String(i === index);
    });
    status.textContent = `${name} is about to respond…`;
    try {
      const data = await complete(
        current.model,
        {
          messages,
          temperature: 0.75,
          max_tokens: 104,
        },
        AbortSignal.any([
          current.controller.signal,
          AbortSignal.timeout(30000),
        ]),
      );
      if (run !== current) return;
      const content = data.choices?.[0]?.message?.content?.trim() ?? "";
      const reply = cleanLine(content, name);
      inspect.textContent = JSON.stringify(
        { speaker: name, messages, response: data },
        null,
        2,
      );
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
    if (!model) return;
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
  preset.addEventListener("change", () => {
    const selected = JSON.parse(preset.selectedOptions[0].dataset.preset);
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
