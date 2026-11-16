import type { GlobalSwitch } from "./args";
import { parseCommandArgs, splitArgs } from "./args";
import type { Command, CommandTree } from "./commands";
import { buildCommandTree, findCommand } from "./commands";
import { commandHelp, productHelp, resourceHelp, rootHelp } from "./help";
import type { Io } from "./io";
import { EXIT_USAGE, TrtError } from "./io";
import type { ApiRequest } from "./request";
import { buildRequest, DEFAULT_PAGE_LIMIT, pageAll, send } from "./request";
import { describeCommand } from "./schema";
import type { OpenAPIDocument } from "./spec";
import { DEFAULT_API_URL, loadSpec } from "./spec";

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
  const spec = await loadSpec(io, baseUrl, switches.has("refresh"));
  const tree = buildCommandTree(spec);

  if (words[0] === "schema") {
    return printSchema(io, tree, spec, words.slice(1), rest);
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
    io.stderr(commandHelp(command, spec));
    return 0;
  }
  const args = parseCommandArgs(rest, command, spec);
  const request = buildRequest(io, baseUrl, command, args);
  return execute(io, command, request, switches, args.values.get("page-limit")?.[0]);
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

function printSchema(
  io: Io,
  tree: CommandTree,
  spec: OpenAPIDocument,
  words: string[],
  rest: string[],
): number {
  const [key, ...extra] = [...words, ...rest];
  if (!key || extra.length > 0) {
    throw new TrtError(
      "usage: trt schema <product.resource.method>, e.g. trt schema sonar.contacts.list",
      EXIT_USAGE,
    );
  }
  const command = findCommand(tree, key);
  if (!command) {
    throw new TrtError(`no command ${key}; run trt --help for the products`, EXIT_USAGE);
  }
  writeJson(io, describeCommand(command, spec));
  return 0;
}

type Resolution = { command: Command } | { command?: undefined; help: string; problem: string };

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
    return { help: resourceHelp(methods), problem };
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
  };
}

function writeJson(io: Io, value: unknown): void {
  io.stdout(`${io.isTTY ? JSON.stringify(value, null, 2) : JSON.stringify(value)}\n`);
}
