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
4. Use SDK tools for live data:
   - `list_opportunities` or `get_opportunity` for vault selection.
   - `get_membership`, `create_membership_agreement_v2`, and `create_membership_v2` for wallet registration.
   - `create_deposit_interaction` to build ordered transactions.
   - `check_attribution` or `verify_tracking` after the deposit confirms.
5. Remind implementers that amounts are raw integer strings in token base units.

## Streams Workflow

1. Read `turtle://recipes/streams-campaign` when available.
2. Use `get_stream_tokens` to discover token UUIDs for `rewardTokenId` and `targetTokenId`.
3. Use `get_stream_points` or `create_stream_point` for point stream setup.
4. Use `generate_streams_config` before calling `create_stream`.
5. Treat `create_stream` and `create_stream_point` as consequential writes:
   - First run with default `testMode: true`.
   - Production execution requires `testMode: false`.
   - Production execution also requires the exact `confirmProductionWrite` value shown by the tool.

## Gotchas

- `pk_live_` keys are suitable for client-side reads; `sk_live_` keys are server-side and required for writes.
- Deposit and withdraw tools return unsigned transactions for a user wallet to sign.
- Submit returned transactions in order.
- Direct deposit uses the opportunity's native deposit token; swap mode uses `mode: "swap"` and `slippageBps`.
- Async/complex opportunities can require a claim or cancel step after the initial deposit.
- Distributor analytics reads may be broadly readable; avoid presenting them as private by default.
