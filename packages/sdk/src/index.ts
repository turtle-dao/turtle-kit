// Turtle Earn SDK — v2 only.
//
// Exports flat functions directly from the hey-api–generated client.
// The client is pre-configured via runtime-config.ts (reads
// TURTLE_API_KEY and TURTLE_BASE_URL from process.env).
//
// The `client` instance is also re-exported so consumers can override
// `baseUrl` / `headers` at runtime (useful when env vars aren't suitable
// or when juggling multiple client instances).

export * from "./client/sdk.gen";
export * as types from "./client/types.gen";
export { client } from "./client/client.gen";
