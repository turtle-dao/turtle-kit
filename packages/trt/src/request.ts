import { readFileSync } from "node:fs";

import type { CommandArgs } from "./args.ts";
import type { Command } from "./commands.ts";
import type { Io } from "./io.ts";
import { EXIT_API_ERROR, EXIT_UNREACHABLE, EXIT_USAGE, TrtError } from "./io.ts";

/** The request a command makes, as printed by `--dry-run` and an unconfirmed write. */
export interface ApiRequest {
  method: string;
  url: string;
  body?: unknown;
}

/** The `--page-limit` default: pages fetched by `--page-all`. */
export const DEFAULT_PAGE_LIMIT = 10;

/**
 * Builds the request from the command's flags: path parameters filled in
 * (`--org`, else `TURTLE_ORG_ID`, for the organization's), query parameters
 * appended, the body read from `--json '<json>'` or `--json @file`.
 */
export function buildRequest(
  io: Io,
  baseUrl: string,
  command: Command,
  args: CommandArgs,
): ApiRequest {
  const org = args.values.get("org")?.[0] ?? io.env.TURTLE_ORG_ID;
  let path = command.path;
  const query = new URLSearchParams();
  for (const parameter of command.parameters) {
    let values = args.values.get(parameter.name) ?? [];
    if (parameter.in === "path") {
      if (values.length === 0 && parameter.name === command.orgParam && org) {
        values = [org];
      }
      const [value, ...extra] = values;
      if (value === undefined) {
        const hint = parameter.name === command.orgParam ? " (or --org, or TURTLE_ORG_ID)" : "";
        throw new TrtError(`missing --${parameter.name}${hint}`, EXIT_USAGE);
      }
      if (extra.length > 0) {
        throw new TrtError(`flag --${parameter.name} given more than once`, EXIT_USAGE);
      }
      path = path.replace(`{${parameter.name}}`, encodeURIComponent(value));
      continue;
    }
    if (values.length === 0 && parameter.required) {
      throw new TrtError(`missing --${parameter.name}`, EXIT_USAGE);
    }
    for (const value of values) {
      query.append(parameter.name, value);
    }
  }

  const request: ApiRequest = {
    method: command.httpMethod.toUpperCase(),
    url: `${baseUrl}${path}`,
  };
  const search = query.toString();
  if (search) {
    request.url += `?${search}`;
  }

  const json = args.values.get("json")?.[0];
  if (json !== undefined) {
    if (!command.operation.requestBody) {
      throw new TrtError(
        `${request.method} ${command.path} takes no body; drop --json`,
        EXIT_USAGE,
      );
    }
    request.body = parseBody(json);
  } else if (command.operation.requestBody?.required) {
    throw new TrtError(
      `${request.method} ${command.path} needs a body: --json '<json>' or --json @file`,
      EXIT_USAGE,
    );
  }
  return request;
}

/** Sends the request and answers the parsed body, or throws the API's error. */
export async function send(io: Io, request: ApiRequest): Promise<unknown> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (io.env.TURTLE_API_KEY) {
    headers.Authorization = `Bearer ${io.env.TURTLE_API_KEY}`;
  }
  if (request.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await io.fetch(request.url, {
      method: request.method,
      headers,
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
  } catch (error) {
    throw new TrtError(
      `${request.method} ${request.url}: ${(error as Error).message}`,
      EXIT_UNREACHABLE,
    );
  }

  const text = await response.text();
  const body = parseResponse(text);
  if (!response.ok) {
    throw new TrtError(errorMessage(body, response), EXIT_API_ERROR, response.status, body);
  }
  return body;
}

/**
 * Fetches page after page, calling onPage with each body, following the paging
 * parameters the operation declares: `cursor` (the next one read from the
 * body's `nextCursor`), `page` (until `totalPages` or an empty page), or
 * `offset` (advanced by the items each page held). Stops after limit pages.
 */
export async function pageAll(
  io: Io,
  command: Command,
  first: ApiRequest,
  limit: number,
  onPage: (body: unknown) => void,
): Promise<void> {
  const style = pagingStyle(command);
  if (!style) {
    throw new TrtError(
      `${first.method} ${command.path} declares no paging parameter (cursor, page or offset)`,
      EXIT_USAGE,
    );
  }

  let request = first;
  for (let pages = 0; pages < limit; pages++) {
    const body = await send(io, request);
    onPage(body);
    const next = nextPageUrl(style, request.url, body);
    if (!next) {
      return;
    }
    request = { ...request, url: next };
  }
  io.stderr(`trt: stopped after ${limit} pages; raise --page-limit for more\n`);
}

type PagingStyle = "cursor" | "page" | "offset";

function pagingStyle(command: Command): PagingStyle | undefined {
  const names = new Set(command.parameters.filter((p) => p.in === "query").map((p) => p.name));
  if (names.has("cursor")) {
    return "cursor";
  }
  if (names.has("page")) {
    return "page";
  }
  return names.has("offset") ? "offset" : undefined;
}

function nextPageUrl(style: PagingStyle, current: string, body: unknown): string | undefined {
  const url = new URL(current);
  const items = firstArray(body);
  switch (style) {
    case "cursor": {
      const cursor = findField(body, ["nextCursor", "next_cursor"]);
      if ((typeof cursor !== "string" && typeof cursor !== "number") || cursor === "") {
        return undefined;
      }
      url.searchParams.set("cursor", String(cursor));
      return url.toString();
    }
    case "page": {
      const page = Number(url.searchParams.get("page") ?? "1");
      const totalPages = findField(body, ["totalPages", "total_pages"]);
      if (items?.length === 0 || (typeof totalPages === "number" && page >= totalPages)) {
        return undefined;
      }
      if (items === undefined && typeof totalPages !== "number") {
        return undefined;
      }
      url.searchParams.set("page", String(page + 1));
      return url.toString();
    }
    case "offset": {
      if (!items || items.length === 0) {
        return undefined;
      }
      const limit = Number(url.searchParams.get("limit") ?? Number.NaN);
      if (Number.isFinite(limit) && items.length < limit) {
        return undefined;
      }
      const offset = Number(url.searchParams.get("offset") ?? "0");
      url.searchParams.set("offset", String(offset + items.length));
      return url.toString();
    }
  }
}

/** The body itself when it is an array, else its first array-valued field. */
function firstArray(body: unknown): unknown[] | undefined {
  if (Array.isArray(body)) {
    return body;
  }
  if (body && typeof body === "object") {
    return Object.values(body).find(Array.isArray);
  }
  return undefined;
}

/** A field of the body, or of an object one level down (`pagination.totalPages`). */
function findField(body: unknown, names: string[]): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }
  const record = body as Record<string, unknown>;
  for (const name of names) {
    if (name in record) {
      return record[name];
    }
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const name of names) {
        if (name in value) {
          return (value as Record<string, unknown>)[name];
        }
      }
    }
  }
  return undefined;
}

function parseBody(json: string): unknown {
  let text = json;
  if (json.startsWith("@")) {
    try {
      text = readFileSync(json.slice(1), "utf8");
    } catch (error) {
      throw new TrtError(`read --json ${json}: ${(error as Error).message}`, EXIT_USAGE);
    }
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new TrtError(`--json is not valid JSON: ${(error as Error).message}`, EXIT_USAGE);
  }
}

function parseResponse(text: string): unknown {
  if (text.trim() === "") {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** The API's own message when it sent one (`error`, `message` or `detail`), else the status. */
function errorMessage(body: unknown, response: Response): string {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    const nested =
      record.error && typeof record.error === "object"
        ? (record.error as Record<string, unknown>).message
        : undefined;
    const message = [record.error, nested, record.message, record.detail].find(
      (value) => typeof value === "string",
    );
    if (message) {
      return message as string;
    }
  }
  if (typeof body === "string" && body.trim() !== "") {
    return body.trim().slice(0, 500);
  }
  return `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
}
