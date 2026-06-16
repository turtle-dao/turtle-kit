import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerProductResources } from "./product-resources.js";
import { registerProductTools } from "./product-tools.js";

const server = new McpServer({
  name: "turtle-mcp",
  version: "0.0.0",
  description: "Turtle integration assistant for Earn and Streams distributor workflows.",
});

registerProductTools(server);
registerProductResources(server);

const transport = new StdioServerTransport();
await server.connect(transport);
