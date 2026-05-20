# @turtleclub/sdk

TypeScript SDK para la Turtle Earn v2 API, autogenerado desde el OpenAPI spec
con [`@hey-api/openapi-ts`](https://heyapi.dev/).

## Instalacion

```bash
bun add @turtleclub/sdk
# o
npm install @turtleclub/sdk
```

## Uso

```ts
import { getChains, getProtocols, getTokens } from "@turtleclub/sdk";

// Lee TURTLE_API_KEY y TURTLE_BASE_URL de process.env
const chains = await getChains();
```

### Variables de entorno

| Variable           | Default                     | Descripcion                        |
|--------------------|-----------------------------|------------------------------------|
| `TURTLE_API_KEY`   | (vacio)                     | API key requerida para llamadas    |
| `TURTLE_BASE_URL`  | `https://earn.turtle.xyz`   | Base URL del API                   |

## Desarrollo

```bash
# Regenera el cliente desde openapi.v2.json (lee del root del repo)
bun run codegen

# Build (codegen + tsup)
bun run build

# Type-check
bun run type-check
```

El codigo generado (`src/client/`) esta gitignored y se regenera en cada build.
La fuente de verdad es `openapi.v2.json` en la raiz del repo, que se actualiza
automaticamente cuando cambia el spec en `turtle-partners` (ver workflow
`regen-sdk.yml`).
