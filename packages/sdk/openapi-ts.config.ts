import { defineConfig } from "@hey-api/openapi-ts";

// Limpia nombres feos del spec.
// Operation ID original: "handlers/v2.GetChainsHandler"
// Lo que recibimos (post-normalizacion de hey-api): "handlers.v2.GetChainsHandler"
// Output buscado: "getChains" (post camelCase).
const cleanOperationName = (name: string): string =>
  name.replace(/^handlers\.v\d+\./, "").replace(/Handler$/, "");

export default defineConfig({
  input: "../../openapi.v2.json",
  output: { path: "./src/client", format: "prettier" },
  parser: {
    // El spec actual mezcla v1 y v2 hasta que partners separe los endpoints.
    // Cuando eso pase, este filtro se puede borrar.
    filters: { operations: { include: ["/^[A-Z]+ \\/v2\\//"] } },
  },
  plugins: [
    {
      name: "@hey-api/client-fetch",
      runtimeConfigPath: "./src/runtime-config.ts",
    },
    {
      name: "@hey-api/sdk",
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
  ],
});
