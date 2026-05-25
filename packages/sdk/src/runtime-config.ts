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

// Guarded so the SDK is importable in browser bundles (Vite, Next.js
// client components, etc.) where the `process` global may not exist.
// Consumers that want runtime config in those environments can override
// via the re-exported `client` / `createClient`.
const getEnv = (key: string): string | undefined =>
  typeof process !== "undefined" ? process.env?.[key] : undefined;

export const createClientConfig: CreateClientConfig = (config) => {
  const apiKey = getEnv("TURTLE_API_KEY");
  return {
    ...config,
    baseUrl: getEnv("TURTLE_BASE_URL") ?? "https://earn.turtle.xyz",
    headers: {
      ...config?.headers,
      // Only set Authorization when a key is actually provided. An empty
      // `Bearer ` string trips some API gateways on otherwise-public
      // endpoints.
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  };
};
