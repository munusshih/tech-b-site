/* global AbortSignal, document, fetch, localStorage */
import {
  commonLocalAddresses,
  normalizeLocalAddress,
} from "./llama-endpoint.js";
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
const searchButton = document.querySelector("#llama-search");
const connectionStatus = document.querySelector("#llama-connection-status");
const modelPicker = document.querySelector("#llama-model");
const modelDetails = document.querySelector("#llama-model-details");
let installedModels = new Map();
const addresses = new Map();
for (const [key, runtime] of Object.entries(runtimes)) {
  let address = runtime.endpoint;
  try {
    const saved = localStorage.getItem(`workshop.local-address.${key}`);
    if (saved) address = normalizeLocalAddress(saved);
  } catch {
    /* Storage can be unavailable or contain an old invalid address. */
  }
  addresses.set(key, address);
}
runtimeAddress.value = addresses.get(runtimePicker.value);

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

function resetConnection(message) {
  connectionStatus.textContent = message;
  runtimeAddress.removeAttribute("aria-invalid");
  setModels([], "", "Connect to load your models");
}

runtimePicker.addEventListener("change", () => {
  runtimeAddress.value = addresses.get(runtimePicker.value);
  resetConnection(
    `Open ${runtimes[runtimePicker.value].name}, then find models.`,
  );
});

runtimeAddress.addEventListener("input", () => {
  addresses.set(runtimePicker.value, runtimeAddress.value);
  resetConnection("Address changed. Find models to connect.");
});

async function findModels(searchCommonPorts) {
  const key = runtimePicker.value;
  const app = runtimes[key];
  const previous = modelPicker.value;
  let endpoints;
  try {
    endpoints = searchCommonPorts
      ? commonLocalAddresses(key, runtimeAddress.value)
      : [normalizeLocalAddress(runtimeAddress.value)];
  } catch (error) {
    resetConnection(error.message);
    runtimeAddress.setAttribute("aria-invalid", "true");
    return;
  }
  for (const control of [
    findButton,
    searchButton,
    runtimePicker,
    runtimeAddress,
  ])
    control.disabled = true;
  setModels([], "", "Checking for models…");

  try {
    let failure;
    for (const endpoint of endpoints) {
      const runtime = { ...app, endpoint };
      connectionStatus.textContent = `Looking for ${app.name} at ${endpoint}…`;
      try {
        const data = await readLocal(runtime, "/v1/models", {
          signal: AbortSignal.timeout(searchCommonPorts ? 2000 : 7000),
        });
        if (!Array.isArray(data.data))
          throw new Error(`${app.name} didn’t return a model list.`);
        const models = data.data
          .filter((model) => typeof model?.id === "string" && model.id)
          .map((model) => ({ ...model, name: model.id, runtime }));
        runtimeAddress.value = endpoint;
        runtimeAddress.removeAttribute("aria-invalid");
        addresses.set(key, endpoint);
        try {
          localStorage.setItem(`workshop.local-address.${key}`, endpoint);
        } catch {
          /* Remembering an address is optional. */
        }
        setModels(models, previous, "No local models found");
        const count = installedModels.size;
        connectionStatus.textContent = count
          ? `Found ${count} local ${count === 1 ? "model" : "models"} at ${endpoint}.`
          : `${app.name} is running at ${endpoint}. Download a local model in the app, then try again.`;
        return;
      } catch (error) {
        failure = error;
      }
    }
    throw failure;
  } catch (error) {
    setModels([], "", "Connection unavailable");
    connectionStatus.textContent = searchCommonPorts
      ? `No model server found at ${endpoints.join(", ")}. Copy the server address from ${app.name} and try Find models. See Connection help.`
      : error.name === "TypeError" || error.name === "TimeoutError"
        ? `Couldn’t reach ${app.name} at ${endpoints[0]}. Check the address or try common ports. See Connection help.`
        : `${error.message} See Connection help.`;
  } finally {
    for (const control of [
      findButton,
      searchButton,
      runtimePicker,
      runtimeAddress,
    ])
      control.disabled = false;
  }
}

findButton.addEventListener("click", () => findModels(false));
searchButton.addEventListener("click", () => findModels(true));
