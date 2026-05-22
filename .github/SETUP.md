# turtle-kit setup

One-time setup for the automation to work end-to-end.

## Required secrets in `turtle-kit`

| Secret                | Scope                                                                  | Used by         |
|-----------------------|------------------------------------------------------------------------|-----------------|
| `NPM_TOKEN`           | npm publish access to `@turtleclub/sdk` (Granular Access Token recommended, with "bypass 2FA when publishing") | `publish.yml` (currently disabled — rename `publish.yml.disabled` → `publish.yml` to enable) |
| `PARTNERS_READ_TOKEN` | GitHub PAT with `Contents: read` on `Turtle-DAO/turtle-partners` (only if the repo is private) | `openapi-sync-sdk.yml` |

`GITHUB_TOKEN` (auto-provided by GitHub Actions) is used with `contents:write`
+ `pull-requests:write` to open PRs and auto-merge.

## Required secrets in `turtle-partners`

| Secret                     | Variable    | Used by                |
|----------------------------|-------------|------------------------|
| `SDK_REPO_DISPATCH_TOKEN`  | _(secret)_  | `deploy-gke.yml` notify step |
| `SDK_REPO`                 | _(variable)_| `deploy-gke.yml` notify step (e.g. `Turtle-DAO/turtle-kit`) |

The PAT needs `Contents: read and write` on `turtle-kit` so it can call the
`/dispatches` endpoint.

## Branch protection on `turtle-kit/main`

- ✅ Require status checks to pass before merging
  - `check` (from `ci.yml`)
- ✅ Require linear history
- ✅ Allow auto-merge
- ❌ Do NOT require approvals (intentional — non-breaking releases bypass humans)
- ❌ Restrict pushes (everything goes through PRs)

## Partners side workflow

The dispatch is already wired into the deploy pipeline:
`turtle-partners/.github/workflows/deploy-gke.yml` — `notify-sdk-consumer`
job. It fires after `deploy-services` + `deploy-ingress`, only when the last
commit on `main` touched `go/services/earn/specs/`. Payload:

```json
{
  "event_type": "openapi-spec-updated",
  "client_payload": {
    "source_commit": "<sha>",
    "source_ref": "main"
  }
}
```

`openapi-sync-sdk.yml` reads `source_commit` and pulls the spec from
`raw.githubusercontent.com/Turtle-DAO/turtle-partners/<sha>/go/services/earn/specs/openapi.v2.json`
— immutable URL, no CDN cache races.
