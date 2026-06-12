import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGeneratedTools } from "./generated/tools.js";

const server = new McpServer({
  name: "turtle-mcp",
  version: "0.0.0",
  description: "SDK-derived MCP server for Turtle Earn API operations exposed by @turtlexyz/sdk.",
});

registerGeneratedTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
