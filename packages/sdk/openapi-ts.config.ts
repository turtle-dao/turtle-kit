import { defineConfig } from "@hey-api/openapi-ts";

// Clean up operation IDs from the spec.
// Original: "handlers/v2.GetChainsHandler"
// Post hey-api normalization: "handlers.v2.GetChainsHandler"
// Target: "getChains" (after camelCase casing).
const cleanOperationName = (name: string): string =>
  name.replace(/^handlers\.v\d+\./, "").replace(/Handler$/, "");

export default defineConfig({
  input: "./specs/openapi.v2.json",
  output: { path: "./src/client", format: "prettier" },
  plugins: [
    {
      name: "@hey-api/client-fetch",
      runtimeConfigPath: "./src/runtime-config.ts",
    },
    {
      name: "@hey-api/sdk",
      // Wires the zod plugin: each generated operation calls
      // `requestValidator` / `responseValidator` at runtime against the
      // zod schemas below. Without this the schemas would be decorative.
      validator: true,
      operations: {
        strategy: "flat",
        methodName: {
          name: cleanOperationName,
          casing: "camelCase",
        },
      },
    },
    {
      name: "@hey-api/typescript",
      enums: "javascript",
    },
    "zod",
  ],
});
