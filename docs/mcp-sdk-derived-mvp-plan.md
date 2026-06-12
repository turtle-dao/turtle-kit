# SDK-derived MCP MVP Plan

This plan captures the agreed MVP for adding `packages/mcp` to Turtle Kit. The MCP package exposes MCP tools for SDK Operations only, generated at development/build time from the SDK-generated operation and schema surfaces.

## Decisions

- `packages/mcp` is the MVP package location.
- The MCP Tool Surface cannot exceed the SDK Surface.
- Every SDK Operation is exposed initially.
- SDK helpers, clients, namespaces, and type exports are not MCP tools.
- Wallet connection, transaction signing, MCP Apps UI, and other non-SDK capabilities are omitted.
- Tool names are derived from SDK export names using MCP-friendly casing, for example `createDepositInteraction` becomes `create_deposit_interaction`.
- MCP tool inputs preserve the SDK-shaped operation options, such as `path`, `query`, and `body`.
- MCP tool outputs return the SDK result's `data`; SDK error results are preserved for now.
- `mcp:update` is generation-time, not runtime introspection.
- `mcp:update` runs the SDK codegen first.
- Generated MCP files are ignored, like `packages/sdk/src/client/`.
- The MVP supports stdio transport only.
- MCP auth/config comes from SDK env vars: `TURTLE_API_KEY` and `TURTLE_BASE_URL`.
- `packages/mcp` has a `dev` script that launches the MCP Inspector.

## Proposed File Shape

- `packages/mcp/package.json`: package scripts, dependencies, and devDependencies.
- `packages/mcp/tsconfig.json`: package TypeScript config.
- `packages/mcp/src/index.ts`: manual stdio server bootstrap.
- `packages/mcp/src/format-result.ts`: manual JSON text formatter with an 800 KB response cap.
- `packages/mcp/src/generated/tools.ts`: generated tool registrations and SDK wrappers.
- `packages/mcp/src/generated/manifest.ts`: generated manifest of SDK export names, tool names, and schema parts.
- `packages/mcp/scripts/update-tools.ts`: generator script.
- `packages/mcp/README.md`: local usage, env configuration, Inspector usage, and MCP client config examples.

## SDK Changes

- Re-export SDK validation schemas from the manual SDK entrypoint:

```ts
export * as schemas from "./client/zod.gen";
```

- Do not edit generated SDK files.
- Keep operation discovery based on the generated SDK operation file, while validating public availability through the SDK entrypoint.

## Generator Behavior

- Run SDK codegen before generating MCP tools.
- Use the TypeScript compiler API to inspect generated SDK operation exports.
- Identify SDK Operations, excluding `Options`, helpers, clients, type-only exports, and namespaces.
- For each SDK Operation, locate matching SDK-backed schemas for `path`, `query`, and `body`.
- Generate a strict SDK-shaped Zod input schema:

```ts
z.object({
  path: z...optional(),
  query: z...optional(),
  body: z...optional(),
})
```

- Fail `mcp:update` if a required schema cannot be resolved from the SDK Schema Surface.
- Generate wrappers that call the SDK operation with the MCP input as SDK options.
- Return `result.data` when present.
- Preserve SDK error results without custom MCP-specific translation.
- Serialize returned payloads as JSON text.

## Package Scripts

Target scripts for `packages/mcp/package.json`:

```json
{
  "scripts": {
    "mcp:update": "bun run scripts/update-tools.ts",
    "build": "bun run mcp:update && tsup",
    "type-check": "bun run mcp:update && tsc --noEmit",
    "dev": "bun run mcp:update && mcp-inspector bun run src/index.ts",
    "start": "node dist/index.js"
  }
}
```

During implementation, verify the Inspector bin name from the installed `@modelcontextprotocol/inspector` package and adjust `dev` if needed.

## README Requirements

- Explain that the MCP package is generated from SDK Operations.
- Document that non-SDK wallet capabilities are intentionally omitted.
- Show direct local execution with env vars.
- Show MCP client JSON config with `env`.
- Show MCP Inspector usage through `bun run dev`.
- Mention that env vars can be passed through the shell for `bun run dev`, or through Inspector `-e` when invoking `mcp-inspector` directly.

Example MCP client config:

```json
{
  "mcpServers": {
    "turtle": {
      "command": "bun",
      "args": ["run", "--cwd", "/path/to/turtle-kit/packages/mcp", "start"],
      "env": {
        "TURTLE_API_KEY": "...",
        "TURTLE_BASE_URL": "https://earn.turtle.xyz"
      }
    }
  }
}
```

## Verification

- `bun run mcp:update` from `packages/mcp`.
- `bun run type-check` from `packages/mcp`.
- `bun run build` from `packages/mcp`.
- `bun run dev` from `packages/mcp`, then verify tools in MCP Inspector.

## Deferred

- Publishing name and npm migration compatibility.
- Legacy `@turtleclub/mcp` compatibility.
- WalletConnect and signing tools.
- MCP Apps UI resources.
- Flattened MCP inputs or aliases.
- Structured MCP content beyond JSON text.
- Dedicated test runner or generated snapshot checks.
