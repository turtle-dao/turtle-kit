import { defineConfig } from "@hey-api/openapi-ts";

// Clean up operation IDs from the spec.
// Original: "handlers/v2.GetChainsHandler"
// Post hey-api normalization: "handlers.v2.GetChainsHandler"
// Target: "getChains" (after camelCase casing).
const cleanOperationName = (name: string): string =>
  name.replace(/^handlers\.v\d+\./, "").replace(/Handler$/, "");

// Sonar v1's operation IDs carry the product's name, at the start or after
// the verb ("sonarListContacts", "approveSonarMutation"). Under `sonar.`
// it says nothing, so it goes: "listContacts", "approveMutation".
const cleanSonarOperationName = (name: string): string =>
  name.replace(/^sonar/, "").replace(/Sonar/, "");

// Sonar v1 tags each operation with its resource, as the docs name it
// ("Contacts", "Engagements (deals)"). A group is named after its tag, with
// the gloss in parentheses dropped: `sonar.engagements`, `sonar.contactRoles`.
const sonarGroupName = (tag: string): string => tag.replace(/\s*\(.*\)$/, "");

export default defineConfig([
  {
    input: "./specs/openapi.v2.json",
    output: { path: "./src/client", postProcess: ["prettier"] },
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
  },
  {
    // The committed copy of the spec sonar.turtle.xyz/v1/openapi.json serves
    // (turtle-partners go/services/api/specs/sonar.v1.json).
    input: "./specs/sonar.v1.json",
    output: { path: "./src/sonar/client", postProcess: ["prettier"] },
    plugins: [
      {
        name: "@hey-api/client-fetch",
        runtimeConfigPath: "./src/sonar/runtime-config.ts",
      },
      {
        name: "@hey-api/sdk",
        validator: true,
        operations: {
          // One group per tag, so the SDK follows the docs' reference.
          strategy: "byTags",
          methods: "static",
          containerName: {
            name: sonarGroupName,
            casing: "camelCase",
          },
          methodName: {
            name: cleanSonarOperationName,
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
  },
]);
