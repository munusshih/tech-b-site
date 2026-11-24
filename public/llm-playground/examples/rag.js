import {
  documents,
  keywords,
  semantic,
  grounded,
} from "../shared.js";

export async function run(ctx) {
  // teaching:start
  const archive = documents(ctx.documents);
  const method = ctx.retrieval || "keyword";
  if (!["keyword", "semantic", "compare"].includes(method))
    throw new Error(
      "Choose keyword, semantic, or compare retrieval.",
    );

  // Only semantic retrieval needs a separate embedding model.
  const wordMatches = keywords(ctx.prompt, archive);
  const meaningMatches =
    method === "keyword"
      ? null
      : (await semantic(ctx, archive)).slice(0, 3);
  if (method !== "semantic")
    ctx.panel?.("Keyword matches", wordMatches);
  if (meaningMatches)
    ctx.panel?.("Meaning matches", meaningMatches);

  // Retrieval chooses sources; the chat model writes from those sources.
  const selected = meaningMatches || wordMatches;
  return grounded(ctx, selected);
  // teaching:end
}
