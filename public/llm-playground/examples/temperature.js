import { ask, text } from "../shared.js";

export async function run(ctx) {
  // teaching:start

  // Keep the message fixed for all three requests.
  const messages = [
    {
      role: "user",
      content: ctx.prompt,
    },
  ];

  const temperatures = ctx.temperatures || [0.1, 0.7, 1.3];

  for (const temperature of temperatures) {
    // Only this setting changes between requests.
    const reply = await ask(ctx, messages, {
      temperature,
    });

    const sample = text(reply);
    const words = sample.trim().split(/\s+/).length;
    ctx.panel?.(
      `Temperature ${temperature} / ${words} words`,
      sample,
    );
  }
  // teaching:end

  return "Run again to compare another sample at each setting.";
}
