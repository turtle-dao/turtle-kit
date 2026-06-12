# @turtlexyz/mcp

SDK-derived MCP server for Turtle Earn API operations exposed by `@turtlexyz/sdk`.

## Scope

This MVP exposes SDK Operations as MCP tools. It intentionally omits non-SDK capabilities from the legacy MCP server, including WalletConnect, transaction signing, and MCP Apps UI resources.

## Development

```bash
bun install

cd packages/mcp
bun run mcp:update
bun run type-check
bun run build
```

`mcp:update` runs the SDK codegen first, then regenerates `src/generated/` from the SDK operation and schema surfaces. Generated MCP files are ignored by git, like the generated SDK client.

## Configuration

The MCP server uses the same environment variables as `@turtlexyz/sdk`.

| Variable | Default | Description |
| --- | --- | --- |
| `TURTLE_API_KEY` | _(empty)_ | API key used by authenticated SDK calls. |
| `TURTLE_BASE_URL` | `https://earn.turtle.xyz` | Turtle Earn API base URL. |

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
