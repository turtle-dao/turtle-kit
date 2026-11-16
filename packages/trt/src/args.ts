import type { Command } from "./commands.ts";
import { EXIT_USAGE, TrtError } from "./io.ts";
import type { JsonSchema, OpenAPIDocument, Parameter } from "./spec.ts";
import { schemaRefName } from "./spec.ts";

/** Flags every command takes that hold no value. */
export const GLOBAL_SWITCHES = ["yes", "dry-run", "page-all", "refresh", "help"] as const;
/** Flags every command takes that hold a value. */
export const GLOBAL_OPTIONS = ["org", "json", "page-limit"] as const;

export type GlobalSwitch = (typeof GLOBAL_SWITCHES)[number];

export interface SplitArgs {
  /** The words before the first command flag: product, resource, method. */
  words: string[];
  switches: Set<GlobalSwitch>;
  /** Everything from the first command flag on, read once the command is known. */
  rest: string[];
}

export interface CommandArgs {
  /** Flag name → values, in order; a parameter may repeat. */
  values: Map<string, string[]>;
}

/**
 * Splits argv into the command words and the rest. Global switches may sit
 * anywhere; the command's own flags come after its words.
 */
export function splitArgs(argv: string[]): SplitArgs {
  const words: string[] = [];
  const switches = new Set<GlobalSwitch>();
  const rest: string[] = [];
  for (const arg of argv) {
    const name = switchName(arg);
    if (name) {
      switches.add(name);
    } else if (rest.length > 0 || arg.startsWith("-")) {
      rest.push(arg);
    } else {
      words.push(arg);
    }
  }
  return { words, switches, rest };
}

/**
 * Reads a command's flags against its spec: `--name value` or `--name=value`
 * for its path and query parameters and the global options. A flag the
 * operation does not declare is refused.
 */
export function parseCommandArgs(
  rest: string[],
  command: Command,
  spec: OpenAPIDocument,
): CommandArgs {
  const parameters = new Map(command.parameters.map((parameter) => [parameter.name, parameter]));
  const values = new Map<string, string[]>();
  for (let index = 0; index < rest.length; index++) {
    // In range, since index < rest.length.
    const arg = rest[index] as string;
    if (!arg.startsWith("--") || arg === "--") {
      throw new TrtError(
        `unexpected argument "${arg}"; flags take the form --name value`,
        EXIT_USAGE,
      );
    }
    const [name, inlineValue] = splitFlag(arg.slice(2));
    const parameter = parameters.get(name);
    const isGlobalOption = (GLOBAL_OPTIONS as readonly string[]).includes(name);
    if (!parameter && !isGlobalOption) {
      throw new TrtError(
        `unknown flag --${name} for ${command.httpMethod.toUpperCase()} ${command.path}`,
        EXIT_USAGE,
      );
    }

    let value = inlineValue;
    if (value === undefined && parameter && isBooleanParameter(parameter, spec)) {
      value = "true";
    }
    if (value === undefined) {
      const next = rest[index + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new TrtError(`flag --${name} needs a value`, EXIT_USAGE);
      }
      value = next;
      index++;
    }
    values.set(name, [...(values.get(name) ?? []), value]);
  }

  for (const name of GLOBAL_OPTIONS) {
    if ((values.get(name)?.length ?? 0) > 1) {
      throw new TrtError(`flag --${name} given more than once`, EXIT_USAGE);
    }
  }
  return { values };
}

/** Follows a `#/components/schemas/…` reference, once. */
export function resolveRef(
  schema: JsonSchema | undefined,
  spec: OpenAPIDocument,
): JsonSchema | undefined {
  const name = schemaRefName(schema?.$ref);
  return name === undefined ? schema : spec.components?.schemas?.[name];
}

/** The schema's type, without "null": `["boolean","null"]` is "boolean". */
export function schemaType(
  schema: JsonSchema | undefined,
  spec: OpenAPIDocument,
): string | undefined {
  const type = resolveRef(schema, spec)?.type;
  if (Array.isArray(type)) {
    return type.find((entry) => entry !== "null") as string | undefined;
  }
  return typeof type === "string" ? type : undefined;
}

function isBooleanParameter(parameter: Parameter, spec: OpenAPIDocument): boolean {
  return schemaType(parameter.schema, spec) === "boolean";
}

function switchName(arg: string): GlobalSwitch | undefined {
  if (arg === "-h") {
    return "help";
  }
  const name = arg.startsWith("--") ? arg.slice(2) : "";
  return (GLOBAL_SWITCHES as readonly string[]).includes(name) ? (name as GlobalSwitch) : undefined;
}

function splitFlag(flag: string): [string, string | undefined] {
  const equals = flag.indexOf("=");
  return equals === -1 ? [flag, undefined] : [flag.slice(0, equals), flag.slice(equals + 1)];
}
