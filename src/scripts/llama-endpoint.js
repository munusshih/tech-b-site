/* global URL */
export function normalizeLocalAddress(value) {
  let url;
  try {
    const address = value.trim();
    if (!address) throw new Error();
    url = new URL(address.includes("://") ? address : `http://${address}`);
  } catch {
    throw new Error(
      "Enter a local server address, such as http://localhost:8080.",
    );
  }
  const local =
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(url.hostname);
  const path = url.pathname.replace(/\/+$/, "");
  if (
    !local ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !["", "/v1"].includes(path)
  ) {
    throw new Error(
      "Use an HTTP or HTTPS localhost address, optionally ending in /v1.",
    );
  }
  return url.origin;
}

export function commonLocalAddresses(runtime, entered) {
  const defaults =
    runtime === "ollama"
      ? ["http://127.0.0.1:11434", "http://localhost:11434"]
      : [
          "http://127.0.0.1:9931",
          "http://localhost:9931",
          "http://127.0.0.1:8080",
          "http://localhost:8080",
        ];
  let first = [];
  try {
    first = [normalizeLocalAddress(entered)];
  } catch {
    /* Search defaults when a draft address is invalid. */
  }
  return [...new Set([...first, ...defaults])];
}
