import { ask, text } from "../shared.js";

export async function run(ctx) {
  // teaching:start
  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      date: { type: "string" },
      time: { type: "string" },
      location: { type: "string" },
    },
    required: ["title", "date", "time", "location"],
    additionalProperties: false,
  };
  // teaching:end
  const instructions = [
    "Extract the event title, date, time, and location.",
    "Keep date and time as written; do not infer a year.",
    "Use an empty string for missing details.",
    "Do not invent details.",
  ].join(" ");
  const messages = [
    {
      role: "system",
      content: instructions,
    },
    {
      role: "user",
      content: ctx.prompt,
    },
  ];
  const prose = text(await ask(ctx, messages));

  ctx.panel?.("Ordinary text", prose);
  // teaching:start

  // Same task, but now constrain the answer to named JSON fields.
  const reply = await ask(ctx, messages, {
    response_format: {
      type: "json_schema",
      json_schema: { name: "event", strict: true, schema },
    },
  });
  const data = JSON.parse(text(reply));

  // Valid JSON still needs the application's field checks.
  if (
    !data ||
    ["title", "date", "time", "location"].some(
      (key) => typeof data[key] !== "string",
    ) ||
    Object.keys(data).some(
      (k) => !["title", "date", "time", "location"].includes(k),
    )
  ) {
    throw new Error(
      "Response failed validation. Check the raw response in the request log.",
    );
  }
  // teaching:end
  ctx.trace("Validated object", data);

  return data;
}
