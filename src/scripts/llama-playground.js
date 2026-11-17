/* global AbortSignal, document, fetch */
import { initBirdGame } from "./llama-bird-game.js";
import { initRoleChat } from "./llama-role-chat.js";
import { initColoringGame } from "./llama-coloring-game.js";
import { initAgentStage } from "./llama-agent-stage.js";

const runtimes = {
  llama: { name: "Llama App", endpoint: "http://127.0.0.1:9931" },
  ollama: { name: "Ollama", endpoint: "http://127.0.0.1:11434" },
};
const runtimePicker = document.querySelector("#llama-runtime");
const runtimeAddress = document.querySelector("#llama-runtime-address");
const findButton = document.querySelector("#llama-find");
const connectionStatus = document.querySelector("#llama-connection-status");
const modelPicker = document.querySelector("#llama-model");
const modelDetails = document.querySelector("#llama-model-details");
let installedModels = new Map();

async function readLocal(runtime, path, options) {
  const response = await fetch(runtime.endpoint + path, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        (typeof data?.error === "string" && data.error) ||
        `${runtime.name} returned HTTP ${response.status}.`,
    );
  }
  if (!data || typeof data !== "object") {
    throw new Error(`${runtime.name} returned a response that wasn’t JSON.`);
  }
  return data;
}

function complete(model, body, signal) {
  return readLocal(model.runtime, "/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, model: model.name }),
    signal,
  });
}

const getModel = () => installedModels.get(modelPicker.value);
const updateDemos = [
  initBirdGame({ complete, getModel }),
  initRoleChat({ complete, getModel }),
  initColoringGame({ complete, getModel }),
  initAgentStage({ complete, getModel }),
];

function updateSelectedModel() {
  const model = installedModels.get(modelPicker.value);
  const metadata = [];
  if (model?.meta?.n_params > 0) {
    metadata.push(`${(model.meta.n_params / 1e9).toFixed(2)}B parameters`);
  }
  if (model?.meta?.n_ctx_train > 0) {
    metadata.push(
      `${model.meta.n_ctx_train.toLocaleString()} training context tokens`,
    );
  }
  if (model?.meta?.size > 0) {
    metadata.push(`${(model.meta.size / 1e9).toFixed(2)} GB on disk`);
  }
  modelDetails.textContent = metadata.join(" / ");
  modelDetails.hidden = metadata.length === 0;
  for (const update of updateDemos) update();
}

modelPicker.addEventListener("change", updateSelectedModel);

function setModels(models, previous, fallbackLabel) {
  installedModels = new Map(models.map((model) => [model.name, model]));
  const names = [...installedModels.keys()];
  const options = (names.length ? names : [""]).map((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name || fallbackLabel;
    return option;
  });
  modelPicker.replaceChildren(...options);
  if (names.includes(previous)) {
    modelPicker.value = previous;
  }
  modelPicker.disabled = names.length === 0;
  updateSelectedModel();
}

runtimePicker.addEventListener("change", () => {
  const runtime = runtimes[runtimePicker.value];
  runtimeAddress.textContent = runtime.endpoint;
  connectionStatus.textContent = `Open ${runtime.name}, then find models.`;
  setModels([], "", "Connect to load your models");
});

findButton.addEventListener("click", async () => {
  const runtime = runtimes[runtimePicker.value];
  const previous = modelPicker.value;
  findButton.disabled = true;
  runtimePicker.disabled = true;
  connectionStatus.textContent = `Looking for ${runtime.name}…`;
  setModels([], "", "Checking for models…");

  try {
    const data = await readLocal(runtime, "/v1/models", {
      signal: AbortSignal.timeout(7000),
    });
    if (!Array.isArray(data.data))
      throw new Error(`${runtime.name} didn’t return a model list.`);
    const models = data.data
      .filter((model) => typeof model?.id === "string" && model.id)
      .map((model) => ({ ...model, name: model.id, runtime }));
    setModels(models, previous, "No local models found");
    const count = installedModels.size;
    connectionStatus.textContent = count
      ? `Found ${count} local ${count === 1 ? "model" : "models"}.`
      : `${runtime.name} is running. Download a local model in the app, then try again.`;
  } catch (error) {
    setModels([], "", "Connection unavailable");
    connectionStatus.textContent =
      error.name === "TypeError" || error.name === "TimeoutError"
        ? `Couldn’t reach ${runtime.name}. Check that the app is open and see Connection help.`
        : `${error.message} See Connection help.`;
  } finally {
    findButton.disabled = false;
    runtimePicker.disabled = false;
  }
});
