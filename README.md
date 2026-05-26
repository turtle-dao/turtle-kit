# turtle-kit

Official developer kit for Turtle — SDK, MCP server, and Claude Code skills.

## SDK

```bash
npm install @turtle-xyz/sdk
```

```ts
import { getOpportunities, createDeposit } from "@turtle-xyz/sdk";

// Set TURTLE_API_KEY in your environment.
const opps = await getOpportunities();
```

See [`packages/sdk/README.md`](./packages/sdk/README.md) for full documentation.

## License

MIT
