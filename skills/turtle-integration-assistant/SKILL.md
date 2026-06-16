---
name: turtle-integration-assistant
description: Use when integrating Turtle Earn or Streams into a distributor app with the Turtle SDK/MCP: scaffold attributed deposits, verify attribution, generate Streams campaign config, or explain Turtle integration workflows.
---

# Turtle Integration Assistant

Use this skill to turn the Turtle MCP from raw SDK tools into an integration workflow for distributor developers.

## Product Stance

- Target user: a developer at a distributor integrating Turtle into an app.
- Target job: build an attributed Earn deposit flow or configure a Streams campaign.
- Do not position this as an autonomous end-user fund-moving agent.
- The MCP never signs wallet messages, never broadcasts transactions, and never takes custody.
- Always preserve attribution: every Earn deposit scaffold must include `distributorId`.

## Earn Workflow

1. Confirm the developer has an API key and distributor ID.
2. Read `turtle://recipes/earn-integration` when available.
3. Use `scaffold_earn_integration` to generate project-shaped code.
4. For live data, generate SDK code in the distributor app/server rather than assuming raw SDK MCP tools exist:
   - `listOpportunities` or `getOpportunity` for vault selection.
   - `getMembership`, `createMembershipAgreementV2`, and `createMembershipV2` for wallet registration.
   - `createDepositInteraction` to build ordered transactions.
   - `verifyTracking` can verify attribution when the user provides a real tx hash.
5. Remind implementers that amounts are raw integer strings in token base units.

## Streams Workflow

1. Read `turtle://recipes/streams-campaign` when available.
2. Ask for token/point UUIDs, or generate SDK code that calls `getStreamTokens` / `getStreamPoints` from the distributor app/server.
3. Use provided IDs in the generated config.
4. Produce reviewable campaign config and SDK code from the Streams recipe/resource.
5. Do not execute raw Streams writes through the default MCP server; hand reviewed config to the distributor app/server for SDK execution after human approval.

## Gotchas

- `pk_live_` keys are suitable for client-side reads; `sk_live_` keys are server-side and required for writes.
- Generated deposit code returns unsigned transactions for a user wallet to sign.
- Submit returned transactions in order.
- Direct deposit uses the opportunity's native deposit token; swap mode uses `mode: "swap"` and `slippageBps`.
- Async/complex opportunities can require a claim or cancel step after the initial deposit.
- Distributor analytics reads may be broadly readable; avoid presenting them as private by default.
