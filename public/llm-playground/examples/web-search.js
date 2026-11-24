import {
  request,
  searchWikipedia,
  grounded,
} from "../shared.js";

export async function run(ctx) {
  // teaching:start

  // The program searches first; the model does not choose the action.
  const sources =
    ctx.provider === "searxng"
      ? await searchSearx(ctx)
      : await searchWikipedia(ctx.prompt, ctx);

  // The next model request includes those snippets as context.
  return grounded(ctx, sources);
  // teaching:end
}
async function searchSearx(ctx) {
  if (!ctx.local)
    throw new Error(
      "SearXNG needs the downloaded playground and a local search instance.",
    );
  ctx.requested?.("SearXNG");
  const data = await request(
    "/api/searx?q=" + encodeURIComponent(ctx.prompt),
    {
      signal: ctx.signal,
    },
  );

  return (data.results || []).slice(0, 5).map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  }));
}
