# Recipe: Streams Campaign Setup

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
