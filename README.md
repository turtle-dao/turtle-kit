# turtle-kit

Official developer kit for Turtle.

## SDK

```bash
bun add @turtlexyz/sdk
```

```ts
import { getChains } from "@turtlexyz/sdk";

// Reads TURTLE_API_KEY and TURTLE_BASE_URL from process.env.
const chains = await getChains();
```

See [`packages/sdk/README.md`](./packages/sdk/README.md) for more.

## License

MIT
