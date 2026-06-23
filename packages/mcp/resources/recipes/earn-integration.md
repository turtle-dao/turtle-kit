# Recipe: Turtle Earn Integration

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
