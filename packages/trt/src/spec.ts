import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { Io } from "./io.ts";
import { EXIT_API_ERROR, EXIT_UNREACHABLE, EXIT_USAGE, TrtError } from "./io.ts";

/** The parts of an OpenAPI 3.1 document trt reads. */
export interface OpenAPIDocument {
  openapi?: string;
  info?: { title?: string; version?: string };
  paths?: Record<string, PathItem>;
  components?: { schemas?: Record<string, JsonSchema> };
}

export type PathItem = Partial<Record<HttpMethod, Operation>> & { parameters?: Parameter[] };

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export const HTTP_METHODS: HttpMethod[] = ["get", "post", "put", "patch", "delete"];

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: { required?: boolean; content?: Record<string, { schema?: JsonSchema }> };
  responses?: Record<
    string,
    { description?: string; content?: Record<string, { schema?: JsonSchema }> }
  >;
}

export interface Parameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
}

export type JsonSchema = Record<string, unknown>;

const SCHEMA_REF_PREFIX = "#/components/schemas/";

/**
 * The components.schemas entry a `$ref` names, its JSON pointer unescaped
 * (`~1` is `/`, `~0` is `~`); undefined for any other reference.
 */
export function schemaRefName(ref: unknown): string | undefined {
  if (typeof ref !== "string" || !ref.startsWith(SCHEMA_REF_PREFIX)) {
    return undefined;
  }
  return ref.slice(SCHEMA_REF_PREFIX.length).replaceAll("~1", "/").replaceAll("~0", "~");
}

/** How long a fetched spec is trusted before trt fetches it again. */
export const SPEC_TTL_MS = 60 * 60 * 1000;

export const DEFAULT_API_URL = "https://api.turtle.xyz";

/** Sonar v1, the public versioned Sonar API: where `trt sonar` calls go. */
export const DEFAULT_SONAR_URL = "https://sonar.turtle.xyz/v1";

/** The host Sonar v1 answers on. The API tells v1 apart by the Host a request names, not by
 *  its path, so a v1 base elsewhere (a local stack's `http://localhost:8080/v1`) is sent
 *  with this Host. */
export const SONAR_HOST = "sonar.turtle.xyz";

/** The Host a call to Sonar v1 at `url` names: SONAR_HOST, where the URL names another; else
 *  none, and the URL's own goes. */
export function sonarHostFor(url: string): string | undefined {
  return new URL(url).hostname === SONAR_HOST ? undefined : SONAR_HOST;
}

/** The spec, and whether it came from the cache rather than the API just now. */
export interface LoadedSpec {
  spec: OpenAPIDocument;
  fromCache: boolean;
}

/** Where a spec comes from: the gateway's, read with the key, or Sonar v1's, which is public. */
export interface SpecSource {
  /** `<baseUrl>/openapi.json` is the spec; the cache is keyed by it. */
  baseUrl: string;
  /** A file to read the spec from instead (`TRT_SPEC`, `TRT_SONAR_SPEC`). */
  file?: string;
  /** Sonar v1's: no key is sent, and its Host is named (sonarHostFor). */
  sonar?: boolean;
}

interface CachedSpec {
  fetchedAt: number;
  baseUrl: string;
  spec: OpenAPIDocument;
}

/**
 * Loads a spec: from its file when one is named (offline use and tests), else
 * from the cache when it is younger than an hour, else from
 * `GET <base>/openapi.json`. A failed fetch falls back to a stale cache, with a
 * warning, rather than leaving the CLI with no commands.
 */
export async function loadSpec(
  io: Io,
  source: SpecSource,
  refresh: boolean,
): Promise<LoadedSpec> {
  const { baseUrl, file: specFile } = source;
  if (specFile) {
    let text: string;
    try {
      text = readFileSync(specFile, "utf8");
    } catch (error) {
      throw new TrtError(
        `read the spec from ${specFile}: ${(error as Error).message}`,
        EXIT_UNREACHABLE,
      );
    }
    return { spec: parseSpec(text, specFile), fromCache: false };
  }

  const cacheFile = specCacheFile(io, baseUrl);
  const cached = readCache(cacheFile);
  if (cached && !refresh && io.now() - cached.fetchedAt < SPEC_TTL_MS) {
    return { spec: cached.spec, fromCache: true };
  }

  try {
    const spec = await fetchSpec(io, source);
    writeCache(io, cacheFile, { fetchedAt: io.now(), baseUrl, spec });
    return { spec, fromCache: false };
  } catch (error) {
    // Only an API out of reach falls back: a key the API refuses would answer every call the
    // same way, and an old spec would hide that behind commands that all fail
    if (!cached || !(error instanceof TrtError) || error.exitCode !== EXIT_UNREACHABLE) {
      throw error;
    }
    io.stderr(
      `trt: ${(error as Error).message}; using the cached spec from ${new Date(cached.fetchedAt).toISOString()}\n`,
    );
    return { spec: cached.spec, fromCache: false };
  }
}

/**
 * Where the spec for baseUrl is cached: the user's cache directory (XDG on
 * Linux, ~/Library/Caches on macOS, %LOCALAPPDATA% on Windows), one file per
 * base URL. `TRT_CACHE_DIR` overrides the directory.
 */
export function specCacheFile(io: Io, baseUrl: string): string {
  const key = createHash("sha256").update(baseUrl).digest("hex").slice(0, 16);
  return join(cacheDir(io), `spec-${key}.json`);
}

function cacheDir(io: Io): string {
  if (io.env.TRT_CACHE_DIR) {
    return io.env.TRT_CACHE_DIR;
  }
  const home = io.env.HOME || homedir();
  if (io.platform === "darwin") {
    return join(home, "Library", "Caches", "trt");
  }
  if (io.platform === "win32") {
    return join(io.env.LOCALAPPDATA || join(home, "AppData", "Local"), "trt", "cache");
  }
  return join(io.env.XDG_CACHE_HOME || join(home, ".cache"), "trt");
}

async function fetchSpec(io: Io, source: SpecSource): Promise<OpenAPIDocument> {
  const url = `${source.baseUrl}/openapi.json`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (source.sonar) {
    // the published contract: read with no key
    const host = sonarHostFor(url);
    if (host) {
      headers.Host = host;
    }
  } else {
    const apiKey = io.env.TURTLE_API_KEY;
    if (!apiKey) {
      throw new TrtError(
        "TURTLE_API_KEY is not set: it is needed to fetch the API's spec",
        EXIT_USAGE,
      );
    }
    headers.Authorization = `Bearer ${apiKey}`;
  }
  let response: Response;
  try {
    response = await io.fetch(url, { headers });
  } catch (error) {
    throw new TrtError(`fetch ${url}: ${(error as Error).message}`, EXIT_UNREACHABLE);
  }
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    throw new TrtError(`fetch ${url}: ${(error as Error).message}`, EXIT_UNREACHABLE);
  }
  if (!source.sonar && (response.status === 401 || response.status === 403)) {
    throw new TrtError(
      `the API refuses TURTLE_API_KEY (HTTP ${response.status}): the key is revoked, ` +
        "expired or wrong, so no call will work until the member makes a new one",
      EXIT_API_ERROR,
      response.status,
    );
  }
  if (!response.ok) {
    const detail = text.trim().slice(0, 200);
    throw new TrtError(
      `fetch ${url}: HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
      EXIT_UNREACHABLE,
    );
  }
  return parseSpec(text, url);
}

function parseSpec(text: string, source: string): OpenAPIDocument {
  let spec: unknown;
  try {
    spec = JSON.parse(text);
  } catch (error) {
    throw new TrtError(
      `read the spec from ${source}: ${(error as Error).message}`,
      EXIT_UNREACHABLE,
    );
  }
  if (
    typeof spec !== "object" ||
    spec === null ||
    typeof (spec as OpenAPIDocument).paths !== "object"
  ) {
    throw new TrtError(`read the spec from ${source}: it has no paths`, EXIT_UNREACHABLE);
  }
  return spec as OpenAPIDocument;
}

function readCache(file: string): CachedSpec | undefined {
  try {
    const cached = JSON.parse(readFileSync(file, "utf8")) as CachedSpec;
    return Number.isFinite(cached.fetchedAt) && cached.spec?.paths ? cached : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(io: Io, file: string, cached: CachedSpec): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(cached));
  } catch (error) {
    io.stderr(`trt: could not cache the spec at ${file}: ${(error as Error).message}\n`);
  }
}
