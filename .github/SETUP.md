# Setup de turtle-kit

Pasos one-time para que la automatizacion funcione.

## Secrets requeridos en turtle-kit

| Secret              | Scope                                                       | Donde se usa           |
|---------------------|-------------------------------------------------------------|------------------------|
| `NPM_TOKEN`         | npm publish access a `@turtleclub/sdk`                      | `publish.yml`          |
| `PARTNERS_READ_TOKEN` | GitHub PAT con `contents:read` sobre `turtle-dao/turtle-partners` | `regen-sdk.yml`        |

`GITHUB_TOKEN` (auto-provisto por GitHub Actions) se usa con permisos
`contents:write` + `pull-requests:write` para crear PRs y mergear.

## Secrets requeridos en turtle-partners

| Secret                     | Scope                                                      | Donde se usa                          |
|----------------------------|------------------------------------------------------------|---------------------------------------|
| `TURTLE_KIT_DISPATCH_TOKEN` | GitHub PAT con `actions:write` sobre `turtle-dao/turtle-kit` | Workflow de dispatch (lado partners) |

## Branch protection en `turtle-kit/main`

- ✅ Require status checks to pass before merging
  - `check` (de `ci.yml`)
- ✅ Require linear history
- ✅ Allow auto-merge
- ❌ NO require approvals (la idea es bypass humano en non-breaking)
- ❌ Restrict pushes (todo via PR)

## Workflow del lado de turtle-partners

En `turtle-partners`, agregar `.github/workflows/dispatch-openapi-update.yml`:

```yaml
name: Notify turtle-kit on OpenAPI update

on:
  push:
    branches: [main]
    paths:
      - openapi.v2.json

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        with:
          github-token: ${{ secrets.TURTLE_KIT_DISPATCH_TOKEN }}
          script: |
            await github.rest.repos.createDispatchEvent({
              owner: 'turtle-dao',
              repo: 'turtle-kit',
              event_type: 'openapi-v2-updated',
              client_payload: { ref: '${{ github.sha }}' }
            });
```

Y un CI check que valide que `openapi.v2.json` esta al dia respecto a los
handlers (corre `make openapi` y falla si hay diff sin commitear). Lo
implementa la tarea de "Backend: dump-openapi cmd" en la Fase 1.
