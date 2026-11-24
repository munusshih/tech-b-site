// A role is a different instruction, not a different model.
export const roles = {
  writer: "Design the first physical token-voting proposal.",
  critic:
    "Find a participation barrier and propose an accessible alternative.",
  fabricator:
    "Find a construction or supply problem and propose a practical fix.",
  editor:
    "Revise the draft using both reviews and identify the remaining tradeoff.",
};

// Reference notes and constraints give each reviewer its own context.
const roleNotes = {
  writer:
    "Describe a concrete first proposal using only cups, tokens, cardboard, and a table. Include a visitor action. Under 70 words. No phones, QR codes, or writing by visitors.",
  critic:
    "Your reference notes: color alone cannot identify choices for everyone; distinct shapes, raised symbols, and reachable surfaces can help. Find ONE barrier in the proposal and suggest ONE change using these notes. Do not recommend adding more colors or color-only labels. Keep physical token voting. No phones or writing. Under 70 words.",
  fabricator:
    "Your reference notes: lightweight cups can tip when tokens land; tape or a cardboard holder can keep them stable; token supplies need a refill plan. Find ONE construction or operation problem and suggest ONE cheap physical fix. Review stability or supplies only; accessibility is handled by a different reviewer. Do not invent prices. Under 70 words.",
  editor:
    "Use BOTH specialist reviews to revise the token-voting proposal. Use four short parts: Build; Visitor action; Change from each reviewer; Still needs testing. No phones, QR codes, or writing by visitors. Under 150 words.",
};

export const roleInstructions = Object.fromEntries(
  Object.entries(roles).map(([role, goal]) => [
    role,
    [goal, roleNotes[role]].join(" "),
  ]),
);
