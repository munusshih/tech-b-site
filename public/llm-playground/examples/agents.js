import { ask, text } from "../shared.js";

import { stations, checkLayout } from "../layout-checker.js";
export { stations, checkLayout } from "../layout-checker.js";

const layoutSchema = {
  type: "object",
  properties: {
    placements: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            enum: Object.keys(stations),
          },
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["id", "x", "y"],
        additionalProperties: false,
      },
    },
  },
  required: ["placements"],
  additionalProperties: false,
};
export async function run(ctx) {
  const rounds = Number(ctx.rounds ?? 3);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 3)
    throw new Error("Choose one to three tool rounds.");
  const history = [
    {
      role: "system",
      content:
        "You arrange a toy exhibition floor. First test the starting positions from the brief. On later turns, use the checker's issues to revise the coordinates. Return positions as JSON for our checker. Never claim a plan works without a successful check. Preserve all three stations. The room is 8 wide and 6 high. Listening is 2×2; table is 3×2; wall is 2×1. No overlap or out-of-bounds; keep x=0..2,y=0..2 clear. Touching edges is allowed. This is a toy geometry check.",
    },
    { role: "user", content: ctx.prompt },
  ];
  // teaching:start
  let checked;
  for (let round = 0; round < rounds; round++) {
    // Every turn includes the previous check and its concrete errors.
    const reply = await ask(ctx, history, {
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "layout",
          strict: true,
          schema: layoutSchema,
        },
      },
    });
    history.push(reply);

    // A constrained action payload works with models that lack repeated tool calls.
    const action = JSON.parse(text(reply));
    checked = checkLayout(action.placements);
    ctx.panel?.(
      `Round ${round + 1}: ${checked.valid ? "passes" : "needs revision"}`,
      checked,
    );
    history.push({
      role: "user",
      content: `Checker result: ${JSON.stringify(checked)}. If it failed, move the stations to fix every listed issue and submit new coordinates.`,
    });

    // Stop early when the checker passes, otherwise give the model another turn.
    if (checked.valid) break;
  }
  // teaching:end
  const report = text(
    await ask(ctx, [
      ...history,
      {
        role: "user",
        content:
          "No more tool calls. In two sentences, describe the last checked layout and whether the checker passed. If it failed, say which issues remain. Do not propose untested coordinates.",
      },
    ]),
  );
  return `${checked.valid ? "**Checker passed.**" : "**Round limit reached; layout still fails.**"}\n\n${report}`;
}
