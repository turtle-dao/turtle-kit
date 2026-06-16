import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatJsonResult } from "./format-result.js";

const stackSchema = z.enum(["nextjs", "react", "node"]);

const scaffoldEarnIntegrationInputSchema = z.object({
  distributorId: z.string().min(1),
  stack: stackSchema.default("nextjs"),
  apiKeyEnvVar: z.string().default("TURTLE_API_KEY"),
  baseUrlEnvVar: z.string().default("TURTLE_BASE_URL"),
  includeMembershipFlow: z.boolean().default(true),
});

function renderServerSdkClient(
  distributorId: string,
  apiKeyEnvVar: string,
  baseUrlEnvVar: string,
): string {
  return `import { createDepositInteraction, getMembership, listOpportunities, verifyTracking } from "@turtlexyz/sdk";

const apiKey = process.env.${apiKeyEnvVar};
export const turtleBaseUrl = process.env.${baseUrlEnvVar} ?? "https://earn.turtle.xyz";
export const turtleDistributorId = "${distributorId}";

if (!apiKey) {
  throw new Error("${apiKeyEnvVar} is required");
}

export async function listEarnOpportunities() {
  return listOpportunities({
    query: {
      page: 1,
      limit: 20,
    },
  });
}

export async function getTurtleMembership(walletAddress: string) {
  return getMembership({
    query: {
      address: walletAddress,
      walletEcosystem: "evm",
    },
  });
}

export async function buildDeposit(params: {
  opportunityId: string;
  walletAddress: string;
  tokenIn: string;
  amount: string;
}) {
  return createDepositInteraction({
    path: {
      opportunityId: params.opportunityId,
    },
    body: {
      userAddress: params.walletAddress,
      tokenIn: params.tokenIn,
      amount: params.amount,
      distributorId: turtleDistributorId,
      mode: "direct",
    },
  });
}

export async function verifyDepositAttribution(params: {
  chainId: number;
  txHash: string;
}) {
  return verifyTracking({
    query: {
      chainId: params.chainId,
      txHash: params.txHash,
    },
  });
}`;
}

function renderDepositRoute(distributorId: string): string {
  return `import { createDepositInteraction } from "@turtlexyz/sdk";

export async function POST(request: Request) {
  const body = await request.json();

  const result = await createDepositInteraction({
    path: {
      opportunityId: body.opportunityId,
    },
    body: {
      userAddress: body.walletAddress,
      tokenIn: body.tokenIn,
      amount: body.amount,
      distributorId: "${distributorId}",
      mode: body.mode ?? "direct",
      slippageBps: body.slippageBps ?? 50,
      referralCode: body.referralCode,
    },
  });

  return Response.json(result.data ?? result.error, {
    status: result.error ? 400 : 200,
  });
}`;
}

function renderClientBroadcast(): string {
  return `export async function sendTurtleTransactions(transactions: Array<{ transaction: unknown }>, wallet: {
  sendTransaction: (transaction: unknown) => Promise<{ wait: () => Promise<unknown> }>;
}) {
  for (const item of transactions) {
    const tx = await wallet.sendTransaction(item.transaction);
    await tx.wait();
  }
}`;
}

export function registerProductTools(server: McpServer): void {
  server.registerTool(
    "scaffold_earn_integration",
    {
      title: "Scaffold Earn Integration",
      description:
        "Generate a Turtle Earn membership -> deposit -> verify integration scaffold with the distributor ID baked into server-side calls.",
      inputSchema: scaffoldEarnIntegrationInputSchema,
    },
    async (input) =>
      formatJsonResult({
        summary:
          "Build-time scaffold for a distributor integration. The MCP does not sign or broadcast user transactions.",
        stack: input.stack,
        requiredEnv: [input.apiKeyEnvVar, input.baseUrlEnvVar],
        distributorId: input.distributorId,
        workflow: [
          "Confirm API key by listing opportunities.",
          input.includeMembershipFlow
            ? "Check membership and run the wallet signature flow if needed."
            : "Assume the wallet membership flow is handled elsewhere.",
          "Call createDepositInteraction with distributorId on the server.",
          "Have the user wallet sign and submit returned transactions in order.",
          "Call verifyTracking with chainId and txHash after confirmation.",
        ],
        files: [
          {
            path:
              input.stack === "nextjs"
                ? "app/api/turtle/deposit/route.ts"
                : "src/server/turtle-deposit.ts",
            language: "ts",
            content: renderDepositRoute(input.distributorId),
          },
          {
            path: input.stack === "node" ? "src/turtle.ts" : "src/lib/turtle.ts",
            language: "ts",
            content: renderServerSdkClient(
              input.distributorId,
              input.apiKeyEnvVar,
              input.baseUrlEnvVar,
            ),
          },
          {
            path: input.stack === "node" ? "src/broadcast.ts" : "src/lib/turtle-broadcast.ts",
            language: "ts",
            content: renderClientBroadcast(),
          },
        ],
        docs: [
          "https://docs.turtle.xyz/sdk/earn/quickstart",
          "https://docs.turtle.xyz/sdk/earn/deposit",
          "https://docs.turtle.xyz/sdk/earn/verify-attribution",
        ],
      }),
  );
}
