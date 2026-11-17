/* global AbortController, AbortSignal, document */

export function initRoleChat({ complete, getModel }) {
  const settings = document.querySelector("#llama-chat-settings");
  const persona = settings.querySelector("#llama-persona");
  const instructions = settings.querySelector("#llama-system");
  const sliders = [...settings.querySelectorAll('input[type="range"]')];
  const [temperature, topP, limit] = sliders;
  const form = document.querySelector("#llama-chat-form");
  const input = form.querySelector("#llama-user");
  const send = form.querySelector("#llama-send");
  const cancel = form.querySelector("#llama-cancel");
  const reset = document.querySelector("#llama-chat-reset");
  const title = document.querySelector("#llama-chat-persona");
  const scene = document.querySelector("#llama-chat-scene");
  const status = document.querySelector("#llama-chat-status");
  const log = document.querySelector("#llama-chat-log");
  const requestJson = document.querySelector("#llama-request-json");
  const responseJson = document.querySelector("#llama-response-json");
  let history = [];
  let active;

  function profile() {
    return JSON.parse(persona.selectedOptions[0].dataset.persona);
  }

  function update() {
    send.disabled = !getModel() || Boolean(active);
    persona.disabled = Boolean(active);
    instructions.readOnly = Boolean(active);
    cancel.hidden = !active;
    for (const slider of sliders) {
      settings.querySelector(`[data-slider-value="${slider.id}"]`).textContent =
        slider.value;
    }
  }

  function clearChat() {
    const selected = profile();
    const pending = active;
    active = undefined;
    pending?.abort();
    history = [];
    log.replaceChildren();
    input.value = "";
    title.textContent = selected.name;
    scene.textContent = selected.opening;
    requestJson.textContent = "Send a message to see the request.";
    responseJson.textContent = "The model response will appear here.";
    status.textContent = "";
    update();
  }

  function bubble(who, text, type) {
    const item = document.createElement("li");
    item.dataset.speaker = type;
    const name = document.createElement("strong");
    const body = document.createElement("p");
    name.textContent = who;
    body.textContent = text;
    item.append(name, body);
    log.append(item);
    log.scrollTop = log.scrollHeight;
    return item;
  }

  persona.addEventListener("change", () => {
    instructions.value = profile().instructions;
    clearChat();
  });
  settings.addEventListener("input", update);
  reset.addEventListener("click", clearChat);
  cancel.addEventListener("click", () => active?.abort());
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const model = getModel();
    const message = input.value.trim();
    if (active || !model || !message) return;
    const current = new AbortController();
    active = current;
    const selected = profile();
    const user = { role: "user", content: message };
    const body = {
      model: model.name,
      messages: [
        {
          role: "system",
          content:
            instructions.value.trim() ||
            "Respond clearly and briefly to the user's message.",
        },
        ...history.slice(-12),
        user,
      ],
      temperature: temperature.valueAsNumber,
      top_p: topP.valueAsNumber,
      max_tokens: limit.valueAsNumber,
    };
    requestJson.textContent = JSON.stringify(body, null, 2);
    responseJson.textContent = "Waiting for the reply…";
    input.value = "";
    const pending = bubble("You", message, "user");
    status.textContent = `${selected.name} is typing…`;
    update();

    try {
      const data = await complete(
        model,
        body,
        AbortSignal.any([current.signal, AbortSignal.timeout(60000)]),
      );
      if (active !== current) return;
      responseJson.textContent = JSON.stringify(data, null, 2);
      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) throw new Error("The model sent an empty reply.");
      history = [
        ...history.slice(-12),
        user,
        { role: "assistant", content: reply },
      ];
      bubble(selected.name, reply, "assistant");
      status.textContent =
        data.choices[0].finish_reason === "length"
          ? "The reply reached the output token limit."
          : "";
    } catch (error) {
      if (active !== current) return;
      pending.remove();
      if (!input.value) input.value = message;
      if (responseJson.textContent === "Waiting for the reply…") {
        responseJson.textContent = "No response received.";
      }
      status.textContent = current.signal.aborted
        ? "Reply stopped."
        : error.name === "TypeError"
          ? `Couldn’t reach ${model.runtime.name}.`
          : error.message;
    } finally {
      if (active === current) {
        active = undefined;
        update();
      }
    }
  });

  clearChat();
  return update;
}
