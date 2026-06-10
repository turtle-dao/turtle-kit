# @turtlexyz/sdk

TypeScript SDK for the [Turtle API](https://docs.turtle.xyz) — yield opportunities, deposits, attribution, and Streams.

## Install

```bash
bun add @turtlexyz/sdk
```

## Setup

```ts
import { listOpportunities } from "@turtlexyz/sdk";

// Set TURTLE_API_KEY in your environment.
// Base URL defaults to https://earn.turtle.xyz
const { data: opps } = await listOpportunities();
```

| Variable          | Default                   | Description                       |
|-------------------|---------------------------|-----------------------------------|
| `TURTLE_API_KEY`  | —                         | API key from dashboard.turtle.xyz |
| `TURTLE_BASE_URL` | `https://earn.turtle.xyz` | Override for testing              |

On import the SDK auto-configures a client from these variables: when
`TURTLE_API_KEY` is set it sends `Authorization: Bearer <key>`; when it is
absent no auth header is sent (public endpoints still work). To point at a
different host or inject your own auth, override the client:

```ts
import { client } from "@turtlexyz/sdk";

client.setConfig({ baseUrl: "https://earn.turtle.xyz" });
```

### Return shape

Every function returns `{ data, error, request, response }` and does **not**
throw on HTTP errors by default — check `error` (or pass `{ throwOnError: true }`
per call). Requests and responses are validated at runtime with Zod.

## Core flow

```ts
import {
  listOpportunities,
  getMembership,
  createMembershipAgreementV2,
  createMembershipV2,
  createDepositInteraction,
  verifyTracking,
} from "@turtlexyz/sdk";

// 1. Find opportunities
const { data: opps } = await listOpportunities();

// 2. Check whether a wallet is already a member
const { data: membership } = await getMembership({
  query: { address: "0x...", walletEcosystem: "evm" },
});

// 3. If not, run the membership signature flow (EIP-4361)
const { data: agreement } = await createMembershipAgreementV2({
  body: { address: "0x...", walletEcosystem: "evm", url: "https://app.turtle.xyz" },
});
// → user signs `agreement.message`; `agreement.nonce` ties the signature to this request
const { data: member } = await createMembershipV2({
  body: {
    address: "0x...",
    walletEcosystem: "evm",
    signature: "0x...",        // signature over agreement.message
    nonce: agreement.nonce,
    distributorId: "Y2Zi7KWy", // optional: attribute the signup
  },
});

// 4. Build a deposit
const { data: deposit, error } = await createDepositInteraction({
  path: { opportunityId: "opp-uuid" },
  body: {
    userAddress: "0x...",
    tokenIn: "0xA0b8...",
    amount: "1000000000000000000", // smallest unit (wei)
    distributorId: "Y2Zi7KWy",
    // optional: mode ('swap' | 'direct'), slippageBps, referralCode
  },
});
// deposit.transactions → unsigned txs for the user to sign and broadcast
// deposit.actionId     → reference for the saved interaction

// 5. Verify attribution once the on-chain tx confirms
const { data: verified } = await verifyTracking({
  query: { chainId: 1, txHash: "0x..." },
});
```

## What's included

The SDK wraps the full [Turtle API](https://earn.turtle.xyz/docs/openapi.json):

- **Actions** — `createDepositInteraction`, `createWithdrawInteraction`, `createCancelDepositInteraction`, `createClaimDepositInteraction`, `verifyTracking`
- **Opportunities** — `listOpportunities`, `getOpportunity`, `getOpportunityFilterOptions`, and historical series (`getOpportunityHistoricalApr` / `Apy` / `Tvl` / `SharePrice`)
- **Membership** — `getMembership`, `createMembershipAgreementV2`, `createMembershipV2`
- **Streams** — `getStreams`, `createStream`, `getStreamPoints`, `createStreamPoint`, `getStreamTokens`, `getStreamWallet`, `getStreamWallets`, `turtleStreamsGetMerkleProofs`
- **Swaps** — `getEarnSwapV2`, `getSwapDetails`, `getSwapTokens`
- **Distributor analytics** — `getDistributorMetrics`, `getDistributorLps`, `getDistributorDepositsV2`
- **Wallet** — `protocolsWalletGetWalletPortfolio`, `getWalletActivity`
- **Reference** — `getChains`, `getProtocols`, `getTokens`, `getTokenByAddress`

## How it works

Types and functions are auto-generated from the OpenAPI spec using
[hey-api](https://github.com/hey-api/openapi-ts). Request and response payloads
are validated at runtime with Zod. When the API changes, the SDK regenerates
automatically.

## Development

```bash
bun run codegen    # regenerate client from specs/openapi.v2.json
bun run build      # codegen + tsup bundle
bun run type-check # tsc --noEmit
```

The generated code (`src/client/`) is gitignored and recreated on every build.
The source of truth is `specs/openapi.v2.json`, kept in sync with `turtle-partners`
by the `openapi-sync-sdk.yml` workflow.

## Docs

- [docs.turtle.xyz](https://docs.turtle.xyz) — full API documentation
- [OpenAPI spec](https://earn.turtle.xyz/docs/openapi.json) — machine-readable spec

## License

MIT
