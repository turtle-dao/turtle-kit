import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");

const expectedTools = ["scaffold_earn_integration"] as const;

const expectedResources = [
  "turtle://docs/sdk-overview",
  "turtle://recipes/earn-integration",
  "turtle://recipes/streams-campaign",
  "turtle://skills/integration-assistant",
  "turtle://openapi/spec",
] as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function getArray(value: unknown, label: string): unknown[] {
  assert(Array.isArray(value), `${label} is not an array.`);
  return value;
}

function textContent(result: unknown): string {
  const record = getRecord(result, "MCP tool result");
  const content = getArray(record.content, "MCP tool result content");
  const firstText = content
    .map((item) => getRecord(item, "MCP content item"))
    .find((item) => item.type === "text");

  assert(firstText, "Expected text content in MCP tool result.");
  return getString(firstText.text, "MCP text content");
}

function parseJsonToolResult(result: unknown): unknown {
  return JSON.parse(textContent(result));
}

function getRecord(value: unknown, label: string): Record<string, unknown> {
  assert(
    typeof value === "object" && value !== null && !Array.isArray(value),
    `${label} is not an object.`,
  );
  return value as Record<string, unknown>;
}

function getString(value: unknown, label: string): string {
  assert(typeof value === "string", `${label} is not a string.`);
  return value;
}

function readTextResource(result: unknown): string {
  const record = getRecord(result, "MCP resource result");
  const contents = getArray(record.contents, "MCP resource contents");
  const first = getRecord(contents[0], "MCP resource content");

  return getString(first.text, "MCP resource text");
}

const transport = new StdioClientTransport({
  command: "bun",
  args: ["run", "src/index.ts"],
  cwd: packageRoot,
  stderr: "pipe",
});

const client = new Client({
  name: "turtle-mcp-smoke-eval",
  version: "0.0.0",
});

try {
  await client.connect(transport);

  const tools = await client.listTools();
  const toolNames = new Set(tools.tools.map((tool) => tool.name));
  for (const tool of expectedTools) {
    assert(toolNames.has(tool), `Missing expected tool: ${tool}`);
  }
  assert(
    !toolNames.has("create_stream"),
    "Raw SDK write tool should not be registered by default.",
  );
  assert(
    !toolNames.has("create_deposit_interaction"),
    "Raw SDK deposit tool should not be registered by default.",
  );
  assert(
    !toolNames.has("generate_streams_config"),
    "Streams config should be a resource/workflow, not a tool.",
  );
  assert(
    !toolNames.has("check_attribution"),
    "Attribution checking should be generated integration code, not a tool.",
  );

  const resources = await client.listResources();
  const resourceUris = new Set(resources.resources.map((resource) => resource.uri));
  for (const resource of expectedResources) {
    assert(resourceUris.has(resource), `Missing expected resource: ${resource}`);
  }

  const earnRecipe = await client.readResource({
    uri: "turtle://recipes/earn-integration",
  });
  const earnRecipeText = readTextResource(earnRecipe);
  assert(earnRecipeText.includes("distributorId"), "Earn recipe must mention distributorId.");
  assert(
    earnRecipeText.includes("wallet signs"),
    "Earn recipe must keep wallet signing outside the MCP.",
  );

  const scaffold = getRecord(
    parseJsonToolResult(
      await client.callTool({
        name: "scaffold_earn_integration",
        arguments: {
          distributorId: "dist_smoke_eval",
          stack: "nextjs",
        },
      }),
    ),
    "scaffold_earn_integration result",
  );
  const scaffoldText = JSON.stringify(scaffold);
  assert(scaffoldText.includes("dist_smoke_eval"), "Scaffold must bake in the distributor ID.");
  assert(
    scaffoldText.includes("createDepositInteraction"),
    "Scaffold must include deposit generation.",
  );
  assert(
    scaffoldText.includes("verifyTracking"),
    "Scaffold must include attribution verification.",
  );

  const streamsRecipe = await client.readResource({
    uri: "turtle://recipes/streams-campaign",
  });
  const streamsRecipeText = readTextResource(streamsRecipe);
  assert(
    streamsRecipeText.includes("does not execute raw Streams writes"),
    "Streams recipe must keep production writes outside default MCP tools.",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        toolCount: tools.tools.length,
        resourceCount: resources.resources.length,
        checkedTools: expectedTools,
        checkedResources: expectedResources,
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
