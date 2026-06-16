import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");

const expectedTools = [
  "list_opportunities",
  "create_deposit_interaction",
  "create_stream",
  "create_stream_point",
  "scaffold_earn_integration",
  "generate_streams_config",
  "check_attribution",
] as const;

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

function runMcpUpdate(): void {
  const result = spawnSync("bun", ["run", "mcp:update"], {
    cwd: packageRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("mcp:update failed before smoke eval.");
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

runMcpUpdate();

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

  const streamsConfig = getRecord(
    parseJsonToolResult(
      await client.callTool({
        name: "generate_streams_config",
        arguments: {
          streamKind: "point",
          streamType: "fixed_apr",
          targetTokenId: "target-token-smoke",
          pointId: "00000000-0000-0000-0000-000000000001",
          startTimestamp: "2026-07-01T00:00:00.000Z",
        },
      }),
    ),
    "generate_streams_config result",
  );
  assert(
    JSON.stringify(streamsConfig).includes("confirm_create_stream"),
    "Streams config must show write guardrail.",
  );

  const streamPreview = getRecord(
    parseJsonToolResult(
      await client.callTool({
        name: "create_stream",
        arguments: {
          body: {
            startTimestamp: "2026-07-01T00:00:00.000Z",
          },
        },
      }),
    ),
    "create_stream preview result",
  );
  assert(streamPreview.testMode === true, "create_stream must preview by default.");
  assert(
    streamPreview.requiredConfirmation === undefined &&
      JSON.stringify(streamPreview).includes("confirm_create_stream"),
    "create_stream preview must explain production confirmation.",
  );

  const pointPreview = getRecord(
    parseJsonToolResult(
      await client.callTool({
        name: "create_stream_point",
        arguments: {
          body: {
            name: "Smoke Eval Points",
            symbol: "SMOKE",
          },
        },
      }),
    ),
    "create_stream_point preview result",
  );
  assert(pointPreview.testMode === true, "create_stream_point must preview by default.");
  assert(
    JSON.stringify(pointPreview).includes("confirm_create_stream_point"),
    "create_stream_point preview must explain production confirmation.",
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
