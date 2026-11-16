# turtle-kit

Official developer kit for Turtle — SDK, MCP server, and Claude Code skills.

## SDK

```bash
bun add @turtlexyz/sdk
```

```ts
import { listOpportunities, createDepositInteraction } from "@turtlexyz/sdk";

// Set TURTLE_API_KEY in your environment.
const { data: opps } = await listOpportunities();
```

See [`packages/sdk/README.md`](./packages/sdk/README.md) for full documentation.

## trt

`trt`, the Turtle API from the command line, with commands built from the API's own OpenAPI
spec.

```bash
npx @turtlexyz/trt --help
```

See [`packages/trt/README.md`](./packages/trt/README.md).

## License

MIT
