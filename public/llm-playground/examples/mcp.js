import { toolLoop } from "../shared.js";
import { connectArchive } from "../mcp-client.js";

export async function run(ctx) {
  // Both the client and demo server run here, without a terminal or API key.
  const session = await connectArchive(ctx.trace);
  const { client } = session;
  try {
    // Ask the server to describe its tools using the MCP tools/list request.
    const discovered = await client.listTools(undefined, {
      signal: ctx.signal,
    });
    ctx.trace("MCP tools/list", discovered);

    // The model sees the discovered definition, not a hand-written tool list.
    const tools = discovered.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    // Route the model's tool request through MCP tools/call.
    return await toolLoop(ctx, 1, tools, async (name, args) => {
      const result = await client.callTool(
        { name, arguments: args },
        undefined,
        { signal: ctx.signal },
      );
      if (result.isError)
        throw new Error(
          "The MCP server could not complete this tool call.",
        );
      const text = result.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("\n");
      const matches = JSON.parse(text);
      ctx.panel?.(
        "Returned by the archive tool",
        matches.map((content) => ({ content })),
      );
      return result;
    });
  } finally {
    await session.close();
  }
}
