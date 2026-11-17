// Prefer reported parameter counts. A numeric size in the catalog label is a
// fallback for unloaded models; no model-family names are needed.
export function modelProfile(model) {
  const namedSize = model?.name?.match(
    /(?:^|[-_/:])(\d+(?:\.\d+)?)b(?:[-_/:]|$)/i,
  );
  const parameters = model?.meta?.n_params || Number(namedSize?.[1] ?? 0) * 1e9;
  // Unknown models get the roomier fallback.
  const large = !parameters || parameters >= 8e9;
  return {
    large,
    chatTokens: large ? 512 : 192,
  };
}

export function interactiveSettings(model, outputTokens) {
  const profile = modelProfile(model);
  const finalTokens =
    typeof outputTokens === "number"
      ? outputTokens
      : outputTokens[profile.large ? "large" : "small"];
  // These interactive exercises need the final answer or tool call promptly.
  // Llama ignores this budget when the model has no reasoning channel.
  return {
    max_tokens: finalTokens,
    ...(model.runtime.name === "Llama App"
      ? { thinking_budget_tokens: 0 }
      : {}),
  };
}
