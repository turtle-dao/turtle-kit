# turtle-kit

Developer kit oficial de Turtle: SDK, MCP server y Claude Code skills para la
Turtle Earn API.

## Que contiene

| Paquete / dir         | Estado          | Descripcion                                             |
|-----------------------|-----------------|---------------------------------------------------------|
| `packages/sdk`        | ✅ Fase 1       | `@turtleclub/sdk` — cliente TS autogenerado para v2 API |
| `packages/mcp`        | 🔜 Fase 3       | `@turtleclub/mcp` — MCP server que usa el SDK           |
| `skills/`             | 🔜 Fase 4       | Skills instalables via `npx skills@latest`              |
| `.claude-plugin/`     | 🔜 Fase 4       | Marker para el CLI de skills                            |

## Instalacion (usuarios finales)

### SDK

```bash
bun add @turtleclub/sdk
```

```ts
import { getChains, getProtocols } from "@turtleclub/sdk";

// Lee TURTLE_API_KEY y TURTLE_BASE_URL de process.env
const chains = await getChains();
```

Ver [`packages/sdk/README.md`](./packages/sdk/README.md) para mas detalle.

### Skills

```bash
npx skills@latest add turtle-dao/turtle-kit
```

(Disponible cuando se complete Fase 4.)

## Desarrollo

```bash
bun install        # instala todo el workspace
bun run codegen    # regenera el SDK desde openapi.v2.json
bun run type-check # type-check de todos los packages
bun run build      # build de todos los packages
bun run lint       # biome
```

## Como funciona la automatizacion

```
turtle-partners (push a main, cambia openapi.v2.json)
        │
        ▼  repository_dispatch
turtle-kit/.github/workflows/regen-sdk.yml
        │
        ├─ Descarga openapi.v2.json desde partners@main
        ├─ Regenera SDK (bun run codegen)
        ├─ Clasifica diff con oasdiff (major | minor | patch)
        ├─ Bumpea version del package
        ├─ Type-check + build
        └─ Abre PR
              │
              ├─ Si non-breaking → label "auto-merge" → gh pr merge --auto
              └─ Si breaking → label "needs-review" → espera review humana
                    │
                    ▼  merge a main
              publish.yml: npm publish + git tag
```

El spec `openapi.v2.json` vive en la raiz del repo y es la fuente de verdad
para el codegen. Lo actualiza el workflow; no editar a mano.

## Setup inicial (one-time)

Ver [`.github/SETUP.md`](./.github/SETUP.md) para secrets, branch protection
y el workflow espejo en `turtle-partners`.

## Estructura del repo

```
turtle-kit/
├── .claude-plugin/      # Fase 4: marker para `npx skills@latest`
├── .github/
│   ├── SETUP.md         # Pasos one-time
│   └── workflows/       # ci, regen-sdk, publish
├── packages/
│   └── sdk/             # @turtleclub/sdk
├── scripts/             # Helpers
├── skills/              # Fase 4: skills instalables
├── openapi.v2.json      # Spec source-of-truth (auto-actualizado)
├── biome.json
├── package.json         # Bun workspaces + Turbo
├── tsconfig.base.json
└── turbo.json
```

## Licencia

MIT
