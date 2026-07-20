import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerProductResources } from "./product-resources.js";
import { registerProductTools } from "./product-tools.js";

// Both src/ and dist/ sit one level below the package root, so ../package.json
// resolves correctly in dev and in the published tarball.
const pkg = createRequire(import.meta.url)("../package.json") as { version: string };

const server = new McpServer({
  name: "turtle-mcp",
  version: pkg.version,
  description: "Turtle integration assistant for Earn and Streams distributor workflows.",
});

registerProductTools(server);
registerProductResources(server);

const transport = new StdioServerTransport();
await server.connect(transport);
