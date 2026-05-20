// Runtime config para el cliente generado.
//
// Referenciado desde openapi-ts.config.ts via runtimeConfigPath. Hey-api enchufa
// este createClientConfig al cliente, asi el consumidor no tiene que invocar un
// wrapper — el cliente ya viene configurado.
//
// Patron actual: singleton, lee process.env. Cero setup en el call site, una sola
// config global por proceso. Cuando integremos el MCP necesitamos revisitar esto
// porque el MCP puede necesitar inyectar credenciales por sesion.

import type { CreateClientConfig } from "./client/client.gen";

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: process.env.TURTLE_BASE_URL ?? "https://earn.turtle.xyz",
  headers: {
    ...config?.headers,
    Authorization: `Bearer ${process.env.TURTLE_API_KEY ?? ""}`,
  },
});
