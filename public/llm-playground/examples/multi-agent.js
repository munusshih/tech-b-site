import { ask, text } from "../shared.js";

import { roleInstructions as roles } from "../roles.js";
export { roleInstructions as roles } from "../roles.js";

// Named fields keep each handoff focused and easy to inspect.
async function requestRole(ctx, role, input, fields) {
  const instructions = ctx[role] || roles[role];
  const schema = {
    type: "object",
    properties: Object.fromEntries(
      fields.map((field) => [field, { type: "string" }]),
    ),
    required: fields,
    additionalProperties: false,
  };
  const reply = await ask(
    ctx,
    [
      { role: "system", content: instructions },
      {
        role: "user",
        content: `${input}\n\nYour task: ${instructions} Keep each field to one or two short sentences.`,
      },
    ],
    {
      temperature: 0.2,
      max_tokens: 500,
      response_format: {
        type: "json_schema",
        json_schema: { name: role, strict: true, schema },
      },
    },
  );
  const result = JSON.parse(text(reply));
  if (
    !result ||
    fields.some((field) => typeof result[field] !== "string")
  )
    throw new Error(
      `The ${role} response did not match its handoff fields.`,
    );
  return result;
}
const show = (values, labels) =>
  Object.entries(values)
    .map(
      ([key, value]) => `**${labels[key] || key}:** ${value}`,
    )
    .join("\n\n");
export async function run(ctx) {
  // teaching:start
  const draft = await requestRole(ctx, "writer", ctx.prompt, [
    "materials",
    "setup",
    "visitorAction",
  ]);
  ctx.panel?.(
    "1. Designer’s proposal",
    show(draft, {
      materials: "Materials",
      setup: "Setup",
      visitorAction: "Visitor action",
    }),
  );
  const reviewInput = `Brief: ${ctx.prompt}\nProposal: ${JSON.stringify(draft)}`;

  // Neither specialist sees the other specialist's review.
  const [access, fabrication] = await Promise.all([
    requestRole(ctx, "critic", reviewInput, [
      "issue",
      "change",
    ]),
    requestRole(ctx, "fabricator", reviewInput, [
      "issue",
      "change",
    ]),
  ]);
  ctx.panel?.(
    "2. Accessibility review",
    show(access, {
      issue: "Barrier",
      change: "Suggested change",
    }),
  );
  ctx.panel?.(
    "3. Fabrication review",
    show(fabrication, {
      issue: "Failure point",
      change: "Suggested change",
    }),
  );

  // The producer receives the draft and BOTH independent reviews.
  const plan = await requestRole(
    ctx,
    "editor",
    `${reviewInput}\nAccessibility review: ${JSON.stringify(access)}\nFabrication review: ${JSON.stringify(fabrication)}`,
    [
      "build",
      "visitorAction",
      "fromAccessibility",
      "fromFabrication",
      "needsTesting",
    ],
  );
  return show(plan, {
    build: "Build plan",
    visitorAction: "Visitor action",
    fromAccessibility: "From accessibility review",
    fromFabrication: "From fabrication review",
    needsTesting: "Still needs testing",
  });
  // teaching:end
}
