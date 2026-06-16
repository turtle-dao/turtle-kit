# @turtlexyz/mcp

MCP integration assistant for Turtle Earn and Streams.

## Scope

This package exposes a small product layer for distributor developers integrating Turtle:

- `scaffold_earn_integration` generates an attributed Earn deposit scaffold with the distributor ID baked into server-side calls.
- MCP resources expose Turtle SDK overview, Earn and Streams recipes, the integration-assistant guide, and the local OpenAPI spec.

It intentionally omits WalletConnect, transaction signing, transaction broadcasting, MCP Apps UI resources, raw SDK write tools, Streams config execution tools, and attribution-check execution tools. Deposit and withdraw scaffolds produce code that returns unsigned transactions for a wallet to sign outside the MCP.

## SDK Tool Generator

The SDK-derived generator remains available as development scaffolding:

```bash
bun run mcp:update
```

It regenerates `src/generated/` from the SDK operation and schema surfaces. Those generated files are ignored by git and are not registered by the default server entrypoint.

## Development

```bash
bun install

cd packages/mcp
bun run eval:smoke
bun run type-check
bun run build
```

`eval:smoke` starts the MCP over stdio and verifies the integration-assistant tool/resources without calling raw SDK write tools.

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
bun run --cwd ../sdk codegen
bun run --cwd ../sdk build
mcp-inspector -e TURTLE_API_KEY=... bun run src/index.ts
```

## Skill

The repo-local skill lives at `skills/turtle-integration-assistant/SKILL.md`. It teaches agents to use the MCP as a build-time integration assistant:

- Earn: membership -> deposit generation -> wallet broadcast -> attribution verification.
- Streams: read recipe/resource guidance -> human-reviewed SDK execution.
