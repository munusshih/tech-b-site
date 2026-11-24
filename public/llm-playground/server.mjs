// Local teaching server: no API keys, paid endpoints, or external dependencies
// for the examples. The MCP client and demo server run in the browser.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname, extname, sep } from "node:path";
import { localBase } from "./shared.js";
const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3213);
const origin = `http://127.0.0.1:${port}`;
async function body(req) {
  let data = "";
  for await (const part of req) {
    data += part;
    if (data.length > 150000) throw new Error("Request too large.");
  }
  return JSON.parse(data || "{}");
}
async function forward(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok)
    throw new Error(
      `Upstream HTTP ${r.status}: ${(await r.text()).slice(0, 500)}`,
    );
  return r.json();
}
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".mjs": "text/javascript",
  ".md": "text/plain",
};
const server = createServer(async (req, res) => {
  const send = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  try {
    // Keep the local proxy available to this application only.
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host))
      return send(403, { error: "Invalid host." });
    if (
      req.headers.origin &&
      ![origin, `http://localhost:${port}`].includes(req.headers.origin)
    )
      return send(403, { error: "Use the local playground origin." });
    const url = new URL(req.url, origin);
    if (url.pathname === "/api/playground")
      return send(200, { localPlayground: true });
    if (url.pathname === "/api/model" && req.method === "POST") {
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return send(415, { error: "JSON required." });
      const input = await body(req);
      const base = localBase(input.base);
      if (
        !["/v1/models", "/v1/chat/completions", "/v1/embeddings"].includes(
          input.path,
        )
      )
        return send(400, { error: "Unsupported model route." });
      return send(
        200,
        await forward(
          base + input.path,
          input.body
            ? {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input.body),
              }
            : {},
        ),
      );
    }
    if (url.pathname === "/api/search") {
      const query = url.searchParams.get("q") || "";
      if (!query.trim() || query.length > 300)
        return send(400, { error: "Query must be 1–300 characters." });
      const upstream = new URL("https://en.wikipedia.org/w/api.php");
      upstream.search = new URLSearchParams({
        action: "query",
        list: "search",
        srsearch: query,
        srlimit: "3",
        format: "json",
      });
      return send(
        200,
        await forward(upstream, {
          headers: {
            "User-Agent":
              "TechBTeachingPlayground/1.0 (local classroom demonstration)",
          },
        }),
      );
    }
    if (url.pathname === "/api/searx") {
      const query = url.searchParams.get("q") || "";
      if (!query.trim() || query.length > 300)
        return send(400, { error: "Query must be 1–300 characters." });
      const upstream = new URL(
        "/search",
        localBase(process.env.SEARXNG_BASE || "http://127.0.0.1:8080"),
      );
      upstream.search = new URLSearchParams({ q: query, format: "json" });
      return send(200, await forward(upstream));
    }
    if (req.method !== "GET")
      return send(405, { error: "Method not allowed." });
    const file = resolve(
      root,
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!file.startsWith(root + sep))
      return send(403, { error: "Path not allowed." });
    let content;
    try {
      content = await readFile(file);
    } catch {
      return send(404, { error: "File not found." });
    }
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
    });
    res.end(content);
  } catch (e) {
    send(502, { error: e.message });
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Workshop 4: Local Chain of Thoughts: ${origin}`),
);
async function close() {
  server.close();
  process.exit(0);
}
process.on("SIGINT", close);
process.on("SIGTERM", close);
