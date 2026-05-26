# @turtle-xyz/sdk

TypeScript SDK for the [Turtle API](https://docs.turtle.xyz) — yield opportunities, deposits, attribution, and Streams.

## Install

```bash
npm install @turtle-xyz/sdk
```

## Setup

```ts
import { getOpportunities } from "@turtle-xyz/sdk";

// Set TURTLE_API_KEY in your environment.
// Base URL defaults to https://earn.turtle.xyz
const opps = await getOpportunities();
```

| Variable          | Default                   | Description                      |
|-------------------|---------------------------|----------------------------------|
| `TURTLE_API_KEY`  | —                         | API key from dashboard.turtle.xyz |
| `TURTLE_BASE_URL` | `https://earn.turtle.xyz` | Override for testing              |

## Core flow

```ts
import {
  getOpportunities,
  getMembership,
  createMembershipAgreement,
  createMembership,
  createDeposit,
  verifyTracking,
} from "@turtle-xyz/sdk";

// 1. Find opportunities
const opps = await getOpportunities();

// 2. Check if wallet is a member
const membership = await getMembership({ query: { address: "0x..." } });

// 3. If not, create membership (EIP-4361 signature flow)
const agreement = await createMembershipAgreement({ body: { address: "0x..." } });
// → user signs the message
const member = await createMembership({ body: { address: "0x...", signature: "0x..." } });

// 4. Deposit
const deposit = await createDeposit({
  path: { opportunityId: "opp-uuid" },
  body: {
    userAddress: "0x...",
    tokenIn: "0xA0b8...",
    amount: "1000000000000000000",
    distributorId: "Y2Zi7KWy",
  },
});
// → returns unsigned transactions for the user to sign and broadcast

// 5. Verify attribution
const verified = await verifyTracking({
  query: { chainId: 1, txHash: "0x..." },
});
```

## What's included

The SDK wraps the full [Turtle API](https://earn.turtle.xyz/docs/openapi.json):

- **Actions** — deposit, withdraw, cancel, claim, verify attribution
- **Opportunities** — list, get by ID, filter by distributor
- **Membership** — check, create agreement, register wallet
- **Streams** — manage reward streams, points, and wallet snapshots
- **Swaps** — quote and execute token swaps
- **Historical** — vault APR, APY, TVL, and share price time series
- **Reference** — chains, protocols, tokens

## How it works

Types and functions are auto-generated from the OpenAPI spec using [hey-api](https://github.com/hey-api/openapi-ts). Request and response payloads are validated at runtime with Zod. When the API changes, the SDK regenerates automatically.

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
