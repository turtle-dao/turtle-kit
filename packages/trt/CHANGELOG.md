# Changelog

## [0.1.0]

### Added

- Initial npm release of `@turtlexyz/trt`.
- `trt` binary for Node 22 or later, runnable via `npx @turtlexyz/trt`.
- Commands built from the API's own OpenAPI spec (`GET /openapi.json`), cached for 24 hours.
- `trt schema` for an operation's parameters, body and response; `--dry-run`, `--yes` for
  writes, and `--page-all`.
- `trt.md`, a short guide for AI agents, shipped in the package.
