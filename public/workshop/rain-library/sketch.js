// The runtime picker selects the loopback address of Llama App or Ollama.
const runtime = document.querySelector("#runtime");
const form = document.querySelector("#draft-form");
const modelPicker = document.querySelector("#model");
const prompt = document.querySelector("#prompt");
const draft = document.querySelector("#draft");
const statusLine = document.querySelector("#status");
const button = document.querySelector("#generate");

async function callLocalModel(path, options) {
  const response = await fetch(runtime.value + path, options);
  if (!response.ok)
    throw new Error(`The local API returned HTTP ${response.status}.`);
  return response.json();
}

async function loadModels() {
  runtime.disabled = modelPicker.disabled = button.disabled = true;
  modelPicker.replaceChildren();
  statusLine.textContent = "Checking local models…";
  try {
    const { data: models } = await callLocalModel("/models", {
      signal: AbortSignal.timeout(7000),
    });
    for (const { id } of models) modelPicker.add(new Option(id, id));
    modelPicker.disabled = button.disabled = models.length === 0;
    statusLine.textContent = models.length
      ? "Models loaded."
      : "Download a model in the selected app, then reload.";
  } catch {
    statusLine.textContent =
      "Open the selected app, then reload this local preview.";
  } finally {
    runtime.disabled = false;
  }
}

runtime.addEventListener("change", loadModels);
loadModels();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  runtime.disabled = button.disabled = true;
  statusLine.textContent = "Writing…";

  try {
    const result = await callLocalModel("/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelPicker.value,
        messages: [
          {
            role: "system",
            content: "Write brief, welcoming signs for the Rain Library.",
          },
          { role: "user", content: prompt.value },
        ],
        stream: false,
        temperature: 0.6,
        max_tokens: 80,
      }),
    });

    // Keep the model's draft editable so a person can decide what to use.
    draft.value = result.choices[0].message.content.trim();
    statusLine.textContent =
      result.model +
      " (" +
      result.usage.completion_tokens +
      " generated tokens)";
  } catch (error) {
    statusLine.textContent = error.message;
  } finally {
    runtime.disabled = button.disabled = false;
  }
});
