import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as sdk from "@turtlexyz/sdk";
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

const generateStreamsConfigInputSchema = z.object({
  streamKind: z.enum(["token", "point"]),
  streamType: z
    .enum(["fixed_rate", "fixed_apr", "daily_budget", "airdrop", "yield_match"])
    .default("fixed_apr"),
  targetTokenId: z.string().min(1),
  rewardTokenId: z.string().optional(),
  pointId: z.string().optional(),
  walletAddress: z.string().optional(),
  totalAmount: z.string().optional(),
  startTimestamp: z.string().datetime(),
  endTimestamp: z.string().datetime().optional(),
  apr: z.string().optional(),
  targetApy: z.string().optional(),
  apyOffset: z.string().optional(),
  tokensPerUSD: z.string().optional(),
  tokensPerDay: z.string().optional(),
  includeExecuteExample: z.boolean().default(true),
});

const checkAttributionInputSchema = z.object({
  distributorId: z.string().min(1),
  chainId: z.number().int(),
  txHash: z.string().min(1),
  opportunityId: z.string().optional(),
  productId: z.string().optional(),
  recentDepositsLimit: z.number().int().min(1).max(100).default(20),
});

type SdkResult<T> = {
  data?: T;
  error?: unknown;
};

function getSdkData<T>(result: SdkResult<T>): T | undefined {
  return result.data;
}

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

function buildCustomArgs(
  input: z.infer<typeof generateStreamsConfigInputSchema>,
): Record<string, string> {
  const args: Record<string, string> = {
    targetTokenId: input.targetTokenId,
  };

  if (input.streamType === "fixed_rate") {
    args.tokensPerUSD = input.tokensPerUSD ?? "1000000000000000";
  }
  if (input.streamType === "fixed_apr") {
    args.apr = input.apr ?? "0.12";
  }
  if (input.streamType === "daily_budget") {
    args.tokensPerDay = input.tokensPerDay ?? "1000000000000000000";
  }
  if (input.streamType === "yield_match") {
    if (input.targetApy) args.targetApy = input.targetApy;
    else args.apyOffset = input.apyOffset ?? "0";
  }

  return args;
}

function streamTypeToNumber(
  streamType: z.infer<typeof generateStreamsConfigInputSchema>["streamType"],
): number {
  return {
    fixed_rate: 1,
    fixed_apr: 2,
    daily_budget: 3,
    airdrop: 4,
    yield_match: 5,
  }[streamType];
}

function buildStreamsBody(
  input: z.infer<typeof generateStreamsConfigInputSchema>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: streamTypeToNumber(input.streamType),
    startTimestamp: input.startTimestamp,
    customArgs: buildCustomArgs(input),
    adapters: [],
  };

  if (input.endTimestamp) body.endTimestamp = input.endTimestamp;
  if (input.streamKind === "token") {
    body.walletAddress = input.walletAddress ?? "0xADMIN_WALLET";
    body.rewardTokenId = input.rewardTokenId ?? "REWARD_TOKEN_UUID";
  } else {
    body.pointId = input.pointId ?? "POINT_UUID";
  }

  if (input.streamType !== "daily_budget") {
    body.totalAmount = input.totalAmount ?? "2500000000000000000000";
  }

  return body;
}

function renderCreateStreamCode(
  body: Record<string, unknown>,
  includeExecuteExample: boolean,
): string {
  const payload = JSON.stringify(body, null, 2);
  const executeComment = includeExecuteExample
    ? `
// To execute through the MCP create_stream tool instead of this SDK call:
// {
//   "body": streamConfig,
//   "testMode": false,
//   "confirmProductionWrite": "confirm_create_stream"
// }`
    : "";

  return `import { createStream } from "@turtlexyz/sdk";

const streamConfig = ${payload};
${executeComment}

export async function createTurtleStream() {
  return createStream({
    body: streamConfig,
  });
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

  server.registerTool(
    "generate_streams_config",
    {
      title: "Generate Streams Config",
      description:
        "Produce a Streams campaign request body and TypeScript create call. Defaults to code/config generation instead of production mutation.",
      inputSchema: generateStreamsConfigInputSchema,
    },
    async (input) => {
      const body = buildStreamsBody(input);

      return formatJsonResult({
        summary:
          "Streams campaign config. Review token IDs, amounts, timestamps, and org permissions before calling create_stream.",
        streamKind: input.streamKind,
        streamType: input.streamType,
        body,
        guardrail:
          "The generated create_stream MCP tool previews by default. Production execution requires testMode=false and confirmProductionWrite='confirm_create_stream'.",
        code: renderCreateStreamCode(body, input.includeExecuteExample),
        docs: ["https://docs.turtle.xyz/sdk/streams/create-stream"],
      });
    },
  );

  server.registerTool(
    "check_attribution",
    {
      title: "Check Attribution",
      description:
        "Verify one transaction's Turtle tracking metadata and fetch recent distributor deposits to self-test an integration.",
      inputSchema: checkAttributionInputSchema,
    },
    async (input) => {
      const verify = await sdk.verifyTracking({
        query: {
          chainId: input.chainId,
          txHash: input.txHash,
        },
      });
      const deposits = await sdk.getDistributorDepositsV2({
        path: {
          distributorId: input.distributorId,
        },
        query: {
          limit: input.recentDepositsLimit,
          page: 1,
          opportunityId: input.opportunityId,
          productId: input.productId,
        },
      });

      const verifyData = getSdkData<Record<string, unknown>>(verify);
      const metadata =
        verifyData && typeof verifyData.metadata === "object" && verifyData.metadata !== null
          ? (verifyData.metadata as Record<string, unknown>)
          : {};

      return formatJsonResult({
        distributorId: input.distributorId,
        verified: Boolean(verifyData?.signatureValid),
        distributorMatch: metadata.distributorId === input.distributorId,
        verification: verify.data ?? verify.error,
        recentDeposits: deposits.data ?? deposits.error,
        docs: [
          "https://docs.turtle.xyz/sdk/earn/verify-attribution",
          "https://docs.turtle.xyz/sdk/earn-api/deposits",
        ],
      });
    },
  );
}
