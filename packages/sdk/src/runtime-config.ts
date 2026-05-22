// Runtime configuration for the generated client.
//
// Wired in via `runtimeConfigPath` in openapi-ts.config.ts. hey-api plugs
// this `createClientConfig` into the client, so the consumer doesn't need
// to call any wrapper — importing a function from the SDK already gives
// you a configured client.
//
// Pattern: singleton, reads process.env. Zero setup at the call site, one
// global config per process. When we integrate the MCP we may need to
// revisit this — the MCP could need to inject credentials per session.

import type { CreateClientConfig } from "./client/client.gen";

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: process.env.TURTLE_BASE_URL ?? "https://earn.turtle.xyz",
  headers: {
    ...config?.headers,
    Authorization: `Bearer ${process.env.TURTLE_API_KEY ?? ""}`,
  },
});
