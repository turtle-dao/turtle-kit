# trt

The Turtle API from the command line. Commands are not written by hand: `trt` reads the
API's own OpenAPI document (`GET /openapi.json`) and builds them from it, so a new endpoint
shows up on its own. Modelled on Google's [`gws`](https://github.com/googleworkspace/cli).

It is a separate tool from Turtle's Go `trt` (the server and ops binary).

## Run it

Node 22 or later:

```bash
export TURTLE_API_KEY=sk_live_…        # your personal API key
export TURTLE_ORG_ID=<organization id>  # optional: the default --org

npx @turtlexyz/trt --help
npm install -g @turtlexyz/trt && trt sonar contacts list --limit 5
```

`bunx @turtlexyz/trt` and `deno run -A npm:@turtlexyz/trt` work too. `trt.md`, in the package,
is the short version of this page for an AI agent.

| Variable         | Use                                                    |
| ---------------- | ------------------------------------------------------ |
| `TURTLE_API_KEY` | sent as `Authorization: Bearer …`                      |
| `TURTLE_API_URL` | the API, default `https://api.turtle.xyz`              |
| `TURTLE_ORG_ID`  | the default `--org`                                    |
| `TRT_SPEC`       | read the spec from this file instead of the API        |
| `TRT_CACHE_DIR`  | where the fetched spec is cached (see below)           |

## Commands

`trt <product> <resource> <method> [flags]`, derived from each path:

- **product**: the first segment after `/organization/{id}/`, or the path's first segment:
  `sonar`, `billing`, `creator-os`, `streams`, `turtle`, `admin`, …
- **resource**: the static segments after it, joined with `-` (`contacts`, `webhooks-deliveries`).
- **method**: GET on an item (the path ends in a parameter) is `get`, any other GET `list`,
  POST `create`, PUT and PATCH `update`, DELETE `delete`. A path that ends in a word right
  after a parameter is an action on an item: `POST /contacts/{contactId}/merge` is
  `trt sonar contacts merge`.
- Two operations that land on the same command are both named after their operationId
  instead (`sonarPlanRevert` → `plan-revert`).

Flags come from the operation: `--<name> <value>` for each path and query parameter (a
boolean one needs no value), repeated for an array. Any other flag is refused. `--org` fills
the organization in `/organization/{id}/` paths. The body is `--json '<json>'` or
`--json @file`.

```bash
trt --help                        # products
trt sonar --help                  # its commands
trt sonar contacts list --help    # flags, from the spec
trt schema sonar.contacts.list    # parameters, body and response schema, as JSON
```

## Output

- stdout carries JSON only: the response body. Help, warnings and progress go to stderr.
- A failure prints `{"status", "error"}` (`status` 0 when no response came back, plus the
  API's body as `details` when it sent JSON) and exits non-zero: 1 the API answered an error,
  2 the command line is wrong, 3 the API or its spec could not be reached.
- `--page-all` follows the paging the operation declares (`cursor`, `page`, or `offset`) and
  prints one JSON line per page, at most `--page-limit` pages (default 10).

## Writes

A GET runs. A POST, PUT, PATCH or DELETE prints the request (`{"sent": false, method, url,
body}`) and is sent only with `--yes`. `--dry-run` prints any request and sends nothing. The
server's role checks stay the real boundary.

## The spec cache

The spec is fetched with your key and cached for 24 hours, one file per API URL, under
`$XDG_CACHE_HOME/trt` (`~/.cache/trt`) on Linux, `~/Library/Caches/trt` on macOS and
`%LOCALAPPDATA%\trt\cache` on Windows. `--refresh` fetches it again, for example after
switching to a key with another role: a turtle admin's session sees `/admin`, a key never
does. When the fetch fails, a stale cache is used with a warning.

## Develop

```bash
bun run trt -- --help   # run the source with Bun
bun run test            # bun test, against src/__fixtures__/openapi.json and a mocked fetch
bun run type-check
bun run build           # dist/trt.js, the Node bin npm ships
bun run compile         # dist/trt, a single binary for this machine (not published)
```

Lint is Biome, from the repo root (`bun run lint`).

`src/__fixtures__/openapi.json` is a subset of the real spec, reflected from the API's own
handlers.

## Release

`.github/workflows/publish-trt.yml` publishes to npm when a merge to `main` touches
`packages/trt/` with a version the registry does not have yet: bump `version` in
`package.json` and add its entry to `CHANGELOG.md` in the same PR. It publishes with npm
trusted publishing (OIDC, with provenance) and tags a GitHub release `@turtlexyz/trt@<version>`.
