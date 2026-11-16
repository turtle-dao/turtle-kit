#!/usr/bin/env bun
import process from "node:process";

import { run } from "./cli";

const exitCode = await run(process.argv.slice(2), {
  env: process.env,
  fetch: globalThis.fetch,
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  now: () => Date.now(),
  platform: process.platform,
  isTTY: Boolean(process.stdout.isTTY),
});
process.exitCode = exitCode;
