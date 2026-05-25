# Git hooks

Project-tracked git hooks. Not active by default — opt in once per clone:

```bash
git config core.hooksPath .githooks
# or, if you have it set up as a script:
bun run setup:hooks
```

After that, every commit runs through the hooks below. Bypass for a single
commit with `git commit --no-verify`.

## Hooks

### `pre-commit`

Runs `biome check --write` on the JS/TS/JSON files staged for the commit
and re-stages anything Biome rewrote (safe fixes only — imports
reordering, formatting, etc.). Unfixable Biome errors abort the commit.

The CI workflow (`ci.yml`) runs Biome on the full repo as the final gate,
so this hook is just a productivity nicety to catch issues before push.
