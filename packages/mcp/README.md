# @turtlexyz/mcp

SDK-derived MCP server and integration assistant for Turtle Earn and Streams.

## Scope

This package exposes SDK Operations as MCP tools and adds a small product layer for distributor developers integrating Turtle:

- `scaffold_earn_integration` generates an attributed Earn deposit scaffold with the distributor ID baked into server-side calls.
- `generate_streams_config` produces reviewable Streams campaign config and TypeScript creation code.
- `check_attribution` wraps transaction verification and distributor deposit reads for integration self-tests.
- MCP resources expose Turtle SDK overview, Earn and Streams recipes, the integration-assistant guide, and the local OpenAPI spec.

It intentionally omits WalletConnect, transaction signing, transaction broadcasting, and MCP Apps UI resources. Deposit and withdraw tools return unsigned transactions for a wallet to sign outside the MCP.

## Write Guardrails

The full SDK operation surface remains available, including writes. The consequential Streams writes are guarded:

- `create_stream`
- `create_stream_point`

Both run in preview mode by default with `testMode: true`. To execute a production write, set `testMode: false` and pass the exact `confirmProductionWrite` value returned by the preview/error response.

## Development

```bash
bun install

cd packages/mcp
bun run mcp:update
bun run type-check
bun run build
```

`mcp:update` runs the SDK codegen first, then regenerates `src/generated/` from the SDK operation and schema surfaces. Generated MCP files are ignored by git, like the generated SDK client.

The product-layer tools and resources live in `src/product-tools.ts` and `src/product-resources.ts`; they are handwritten and versioned.

## Configuration

The MCP server uses the same environment variables as `@turtlexyz/sdk`.

| Variable | Default | Description |
| --- | --- | --- |
| `TURTLE_API_KEY` | _(empty)_ | API key used by authenticated SDK calls. |
| `TURTLE_BASE_URL` | `https://earn.turtle.xyz` | Turtle Earn API base URL. |

For generated integration scaffolds, the distributor ID is an explicit tool input because it must be embedded in Earn deposit-generation calls for attribution.

Run the built server:

```bash
TURTLE_API_KEY=... bun run build
TURTLE_API_KEY=... bun run start
```

## MCP Client Config

Example local MCP client configuration:

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

## Inspector

The `dev` script runs the MCP Inspector against the local TypeScript server.

```bash
bun run dev
```

Pass env vars to the Inspector process and its MCP server:

```bash
TURTLE_API_KEY=... bun run dev
```

The Inspector also supports `-e KEY=VALUE` when invoked directly:

```bash
bun run mcp:update
bun run --cwd ../sdk build
mcp-inspector -e TURTLE_API_KEY=... bun run src/index.ts
```

## Skill

The repo-local skill lives at `skills/turtle-integration-assistant/SKILL.md`. It teaches agents to use the MCP as a build-time integration assistant:

- Earn: membership -> deposit generation -> wallet broadcast -> attribution verification.
- Streams: token/point discovery -> config generation -> guarded production creation.
