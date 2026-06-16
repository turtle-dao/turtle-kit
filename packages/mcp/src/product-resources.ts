import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

type CatalogResource = {
  name: string;
  uri: string;
  title: string;
  description: string;
  file: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const repoRoot = resolve(packageRoot, "../..");
const resourcesRoot = resolve(packageRoot, "resources");

const docsResources: CatalogResource[] = [
  {
    name: "turtle-sdk-overview",
    uri: "turtle://docs/sdk-overview",
    title: "Turtle SDK Overview",
    description: "Integration-oriented overview of Turtle SDK prerequisites and product surfaces.",
    file: "docs/sdk-overview.md",
  },
];

const recipeResources: CatalogResource[] = [
  {
    name: "turtle-earn-integration-recipe",
    uri: "turtle://recipes/earn-integration",
    title: "Turtle Earn Integration Recipe",
    description: "Membership to deposit to attribution workflow for distributor integrations.",
    file: "recipes/earn-integration.md",
  },
  {
    name: "turtle-streams-campaign-recipe",
    uri: "turtle://recipes/streams-campaign",
    title: "Turtle Streams Campaign Recipe",
    description: "Review-first workflow for creating Turtle Streams campaign config.",
    file: "recipes/streams-campaign.md",
  },
];

const skillResources: CatalogResource[] = [
  {
    name: "turtle-integration-assistant-skill",
    uri: "turtle://skills/integration-assistant",
    title: "Turtle Integration Assistant Skill",
    description: "Agent workflow guidance for using Turtle MCP as an integration assistant.",
    file: "skills/integration-assistant.md",
  },
];

function textResource(uri: URL, text: string, mimeType = "text/markdown") {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType,
        text,
      },
    ],
  };
}

function resourceList(resources: CatalogResource[]) {
  return {
    resources: resources.map(({ name, uri, title, description }) => ({
      name,
      uri,
      title,
      description,
      mimeType: "text/markdown",
    })),
  };
}

function findResource(resources: CatalogResource[], uri: URL): CatalogResource {
  const resource = resources.find((entry) => entry.uri === uri.href);

  if (!resource) {
    throw new Error(`Unknown Turtle MCP resource: ${uri.href}`);
  }

  return resource;
}

function readCatalogResource(uri: URL, resource: CatalogResource) {
  const text = readFileSync(resolve(resourcesRoot, resource.file), "utf8");
  return textResource(uri, text);
}

function registerCatalogTemplate(
  server: McpServer,
  name: string,
  template: string,
  resources: CatalogResource[],
  variableName: string,
): void {
  server.registerResource(
    name,
    new ResourceTemplate(template, {
      list: () => resourceList(resources),
      complete: {
        [variableName]: (value) =>
          resources
            .map((resource) => resource.uri.split("/").at(-1))
            .filter((slug): slug is string => Boolean(slug?.startsWith(value))),
      },
    }),
    {
      title: name,
      description: `Turtle MCP ${name} resources.`,
      mimeType: "text/markdown",
    },
    (uri) => readCatalogResource(uri, findResource(resources, uri)),
  );
}

export function registerProductResources(server: McpServer): void {
  registerCatalogTemplate(
    server,
    "turtle-docs",
    "turtle://docs/{docName}",
    docsResources,
    "docName",
  );
  registerCatalogTemplate(
    server,
    "turtle-recipes",
    "turtle://recipes/{recipeName}",
    recipeResources,
    "recipeName",
  );
  registerCatalogTemplate(
    server,
    "turtle-skills",
    "turtle://skills/{skillName}",
    skillResources,
    "skillName",
  );

  server.registerResource(
    "turtle-openapi-spec",
    "turtle://openapi/spec",
    {
      title: "Turtle OpenAPI Spec",
      description: "The local SDK OpenAPI source used by Turtle Kit code generation.",
      mimeType: "application/json",
    },
    (uri) => {
      try {
        const spec = readFileSync(resolve(repoRoot, "packages/sdk/specs/openapi.v2.json"), "utf8");
        return textResource(uri, spec, "application/json");
      } catch (error) {
        return textResource(
          uri,
          JSON.stringify(
            {
              error: "openapi_spec_unavailable",
              message:
                "The OpenAPI spec is available in the monorepo at packages/sdk/specs/openapi.v2.json.",
              detail: error instanceof Error ? error.message : String(error),
            },
            null,
            2,
          ),
          "application/json",
        );
      }
    },
  );
}
