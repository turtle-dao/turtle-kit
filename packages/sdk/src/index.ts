// Turtle Earn SDK — v2 only.
//
// Exports flat functions directly from the hey-api–generated client.
// The client is pre-configured via runtime-config.ts (reads
// TURTLE_API_KEY and TURTLE_BASE_URL from process.env).
//
// The singleton `client` is re-exported so consumers can override
// `baseUrl` / `headers` at runtime (useful when env vars aren't
// suitable). `createClient` is also exposed for consumers that need
// multiple independent client instances — e.g. one per API key or
// per environment — without sharing the global config.

export { createClient } from "./client/client";
export { client } from "./client/client.gen";
export * from "./client/sdk.gen";
export * as types from "./client/types.gen";
export * as schemas from "./client/zod.gen";
