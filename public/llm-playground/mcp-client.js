import { Client, InMemoryTransport } from "./mcp-sdk.js";
import { createArchiveServer } from "./mcp-server.js";

export async function connectArchive(trace = () => {}) {
  // The linked transport carries real MCP JSON-RPC messages in this browser.
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  for (const [transport, label] of [
    [clientTransport, "MCP client → server"],
    [serverTransport, "MCP server → client"],
  ]) {
    const send = transport.send.bind(transport);
    transport.send = async (...args) => {
      trace(label, args[0]);
      return send(...args);
    };
  }
  const server = createArchiveServer();
  const client = new Client({
    name: "browser-playground",
    version: "1.0.0",
  });

  // connect() performs MCP initialization before discovery or tool calls.
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  } catch (error) {
    await Promise.allSettled([client.close(), server.close()]);
    throw error;
  }
  return { client, close: () => client.close() };
}

export async function discoverArchive(trace, signal) {
  const session = await connectArchive(trace);
  try {
    return await session.client.listTools(undefined, {
      signal,
    });
  } finally {
    await session.close();
  }
}
