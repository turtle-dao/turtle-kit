import type { GlobalSwitch } from "./args.ts";
import { parseCommandArgs, splitArgs } from "./args.ts";
import type { Command, CommandTree, SonarSpec } from "./commands.ts";
import { buildCommandTree, findCommand, nearCommands } from "./commands.ts";
import { commandHelp, productHelp, resourceHelp, rootHelp } from "./help.ts";
import type { Io } from "./io.ts";
import { EXIT_USAGE, TrtError } from "./io.ts";
import type { ApiRequest } from "./request.ts";
import { buildRequest, DEFAULT_PAGE_LIMIT, pageAll, send } from "./request.ts";
import { describeCommand } from "./schema.ts";
import type { LoadedSpec, OpenAPIDocument } from "./spec.ts";
import { DEFAULT_API_URL, DEFAULT_SONAR_URL, loadSpec } from "./spec.ts";

/** Runs trt with argv (without the program name) and answers the exit code. */
export async function run(argv: string[], io: Io): Promise<number> {
  try {
    return await dispatch(argv, io);
  } catch (error) {
    if (error instanceof TrtError) {
      const failure: Record<string, unknown> = { status: error.status, error: error.message };
      if (error.details && typeof error.details === "object") {
        failure.details = error.details;
      }
      writeJson(io, failure);
      return error.exitCode;
    }
    writeJson(io, { status: 0, error: (error as Error).message ?? String(error) });
    return 1;
  }
}

async function dispatch(argv: string[], io: Io): Promise<number> {
  const { words, switches, rest } = splitArgs(argv);
  const baseUrl = (io.env.TURTLE_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
  const sonarUrl = (io.env.TURTLE_SONAR_URL || DEFAULT_SONAR_URL).replace(/\/+$/, "");
  let specs = await loadSpecs(io, baseUrl, sonarUrl, switches.has("refresh"));
  let tree = buildCommandTree(specs.gateway, specs.sonar);
  // A name the cached spec lacks may be a call the API gained since, or one the key's role
  // reaches now: fetch the spec again before saying there is no such command.
  if (specs.fromCache && namesUnknown(tree, words)) {
    specs = await loadSpecs(io, baseUrl, sonarUrl, true);
    tree = buildCommandTree(specs.gateway, specs.sonar);
  }

  if (words[0] === "schema") {
    return printSchema(io, tree, words.slice(1), rest);
  }

  const resolved = resolveCommand(tree, words);
  if (!resolved.command) {
    if (!switches.has("help") && words.length > 0) {
      throw new TrtError(resolved.problem, EXIT_USAGE);
    }
    io.stderr(resolved.help);
    return switches.has("help") ? 0 : EXIT_USAGE;
  }

  const { command } = resolved;
  if (switches.has("help")) {
    io.stderr(commandHelp(command, command.spec));
    return 0;
  }
  const args = parseCommandArgs(rest, command, command.spec);
  const request = buildRequest(io, baseUrl, command, args);
  return execute(io, command, request, switches, args.values.get("page-limit")?.[0]);
}

/** The specs the commands come from: the gateway's, and Sonar v1's for `trt sonar`. */
interface Specs {
  gateway: OpenAPIDocument;
  sonar?: SonarSpec;
  /** Either came from the cache rather than the API just now. */
  fromCache: boolean;
}

/**
 * Loads the gateway's spec, and Sonar v1's. Offline (`TRT_SPEC`), v1's is read from
 * `TRT_SONAR_SPEC`, or not at all. Without v1's, from either, `trt sonar` is the gateway's
 * own Sonar routes, and a v1 spec that could not be read says so on stderr.
 */
async function loadSpecs(
  io: Io,
  baseUrl: string,
  sonarUrl: string,
  refresh: boolean,
): Promise<Specs> {
  const gateway = await loadSpec(io, { baseUrl, file: io.env.TRT_SPEC }, refresh);
  const sonarFile = io.env.TRT_SONAR_SPEC;
  let sonar: LoadedSpec | undefined;
  if (sonarFile || !io.env.TRT_SPEC) {
    try {
      sonar = await loadSpec(io, { baseUrl: sonarUrl, file: sonarFile, sonar: true }, refresh);
    } catch (error) {
      io.stderr(
        `trt: Sonar v1: ${(error as Error).message}; trt sonar calls the gateway's Sonar routes\n`,
      );
    }
  }
  return {
    gateway: gateway.spec,
    ...(sonar ? { sonar: { spec: sonar.spec, baseUrl: sonarUrl } } : {}),
    fromCache: gateway.fromCache || (sonar?.fromCache ?? false),
  };
}

async function execute(
  io: Io,
  command: Command,
  request: ApiRequest,
  switches: Set<GlobalSwitch>,
  pageLimitFlag: string | undefined,
): Promise<number> {
  const isWrite = request.method !== "GET";
  if (switches.has("dry-run") || (isWrite && !switches.has("yes"))) {
    writeJson(io, { sent: false, ...request });
    if (!switches.has("dry-run")) {
      io.stderr(`trt: ${request.method} is a write; not sent. Add --yes to send it.\n`);
    }
    return 0;
  }

  if (!switches.has("page-all")) {
    writeJson(io, await send(io, request));
    return 0;
  }
  const pageLimit = pageLimitFlag === undefined ? DEFAULT_PAGE_LIMIT : Number(pageLimitFlag);
  if (!Number.isInteger(pageLimit) || pageLimit < 1) {
    throw new TrtError(
      `--page-limit must be a whole number above 0, not "${pageLimitFlag}"`,
      EXIT_USAGE,
    );
  }
  await pageAll(io, command, request, pageLimit, (body) => io.stdout(`${JSON.stringify(body)}\n`));
  return 0;
}

function printSchema(io: Io, tree: CommandTree, words: string[], rest: string[]): number {
  if (words.length === 0 || rest.length > 0) {
    throw new TrtError(
      "usage: trt schema <command>, its words as you run it: trt schema streams drafts create " +
        "(or joined by dots: streams.drafts.create)",
      EXIT_USAGE,
    );
  }
  // `streams list` and `streams.list` name the same command: a product with no resource
  // has two words, not three
  const key = words.join(".");
  const command = findCommand(tree, key);
  if (!command) {
    const near = nearCommands(tree, key);
    throw new TrtError(
      near.length > 0
        ? `no command ${key}; did you mean ${near.join(", ")}?`
        : `no command ${key}; run trt --help for the products`,
      EXIT_USAGE,
    );
  }
  writeJson(io, describeCommand(command, command.spec));
  return 0;
}

type Resolution =
  | { command: Command }
  | { command?: undefined; help: string; problem: string; unknown?: boolean };

/** Whether words name a product, resource, method or schema the spec does not have. */
function namesUnknown(tree: CommandTree, words: string[]): boolean {
  if (words[0] === "schema") {
    return words.length > 1 && !findCommand(tree, words.slice(1).join("."));
  }
  const resolved = resolveCommand(tree, words);
  return !resolved.command && resolved.unknown === true;
}

/**
 * Finds the command the words name. The resource word is left out for a
 * command whose path has no resource (`trt organization get`).
 */
function resolveCommand(tree: CommandTree, words: string[]): Resolution {
  const [product, second, third, ...extra] = words;
  if (!product) {
    return { help: rootHelp(tree), problem: "" };
  }
  const resources = tree.get(product);
  if (!resources) {
    return {
      help: rootHelp(tree),
      problem: `no product "${product}"; run trt --help for the list`,
      unknown: true,
    };
  }
  if (second === undefined) {
    return {
      help: productHelp(product, resources),
      problem: `trt ${product} needs a resource and a method`,
    };
  }

  const methods = resources.get(second);
  if (methods) {
    const command = third === undefined ? undefined : methods.get(third);
    if (command && extra.length === 0) {
      return { command };
    }
    const problem =
      third === undefined
        ? `trt ${product} ${second} needs a method`
        : extra.length > 0
          ? `unexpected argument "${extra[0]}"`
          : `no method "${third}" on trt ${product} ${second}`;
    return {
      help: resourceHelp(methods),
      problem,
      unknown: third !== undefined && extra.length === 0,
    };
  }

  const productMethods = resources.get("");
  const command = productMethods?.get(second);
  if (productMethods && command) {
    return third === undefined
      ? { command }
      : { help: resourceHelp(productMethods), problem: `unexpected argument "${third}"` };
  }
  return {
    help: productHelp(product, resources),
    problem: `no resource "${second}" in trt ${product}; run trt ${product} --help`,
    unknown: true,
  };
}

function writeJson(io: Io, value: unknown): void {
  io.stdout(`${io.isTTY ? JSON.stringify(value, null, 2) : JSON.stringify(value)}\n`);
}
