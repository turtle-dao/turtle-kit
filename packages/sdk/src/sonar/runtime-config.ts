// Runtime configuration for the generated Sonar v1 client.
//
// The Sonar counterpart of ../runtime-config.ts, wired in the same way
// (`runtimeConfigPath` in openapi-ts.config.ts) and reading the same key:
// one Turtle API key reaches Earn and Sonar alike. Only the base URL
// differs, since Sonar v1 has its own host.

import type { CreateClientConfig } from "./client/client.gen";

// Guarded so the SDK is importable in browser bundles, where the `process`
// global may not exist. See ../runtime-config.ts.
const getEnv = (key: string): string | undefined =>
  typeof process !== "undefined" ? process.env?.[key] : undefined;

export const createClientConfig: CreateClientConfig = (config) => {
  const apiKey = getEnv("TURTLE_API_KEY");
  return {
    ...config,
    baseUrl: getEnv("TURTLE_SONAR_BASE_URL") ?? "https://sonar.turtle.xyz/v1",
    headers: {
      ...config?.headers,
      // Only set Authorization when a key is actually provided: every Sonar
      // operation takes one, and a missing key should read as a 401, not
      // as a malformed header.
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  };
};
