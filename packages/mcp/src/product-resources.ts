import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const repoRoot = resolve(packageRoot, "../..");

function textResource(uri: URL, text: string, mimeType = "text/markdown") {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType,
        text,
      },
    ],
  };
}

const sdkOverview = `# Turtle SDK Overview

Use Turtle as a build-time integration surface for distributors.

Developer prerequisites:
- Turtle organization approved in the Client Portal.
- API key. Publishable keys cover reads; secret keys are server-side only and required for writes.
- Distributor ID from the Distribution section. Earn deposit calls must include it for attribution.

Primary product flows:
- Earn: discover opportunities, generate ready-to-sign deposit/withdrawal transactions, verify attribution.
- Streams: create and inspect points/token reward campaigns.
- Portfolio and activity: inspect wallet positions, wallet activity, distributor deposits, and distributor metrics.

Canonical docs:
- https://docs.turtle.xyz/sdk/overview
- https://docs.turtle.xyz/sdk/earn/quickstart
- https://docs.turtle.xyz/sdk/streams/overview
`;

const earnRecipe = `# Recipe: Turtle Earn Integration

Goal: help a distributor developer ship an attributed deposit flow.

Preferred workflow:
1. Read available opportunities with SDK listOpportunities or getOpportunity in the app/server.
2. Check wallet membership with SDK getMembership.
3. If needed, use SDK createMembershipAgreementV2, ask the wallet to sign the returned message, then submit createMembershipV2.
4. Build the deposit server-side with SDK createDepositInteraction. Always include distributorId in body.
5. Return the ordered transactions array to the app. The user's wallet signs and broadcasts every transaction in order.
6. After the deposit transaction confirms, call SDK verifyTracking with chainId and txHash from the distributor app/server.

Gotchas:
- Amounts are raw integer strings in the token's smallest unit, not human decimals.
- Direct deposits use the opportunity's native deposit token; swap deposits require mode="swap" and slippageBps.
- Async/complex vaults can require claim or cancel follow-up tools.
- The MCP never signs or broadcasts user transactions.
`;

const streamsRecipe = `# Recipe: Streams Campaign Setup

Goal: help a distributor or campaign manager produce a correct Streams config.

Preferred workflow:
1. Use SDK getStreamTokens for rewardTokenId and targetTokenId discovery on the target chain.
2. For point streams, use SDK getStreamPoints for discovery and generate the point creation payload as code/config.
3. Generate a reviewable request body and TypeScript snippet in the distributor app/server.
4. Review timestamps, stream type, token IDs, totalAmount, customArgs, and adapter config.
5. Execute Streams creation from the distributor app/server with the SDK after human approval. The default MCP server does not execute raw Streams writes.

Gotchas:
- Token streams return txParams; a wallet still must finalize the StreamFactory transaction on-chain.
- Point streams can create immediately.
- startTimestamp and endTimestamp should be UTC and aligned to the API's expected boundaries.
`;

const skillGuide = `# Turtle Integration Assistant Skill Guide

The MCP is meant to be a skill vehicle, not only a raw SDK endpoint dump.

When asked to integrate Turtle Earn:
- Start with turtle://recipes/earn-integration.
- Prefer scaffold_earn_integration for project-specific code.
- Use generated SDK code for live data inside the distributor app/server.
- Keep distributorId server-side and include it in every deposit-generation body.

When asked to set up Streams:
- Start with turtle://recipes/streams-campaign.
- Generate reviewable SDK code/config before any production write.
- Do not execute raw Streams writes through the default MCP server.

Docs:
- https://docs.turtle.xyz/sdk/overview
- https://docs.turtle.xyz/sdk/earn/quickstart
- https://docs.turtle.xyz/sdk/streams/create-stream
`;

export function registerProductResources(server: McpServer): void {
  server.registerResource(
    "turtle-sdk-overview",
    "turtle://docs/sdk-overview",
    {
      title: "Turtle SDK Overview",
      description:
        "Integration-oriented overview of Turtle SDK prerequisites and product surfaces.",
      mimeType: "text/markdown",
    },
    (uri) => textResource(uri, sdkOverview),
  );

  server.registerResource(
    "turtle-earn-integration-recipe",
    "turtle://recipes/earn-integration",
    {
      title: "Turtle Earn Integration Recipe",
      description: "Membership to deposit to attribution workflow for distributor integrations.",
      mimeType: "text/markdown",
    },
    (uri) => textResource(uri, earnRecipe),
  );

  server.registerResource(
    "turtle-streams-campaign-recipe",
    "turtle://recipes/streams-campaign",
    {
      title: "Turtle Streams Campaign Recipe",
      description: "Review-first workflow for creating Turtle Streams campaign config.",
      mimeType: "text/markdown",
    },
    (uri) => textResource(uri, streamsRecipe),
  );

  server.registerResource(
    "turtle-integration-assistant-skill",
    "turtle://skills/integration-assistant",
    {
      title: "Turtle Integration Assistant Skill",
      description: "Agent workflow guidance for using Turtle MCP as an integration assistant.",
      mimeType: "text/markdown",
    },
    (uri) => textResource(uri, skillGuide),
  );

  server.registerResource(
    "turtle-openapi-spec",
    "turtle://openapi/spec",
    {
      title: "Turtle OpenAPI Spec",
      description: "The local SDK OpenAPI source used by Turtle Kit code generation.",
      mimeType: "application/json",
    },
    (uri) => {
      try {
        const spec = readFileSync(resolve(repoRoot, "packages/sdk/specs/openapi.v2.json"), "utf8");
        return textResource(uri, spec, "application/json");
      } catch (error) {
        return textResource(
          uri,
          JSON.stringify(
            {
              error: "openapi_spec_unavailable",
              message:
                "The OpenAPI spec is available in the monorepo at packages/sdk/specs/openapi.v2.json.",
              detail: error instanceof Error ? error.message : String(error),
            },
            null,
            2,
          ),
          "application/json",
        );
      }
    },
  );
}
