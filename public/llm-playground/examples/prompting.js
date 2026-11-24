import { ask, text } from "../shared.js";

export async function run(ctx) {
  // teaching:start
  const message = {
    role: "user",
    content: ctx.prompt,
  };

  // Same message and temperature, without the role.
  const plain = text(await ask(ctx, [message]));

  ctx.panel?.("Without instructions", plain);

  // This request adds only the system instructions.
  const instructed = await ask(ctx, [
    {
      role: "system",
      content: ctx.instructions,
    },
    message,
  ]);

  return text(instructed);
  // teaching:end
}
