import { ask, text } from "../shared.js";

import { tools, calculateCost } from "../materials-tool.js";
export {
  tools,
  materials,
  calculateCost,
} from "../materials-tool.js";

export async function run(ctx) {
  const history = [
    {
      role: "system",
      content:
        "Use the tool result display strings for dollar amounts. Other monetary values are integer cents, not dollars. Explain the total briefly.",
    },
    {
      role: "user",
      content: `Price this materials request using calculate_materials. Budget: $${ctx.budget ?? 20}. Explain whether it fits; do not silently change quantities. Request: ${ctx.prompt}`,
    },
  ];
  // teaching:start
  // The model translates the request into item IDs and quantities.
  const reply = await ask(ctx, history, {
    tools,
    tool_choice: {
      type: "function",
      function: { name: "calculate_materials" },
    },
  });
  history.push(reply);
  if (!reply.tool_calls?.length)
    throw new Error(
      "Choose a model that supports tool calling.",
    );
  if (reply.tool_calls.length > 3)
    throw new Error("Tool call limit exceeded.");
  for (const call of reply.tool_calls) {
    if (call.function.name !== "calculate_materials")
      throw new Error("Unapproved tool requested.");
    const args = JSON.parse(call.function.arguments);

    // Our function owns the prices, validation, and arithmetic.
    const result = calculateCost(
      args.items,
      Number(ctx.budget ?? 20),
    );
    ctx.panel?.("Calculated by JavaScript", result);
    history.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(result),
    });
  }

  // The model can now explain a result the program actually calculated.
  return text(await ask(ctx, history));
  // teaching:end
}
