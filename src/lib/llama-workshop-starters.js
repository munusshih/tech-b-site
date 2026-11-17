export const llamaSetup = String.raw`// Put this at the top of sketch.js. Load it with <script type="module">.
const base = "http://127.0.0.1:9931/v1"; // Llama App
// For Ollama, change the port above to 11434.
const catalog = await fetch(base + "/models");
if (!catalog.ok) throw new Error("Can’t read the local models.");
const { data: models } = await catalog.json();
// To compare models, replace this with another id from the catalog.
const selected = models.find(item => item.status?.value === "loaded") ?? models[0];
const model = selected?.id;
if (!model) throw new Error("Download a model in the selected app first.");

const parameters = selected.meta?.n_params ?? Number(model.match(/(\d+(?:\.\d+)?)b/i)?.[1] ?? 0) * 1e9;
const large = !parameters || parameters >= 8e9;
// Skip optional reasoning for these interactive sketches.
const localSettings = new URL(base).port === "9931" ? { thinking_budget_tokens: 0 } : {};

async function ask(messages, settings = {}, signal) {
  const { max_tokens = large ? 512 : 192, ...options } = settings;
  const response = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model, messages,
      max_tokens,
      ...localSettings,
      ...options,
    }),
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? response.status);
  return result.choices[0].message;
}

const user = content => ({ role: "user", content });
const json = { response_format: { type: "json_object" } };`;

export const llamaStarters = [
  {
    title: "Set a system message and keep chat history",
    guide:
      "The system message tells the model how to respond. The history array stores each user and assistant message, so the next request carries the earlier conversation. Try writing the messages in another language.",
    code: `const systemMessage = {
  role: "system",
  content: "You are a noir detective. Answer in short, moody sentences and end with a question.",
};
const history = [];

async function chat(text) {
  const turn = user(text);
  const reply = await ask([systemMessage, ...history.slice(-12), turn]);
  history.push(turn, { role: "assistant", content: reply.content });
  return reply.content;
}

console.log(await chat("Someone left the office window open."));
console.log(await chat("Why does that matter?"));`,
  },
  {
    title: "Return structured data",
    guide:
      "Tell the model which values it can choose from and ask for JSON. Then check the reply before you use it. The coloring exercise goes a step further and uses a JSON schema to enforce the format.",
    code: `const availableRegions = ["area-1", "area-2"];
const request = {
  availableRegions,
  instruction: "Choose a color for one available area. Return JSON with region and a hex color like #4a90d9.",
};

const reply = await ask([user(JSON.stringify(request))], json);
const choice = JSON.parse(reply.content);

if (
  !choice ||
  typeof choice !== "object" ||
  Array.isArray(choice) ||
  !availableRegions.includes(choice.region) ||
  !/^#[0-9a-f]{6}$/i.test(choice.color)
) {
  throw new Error("The model returned an unavailable region or color.");
}
console.log("Use", choice.color, "for", choice.region);`,
  },
  {
    title: "Let two speakers talk",
    guide:
      "Give each speaker their own system message and send the conversation so far with each request. Change one system message and compare how the conversation changes.",
    code: String.raw`const speakers = [
  { name: "Writer", systemMessage: "Draft a brief, welcoming event invitation." },
  { name: "Editor", systemMessage: "Check the invitation for clarity and suggest one revision." },
];
const cue = "Prepare an invitation for a neighborhood event.";
const lines = [];

for (let turn = 0; turn < 6; turn++) {
  const speaker = speakers[turn % speakers.length];
  const reply = await ask([
    { role: "system", content: speaker.systemMessage },
    user(cue + "\nConversation so far:\n" + lines.join("\n")),
  ]);
  lines.push(speaker.name + ": " + reply.content);
  console.log(lines.at(-1));
}`,
  },
  {
    title: "Let a model call a game tool",
    guide:
      "Describe a tool and tell the model the current situation. The model proposes a call, and your code checks it, makes the move, and sends the next situation. Replace this toy example with your own p5.js state.",
    code: `const moveTool = {
  type: "function",
  function: {
    name: "move_bird",
    description: "Move up with flap or move down with glide.",
    parameters: {
      type: "object",
      properties: { action: { type: "string", enum: ["flap", "glide"] } },
      required: ["action"],
    },
  },
};

let y = 80; // Lower y means higher on the screen.
const targetY = 50;
for (let turn = 0; turn < 5; turn++) {
  const reply = await ask([user("Move toward targetY: " + JSON.stringify({ y, targetY }))], {
    tools: [moveTool],
    tool_choice: { type: "function", function: { name: "move_bird" } },
  });
  const call = reply.tool_calls?.[0]?.function;
  if (reply.tool_calls?.length !== 1 || call?.name !== "move_bird") break;
  const { action } = JSON.parse(call.arguments);
  if (!["flap", "glide"].includes(action)) break;

  // The model proposes the action. Your sketch decides what it does.
  y += action === "flap" ? -10 : 10;
  console.log({ turn, action, y });
}`,
  },
];
