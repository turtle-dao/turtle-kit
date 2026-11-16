import type { Command } from "./commands";
import { commandKey } from "./commands";
import type { JsonSchema, OpenAPIDocument } from "./spec";
import { schemaRefName } from "./spec";

/** What `trt schema <product.resource.method>` prints: the call's input and output. */
export function describeCommand(command: Command, spec: OpenAPIDocument) {
  const { operation } = command;
  const success = Object.entries(operation.responses ?? {}).find(([code]) =>
    code.startsWith("2"),
  )?.[1];
  return {
    command: commandKey(command),
    method: command.httpMethod.toUpperCase(),
    path: command.path,
    operationId: operation.operationId,
    summary: operation.summary,
    description: operation.description,
    parameters: command.parameters.map((parameter) => ({
      name: parameter.name,
      in: parameter.in,
      required: parameter.required ?? false,
      description: parameter.description,
      schema: inlineRefs(parameter.schema, spec),
    })),
    body: inlineRefs(operation.requestBody?.content?.["application/json"]?.schema, spec) ?? null,
    response: inlineRefs(success?.content?.["application/json"]?.schema, spec) ?? null,
  };
}

/**
 * Replaces every `#/components/schemas/…` reference with the schema it names.
 * A schema already being expanded on the way down stays a `$ref`, so a
 * recursive type prints once instead of forever.
 */
export function inlineRefs(
  schema: unknown,
  spec: OpenAPIDocument,
  expanding: ReadonlySet<string> = new Set(),
): JsonSchema | undefined {
  if (schema === undefined) {
    return undefined;
  }
  return inline(schema, spec, expanding) as JsonSchema;
}

function inline(node: unknown, spec: OpenAPIDocument, expanding: ReadonlySet<string>): unknown {
  if (Array.isArray(node)) {
    return node.map((child) => inline(child, spec, expanding));
  }
  if (!node || typeof node !== "object") {
    return node;
  }
  const record = node as Record<string, unknown>;
  const name = schemaRefName(record.$ref);
  if (name !== undefined) {
    const target = spec.components?.schemas?.[name];
    if (!target || expanding.has(name)) {
      return record;
    }
    return inline(target, spec, new Set([...expanding, name]));
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [key, inline(child, spec, expanding)]),
  );
}
