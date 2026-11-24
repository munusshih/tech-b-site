// Fictional classroom prices. The model cannot choose the prices.
export const materials = {
  cardboard: { label: "Cardboard sheet", cents: 250 },
  tape: { label: "Tape roll", cents: 400 },
  led: { label: "LED", cents: 50 },
  battery: { label: "Coin-cell battery", cents: 125 },
};
// One item has a known material ID and a whole-number quantity.
const itemSchema = {
  type: "object",
  properties: {
    id: { type: "string", enum: Object.keys(materials) },
    quantity: { type: "integer", minimum: 1, maximum: 100 },
  },
  required: ["id", "quantity"],
  additionalProperties: false,
};

export const tools = [
  {
    type: "function",
    function: {
      name: "calculate_materials",
      description:
        "Calculate an exact materials total using the classroom price list. Extract quantities from the brief; do not invent purchases.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: itemSchema,
          },
        },
        required: ["items"],
        additionalProperties: false,
      },
    },
  },
];
export function calculateCost(items, budget = 20) {
  if (
    !Array.isArray(items) ||
    !items.length ||
    items.length > 4 ||
    !Number.isFinite(budget) ||
    budget < 0 ||
    budget > 10000
  )
    throw new Error(
      "Supply one to four materials and a valid budget.",
    );
  const seen = new Set();
  const lines = items.map(({ id, quantity }) => {
    if (
      !Object.hasOwn(materials, id) ||
      seen.has(id) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100
    )
      throw new Error(
        "Unknown material, repeated item, or invalid quantity.",
      );
    seen.add(id);
    return {
      ...materials[id],
      quantity,
      subtotal: materials[id].cents * quantity,
    };
  });

  // Integer cents avoid rounding errors in the total.
  const total = lines.reduce(
    (sum, line) => sum + line.subtotal,
    0,
  );
  return {
    kind: "budget",
    lines,
    total,
    budget: Math.round(budget * 100),
    remaining: Math.round(budget * 100) - total,
    currency: "USD",

    // These strings prevent the explanation from confusing cents with dollars.
    display: {
      total: `$${(total / 100).toFixed(2)}`,
      budget: `$${budget.toFixed(2)}`,
      difference: `$${(Math.abs(Math.round(budget * 100) - total) / 100).toFixed(2)} ${total > Math.round(budget * 100) ? "over budget" : "remaining"}`,
    },
  };
}
