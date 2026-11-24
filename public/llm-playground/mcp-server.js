import {
  Server,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "./mcp-sdk.js";

// This small classroom archive stays in the browser.
const archive = [
  "A: The laser cutter requires an induction. Book a 30-minute slot through the workshop desk.",
  "B: The risograph is available for two-color zines. Bring a print-ready PDF and book through the print technician.",
  "C: The audio booth has microphones and a recorder. Reserve it through the equipment desk; no induction is required.",
];
export function createArchiveServer() {
  const server = new Server(
    { name: "classroom-archive", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  // tools/list tells the client what this server can do.
  server.setRequestHandler(
    ListToolsRequestSchema,
    async () => ({
      tools: [
        {
          name: "search_archive",
          description:
            "Search the fictional studio handbook by keyword. Use one specific equipment keyword, such as risograph.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
            additionalProperties: false,
          },
        },
      ],
    }),
  );

  // tools/call performs the named action and returns MCP content blocks.
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request) => {
      const { name, arguments: args } = request.params;
      if (
        name !== "search_archive" ||
        typeof args?.query !== "string" ||
        !args.query.trim() ||
        args.query.length > 300
      )
        throw new Error(
          "Use search_archive with a nonempty query up to 300 characters.",
        );

      const matches = archive.filter((doc) =>
        doc
          .toLowerCase()
          .includes(args.query.trim().toLowerCase()),
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(matches) },
        ],
      };
    },
  );
  return server;
}
