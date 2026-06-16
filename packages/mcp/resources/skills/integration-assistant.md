# Turtle Integration Assistant Skill Guide

The MCP is meant to be a skill vehicle, not only a raw SDK endpoint dump. The default MCP surface intentionally has one tool plus curated resources.

Tool:
- scaffold_earn_integration

Resources:
- turtle://docs/sdk-overview
- turtle://recipes/earn-integration
- turtle://recipes/streams-campaign
- turtle://skills/integration-assistant
- turtle://openapi/spec

Resource templates:
- turtle://docs/{docName}
- turtle://recipes/{recipeName}
- turtle://skills/{skillName}

When asked to integrate Turtle Earn:
- Start with turtle://recipes/earn-integration.
- Prefer scaffold_earn_integration for project-specific code.
- Use generated SDK code for live data inside the distributor app/server.
- Keep distributorId server-side and include it in every deposit-generation body.

When asked to set up Streams:
- Start with turtle://recipes/streams-campaign.
- Generate reviewable SDK code/config before any production write.
- Do not execute raw Streams writes through the default MCP server.
- There is no default generate_streams_config tool.

Docs:
- https://docs.turtle.xyz/sdk/overview
- https://docs.turtle.xyz/sdk/earn/quickstart
- https://docs.turtle.xyz/sdk/streams/create-stream
