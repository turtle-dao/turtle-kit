import type { HttpMethod, OpenAPIDocument, Operation, Parameter } from "./spec";
import { HTTP_METHODS } from "./spec";

/** One API operation, addressed as `trt <product> [resource] <method>`. */
export interface Command {
  product: string;
  /** Empty when the path has no static segment past the product. */
  resource: string;
  method: string;
  httpMethod: HttpMethod;
  path: string;
  operation: Operation;
  /** Path and query parameters, path-level ones merged in. */
  parameters: Parameter[];
  /** The path parameter `--org` fills, on `/organization/{…}/` paths. */
  orgParam?: string;
}

/** product → resource → method → command. */
export type CommandTree = Map<string, Map<string, Map<string, Command>>>;

const ORGANIZATION_SEGMENT = "organization";

/**
 * Derives the command tree from the spec's paths.
 *
 * - **product**: the first segment after `/organization/{id}/`, or the path's
 *   first segment (`sonar`, `billing`, `turtle`, `admin`, …).
 * - **resource**: the static segments after the product, joined with `-`.
 * - **method**: a GET on an item (the path ends in a parameter) is `get`, any
 *   other GET `list`; POST is `create`, PUT and PATCH `update`, DELETE
 *   `delete`. A path ending in a static segment right after a parameter
 *   (`/contacts/{contactId}/merge`) is an action on an item: the segment is
 *   the method and the resource is what comes before it.
 * - Two operations that land on the same command both fall back to a method
 *   named after their operationId (`sonarMergeContact` → `merge-contact`).
 */
export function buildCommandTree(spec: OpenAPIDocument): CommandTree {
  const commands: Command[] = [];
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    for (const httpMethod of HTTP_METHODS) {
      const operation = item[httpMethod];
      if (!operation) {
        continue;
      }
      const parameters = mergeParameters(item.parameters, operation.parameters);
      const command = deriveCommand(path, httpMethod, operation, parameters);
      if (command) {
        commands.push(command);
      }
    }
  }

  const byKey = new Map<string, Command[]>();
  for (const command of commands) {
    const key = commandKey(command);
    byKey.set(key, [...(byKey.get(key) ?? []), command]);
  }

  const tree: CommandTree = new Map();
  for (const group of byKey.values()) {
    for (const command of group) {
      if (group.length > 1) {
        command.method = operationName(command);
      }
      addToTree(tree, command);
    }
  }
  return tree;
}

/** `product.resource.method`, the name `trt schema` takes. */
export function commandKey(command: Pick<Command, "product" | "resource" | "method">): string {
  return [command.product, command.resource, command.method].filter(Boolean).join(".");
}

/** The words that run the command, as typed after `trt`. */
export function commandWords(command: Command): string[] {
  return [command.product, command.resource, command.method].filter(Boolean);
}

/** Finds the command a dotted `product.resource.method` names. */
export function findCommand(tree: CommandTree, key: string): Command | undefined {
  for (const resources of tree.values()) {
    for (const methods of resources.values()) {
      for (const command of methods.values()) {
        if (commandKey(command) === key) {
          return command;
        }
      }
    }
  }
  return undefined;
}

function deriveCommand(
  path: string,
  httpMethod: HttpMethod,
  operation: Operation,
  parameters: Parameter[],
): Command | undefined {
  let segments = path.split("/").filter(Boolean);
  let orgParam: string | undefined;
  if (segments[0] === ORGANIZATION_SEGMENT && segments[1] && isParam(segments[1])) {
    orgParam = paramName(segments[1]);
    segments = segments.slice(2);
    // `/organization/{id}` itself, and paths whose next segment is a
    // parameter, stay under the organization product.
    if (!segments[0] || isParam(segments[0])) {
      segments = [ORGANIZATION_SEGMENT, `{${orgParam}}`, ...segments];
    }
  }
  const [product, ...rest] = segments;
  if (!product || isParam(product)) {
    return undefined;
  }

  const last = rest.at(-1);
  const beforeLast = rest.at(-2);
  const isAction =
    last !== undefined && !isParam(last) && beforeLast !== undefined && isParam(beforeLast);
  const statics = rest.filter((segment) => !isParam(segment));

  let resource: string;
  let method: string;
  if (isAction) {
    resource = statics.slice(0, -1).join("-");
    method = last;
  } else {
    resource = statics.join("-");
    method = crudMethod(httpMethod, last !== undefined && isParam(last));
  }

  return { product, resource, method, httpMethod, path, operation, parameters, orgParam };
}

function crudMethod(httpMethod: HttpMethod, onItem: boolean): string {
  switch (httpMethod) {
    case "get":
      return onItem ? "get" : "list";
    case "post":
      return "create";
    case "put":
    case "patch":
      return "update";
    case "delete":
      return "delete";
  }
}

/**
 * The method a colliding operation falls back to: its operationId in kebab
 * case, without a leading product name (`sonarMergeContact` →
 * `merge-contact`), or the HTTP method when it has none.
 */
function operationName(command: Command): string {
  const id = command.operation.operationId;
  if (!id) {
    return `${command.method}-${command.httpMethod}`;
  }
  const words = id
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-z0-9-]+/gi, "-")
    .toLowerCase()
    .split("-")
    .filter(Boolean);
  const productWords = command.product.split("-");
  const startsWithProduct = productWords.every((word, index) => words[index] === word);
  const name = (
    startsWithProduct && words.length > productWords.length
      ? words.slice(productWords.length)
      : words
  ).join("-");
  return name || `${command.method}-${command.httpMethod}`;
}

function mergeParameters(
  pathLevel: Parameter[] = [],
  operationLevel: Parameter[] = [],
): Parameter[] {
  const merged = new Map<string, Parameter>();
  for (const parameter of [...pathLevel, ...operationLevel]) {
    merged.set(`${parameter.in}:${parameter.name}`, parameter);
  }
  return [...merged.values()].filter(
    (parameter) => parameter.in === "path" || parameter.in === "query",
  );
}

function addToTree(tree: CommandTree, command: Command): void {
  let resources = tree.get(command.product);
  if (!resources) {
    resources = new Map();
    tree.set(command.product, resources);
  }
  let methods = resources.get(command.resource);
  if (!methods) {
    methods = new Map();
    resources.set(command.resource, methods);
  }
  methods.set(command.method, command);
}

function isParam(segment: string): boolean {
  return segment.startsWith("{") && segment.endsWith("}");
}

function paramName(segment: string): string {
  return segment.slice(1, -1);
}
