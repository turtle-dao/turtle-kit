# turtle-kit

Official developer kit for Turtle.

## SDK

```bash
bun add @turtleclub/sdk
```

```ts
import { getChains } from "@turtleclub/sdk";

// Reads TURTLE_API_KEY and TURTLE_BASE_URL from process.env.
const chains = await getChains();
```

See [`packages/sdk/README.md`](./packages/sdk/README.md) for more.

## License

MIT
