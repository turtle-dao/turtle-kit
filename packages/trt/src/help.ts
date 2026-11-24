import { schemaType } from "./args.ts";
import type { Command, CommandTree } from "./commands.ts";
import { commandKey, commandWords } from "./commands.ts";
import { DEFAULT_PAGE_LIMIT } from "./request.ts";
import type { OpenAPIDocument } from "./spec.ts";

const GLOBAL_FLAGS = `Flags on every call:
  --org <id>          the organization for /organization/{id}/ paths (default: $TURTLE_ORG_ID)
  --json <json|@file> the request body
  --dry-run           print the request and send nothing
  --yes               send a write (POST, PUT, PATCH, DELETE); without it a write is only printed
  --page-all          follow the operation's paging and print one JSON line per page
  --page-limit <n>    pages --page-all fetches at most (default ${DEFAULT_PAGE_LIMIT})
  --refresh           fetch the API's spec again instead of using the cached copy
  --help, -h          this help`;

const ENVIRONMENT = `Environment:
  TURTLE_API_KEY    your personal API key (sk_live_…), sent as a bearer token
  TURTLE_API_URL    the API (default https://api.turtle.xyz)
  TURTLE_SONAR_URL  Sonar v1, where trt sonar calls go (default https://sonar.turtle.xyz/v1)
  TURTLE_ORG_ID     the default --org
  TRT_SPEC          read the spec from this file instead of the API
  TRT_SONAR_SPEC    with TRT_SPEC, Sonar v1's spec from this file (else trt sonar is the API's own)`;

export function rootHelp(tree: CommandTree): string {
  const products = [...tree.entries()]
    .map(([product, resources]) => `  ${product.padEnd(24)} ${countCommands(resources)} commands`)
    .join("\n");
  return `trt: the Turtle API from the command line. Commands come from the API's own spec.

Usage:
  trt <product> <resource> <method> [flags]
  trt schema <command words>              the call's parameters, body and response as JSON

Products:
${products}

${GLOBAL_FLAGS}

${ENVIRONMENT}

Output is JSON on stdout: the response body, or {"status","error"} with a non-zero exit.
`;
}

export function productHelp(product: string, resources: Map<string, Map<string, Command>>): string {
  const lines = [...resources.values()].flatMap((methods) =>
    [...methods.values()].map(commandLine),
  );
  return `trt ${product}: ${countCommands(resources)} commands. Run any with --help for its flags.

${lines.join("\n")}
`;
}

export function resourceHelp(methods: Map<string, Command>): string {
  return `${[...methods.values()].map(commandLine).join("\n")}\n`;
}

export function commandHelp(command: Command, spec: OpenAPIDocument): string {
  const { operation } = command;
  const flags = command.parameters.map((parameter) => {
    const type = schemaType(parameter.schema, spec) ?? "value";
    const notes = [
      parameter.in === "path" ? "path" : "query",
      parameter.required || parameter.in === "path" ? "required" : "",
      parameter.name === command.orgParam ? "or --org" : "",
    ].filter(Boolean);
    const description = parameter.description ? ` ${oneLine(parameter.description)}` : "";
    return `  --${parameter.name} <${type}>  (${notes.join(", ")})${description}`;
  });
  if (operation.requestBody) {
    flags.push(
      `  --json <json|@file>  (body${operation.requestBody.required ? ", required" : ""}) see: trt schema ${commandKey(command)}`,
    );
  }

  const isWrite = command.httpMethod !== "get";
  return `trt ${commandWords(command).join(" ")}
  ${command.httpMethod.toUpperCase()} ${command.path}${isWrite ? "  (a write: sent only with --yes)" : ""}

${[operation.summary, operation.description].filter(Boolean).join("\n\n") || "No description."}

Flags:
${flags.length > 0 ? flags.join("\n") : "  none of its own"}

${GLOBAL_FLAGS}
`;
}

function commandLine(command: Command): string {
  const words = commandWords(command).join(" ");
  return `  ${words.padEnd(48)} ${command.httpMethod.toUpperCase().padEnd(6)} ${oneLine(command.operation.summary ?? "")}`;
}

function countCommands(resources: Map<string, Map<string, Command>>): number {
  return [...resources.values()].reduce((total, methods) => total + methods.size, 0);
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
