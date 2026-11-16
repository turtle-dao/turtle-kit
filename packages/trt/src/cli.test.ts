import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { run } from "./cli";
import { buildCommandTree, commandKey } from "./commands";
import type { Io } from "./io";
import type { OpenAPIDocument } from "./spec";
import { SPEC_TTL_MS, specCacheFile } from "./spec";

// A subset of the real spec, reflected from the API's own handlers (Sonar
// contacts, messages and rules, products, two /admin routes).
const FIXTURE = join(import.meta.dirname, "__fixtures__", "openapi.json");
const fixtureSpec = JSON.parse(readFileSync(FIXTURE, "utf8")) as OpenAPIDocument;

const ORG = "11111111-1111-4111-8111-111111111111";
const CONTACT = "22222222-2222-4222-8222-222222222222";
const API = "https://api.test";

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

type Reply =
  | { status?: number; body?: unknown }
  | ((call: Call) => { status?: number; body?: unknown });

/** An Io over a mocked fetch: replies are served in order, calls recorded. */
function fakeIo(options: { env?: Record<string, string>; replies?: Reply[]; now?: number } = {}) {
  const calls: Call[] = [];
  const replies = [...(options.replies ?? [])];
  const out: string[] = [];
  const err: string[] = [];
  const io: Io = {
    env: { TRT_SPEC: FIXTURE, TURTLE_API_URL: API, TURTLE_API_KEY: "sk_live_test", ...options.env },
    fetch: (async (input: string, init: RequestInit = {}) => {
      const call: Call = {
        url: String(input),
        method: init.method ?? "GET",
        headers: (init.headers ?? {}) as Record<string, string>,
        body: init.body as string | undefined,
      };
      calls.push(call);
      const next = replies.shift();
      if (!next) {
        throw new Error(`unexpected call ${call.method} ${call.url}`);
      }
      const reply = typeof next === "function" ? next(call) : next;
      const text = typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body ?? null);
      return new Response(text, { status: reply.status ?? 200 });
    }) as typeof fetch,
    stdout: (text) => out.push(text),
    stderr: (text) => err.push(text),
    now: () => options.now ?? Date.UTC(2026, 10, 16),
    platform: "linux",
    isTTY: false,
  };
  return {
    io,
    calls,
    stdout: () => out.join(""),
    stderr: () => err.join(""),
    json: () => JSON.parse(out.join("")) as Record<string, unknown>,
  };
}

describe("command derivation", () => {
  it("names commands product, resource, method from the paths", () => {
    const keys = [...buildCommandTree(fixtureSpec).values()]
      .flatMap((resources) => [...resources.values()])
      .flatMap((methods) => [...methods.values()])
      .map(commandKey)
      .sort();

    expect(keys).toEqual([
      "admin.organizations.create",
      "admin.organizations.update",
      "sonar.contacts-resolve.list",
      "sonar.contacts.create",
      "sonar.contacts.delete",
      "sonar.contacts.get",
      "sonar.contacts.list",
      "sonar.contacts.merge",
      "sonar.contacts.update",
      "sonar.messages.list",
      "sonar.rules.active",
      "sonar.rules.delete",
      "sonar.rules.list",
      "sonar.rules.update",
      "turtle.products-paginated.list",
      "turtle.products.get",
      "turtle.products.list",
    ]);
  });

  it("falls back to the operationId when two operations land on one command", () => {
    const path = "/organization/{organizationId}/sonar/mutations/{mutationId}/revert";
    const tree = buildCommandTree({
      paths: {
        [path]: {
          get: { operationId: "sonarPlanRevert" },
          post: { operationId: "sonarRevertMutation" },
        },
        "/organization/{organizationId}": { get: { operationId: "getOrganization" } },
      },
    });

    const mutations = tree.get("sonar")?.get("mutations");
    expect([...(mutations?.keys() ?? [])].sort()).toEqual(["plan-revert", "revert-mutation"]);
    expect(mutations?.get("plan-revert")?.httpMethod).toBe("get");
    expect(tree.get("organization")?.get("")?.get("get")?.orgParam).toBe("organizationId");
  });
});

describe("calls", () => {
  it("fills the organization from --org and sends the key", async () => {
    const t = fakeIo({ replies: [{ body: { contacts: [], nextCursor: "" } }] });

    const code = await run(
      ["sonar", "contacts", "list", "--org", ORG, "--limit", "5", "--internal"],
      t.io,
    );

    expect(code).toBe(0);
    expect(t.calls[0]?.url).toBe(`${API}/organization/${ORG}/sonar/contacts?internal=true&limit=5`);
    expect(t.calls[0]?.headers.Authorization).toBe("Bearer sk_live_test");
    expect(t.json()).toEqual({ contacts: [], nextCursor: "" });
  });

  it("takes the organization from TURTLE_ORG_ID when --org is absent", async () => {
    const t = fakeIo({ env: { TURTLE_ORG_ID: ORG }, replies: [{ body: { id: CONTACT } }] });

    await run(["sonar", "contacts", "get", "--contactId", CONTACT], t.io);

    expect(t.calls[0]?.url).toBe(`${API}/organization/${ORG}/sonar/contacts/${CONTACT}`);
  });

  it("refuses a missing path parameter without calling the API", async () => {
    const t = fakeIo();

    const code = await run(["sonar", "contacts", "get", "--org", ORG], t.io);

    expect(code).toBe(2);
    expect(t.calls).toHaveLength(0);
    expect(t.json()).toEqual({ status: 0, error: "missing --contactId" });
  });

  it("refuses a flag the operation does not declare", async () => {
    const t = fakeIo();

    const code = await run(["sonar", "contacts", "list", "--org", ORG, "--colour", "red"], t.io);

    expect(code).toBe(2);
    expect(t.calls).toHaveLength(0);
    expect(t.json().error).toBe(
      "unknown flag --colour for GET /organization/{organizationId}/sonar/contacts",
    );
  });

  it("refuses an unknown product", async () => {
    const t = fakeIo();

    const code = await run(["earn", "vaults", "list"], t.io);

    expect(code).toBe(2);
    expect(t.json().error).toBe('no product "earn"; run trt --help for the list');
  });

  it("answers an API failure as {status, error} with exit 1", async () => {
    const t = fakeIo({
      replies: [{ status: 404, body: { status: "NOT_FOUND", error: "contact not found" } }],
    });

    const code = await run(
      ["sonar", "contacts", "get", "--org", ORG, "--contactId", CONTACT],
      t.io,
    );

    expect(code).toBe(1);
    expect(t.json()).toEqual({
      status: 404,
      error: "contact not found",
      details: { status: "NOT_FOUND", error: "contact not found" },
    });
  });

  it("takes the API's message from message when it sends no error", async () => {
    const t = fakeIo({
      replies: [
        { status: 422, body: { message: "limit is too large" } },
        { status: 502, body: "" },
      ],
    });

    await run(["turtle", "products", "list"], t.io);
    await run(["turtle", "products", "list"], t.io);

    const [first, second] = t
      .stdout()
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { status: number; error: string });
    expect(first).toMatchObject({ status: 422, error: "limit is too large" });
    expect(second).toEqual({ status: 502, error: "HTTP 502" });
  });

  it("reads a message nested under error", async () => {
    const t = fakeIo({ replies: [{ status: 400, body: { error: { message: "bad page" } } }] });

    await run(["turtle", "products", "list"], t.io);

    expect(t.json().error).toBe("bad page");
  });

  it("resolves a reference whose name is escaped", async () => {
    const spec = join(mkdtempSync(join(tmpdir(), "trt-")), "spec.json");
    writeFileSync(
      spec,
      JSON.stringify({
        paths: {
          "/turtle/flags": {
            get: {
              parameters: [
                { name: "on", in: "query", schema: { $ref: "#/components/schemas/a~1b~0c" } },
              ],
            },
          },
        },
        components: { schemas: { "a/b~c": { type: "boolean" } } },
      }),
    );
    const t = fakeIo({ env: { TRT_SPEC: spec }, replies: [{ body: [] }] });

    await run(["turtle", "flags", "list", "--on"], t.io);

    expect(t.calls[0]?.url).toBe(`${API}/turtle/flags?on=true`);
  });

  it("refuses words after a command that has no resource", async () => {
    const spec = join(mkdtempSync(join(tmpdir(), "trt-")), "spec.json");
    writeFileSync(
      spec,
      JSON.stringify({ paths: { "/organization/{organizationId}": { get: {} } } }),
    );
    const t = fakeIo({ env: { TRT_SPEC: spec } });

    const code = await run(["organization", "get", "extra"], t.io);

    expect(code).toBe(2);
    expect(t.json().error).toBe('unexpected argument "extra"');
  });

  it("answers an unreachable API as {status: 0, error}", async () => {
    const t = fakeIo({
      replies: [
        () => {
          throw new Error("connection refused");
        },
      ],
    });

    const code = await run(["turtle", "products", "list"], t.io);

    expect(code).toBe(3);
    expect(t.json()).toEqual({
      status: 0,
      error: `GET ${API}/turtle/products/: connection refused`,
    });
  });
});

describe("writes", () => {
  const create = ["sonar", "contacts", "create", "--org", ORG, "--json", '{"name":"Ada"}'];

  it("prints a write and does not send it without --yes", async () => {
    const t = fakeIo();

    const code = await run(create, t.io);

    expect(code).toBe(0);
    expect(t.calls).toHaveLength(0);
    expect(t.json()).toEqual({
      sent: false,
      method: "POST",
      url: `${API}/organization/${ORG}/sonar/contacts`,
      body: { name: "Ada" },
    });
    expect(t.stderr()).toContain("Add --yes to send it");
  });

  it("sends a write with --yes", async () => {
    const t = fakeIo({ replies: [{ body: { applied: true } }] });

    const code = await run([...create, "--yes"], t.io);

    expect(code).toBe(0);
    expect(t.calls[0]?.method).toBe("POST");
    expect(t.calls[0]?.body).toBe('{"name":"Ada"}');
    expect(t.calls[0]?.headers["Content-Type"]).toBe("application/json");
    expect(t.json()).toEqual({ applied: true });
  });

  it("reads the body from a file with --json @file", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "trt-")), "body.json");
    writeFileSync(file, '{"name":"Grace"}');
    const t = fakeIo();

    await run(["sonar", "contacts", "create", "--org", ORG, "--json", `@${file}`], t.io);

    expect(t.json().body).toEqual({ name: "Grace" });
  });

  it("refuses a body that is not JSON", async () => {
    const t = fakeIo();

    const code = await run(["sonar", "contacts", "create", "--org", ORG, "--json", "{name"], t.io);

    expect(code).toBe(2);
    expect(String(t.json().error)).toMatch(/^--json is not valid JSON/);
  });

  it("sends nothing on --dry-run, even with --yes or for a GET", async () => {
    const t = fakeIo();

    await run(
      ["sonar", "contacts", "delete", "--org", ORG, "--contactId", CONTACT, "--yes", "--dry-run"],
      t.io,
    );
    await run(["turtle", "products", "list", "--dry-run"], t.io);

    expect(t.calls).toHaveLength(0);
    expect(
      t
        .stdout()
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as unknown),
    ).toEqual([
      {
        sent: false,
        method: "DELETE",
        url: `${API}/organization/${ORG}/sonar/contacts/${CONTACT}`,
      },
      { sent: false, method: "GET", url: `${API}/turtle/products/` },
    ]);
  });
});

describe("--page-all", () => {
  it("follows nextCursor and prints one line per page", async () => {
    const t = fakeIo({
      replies: [
        { body: { contacts: [{ id: "a" }], nextCursor: "c1" } },
        { body: { contacts: [{ id: "b" }], nextCursor: "c2" } },
        { body: { contacts: [{ id: "c" }], nextCursor: "" } },
      ],
    });

    const code = await run(
      ["sonar", "contacts", "list", "--org", ORG, "--limit", "1", "--page-all"],
      t.io,
    );

    expect(code).toBe(0);
    expect(t.calls.map((call) => new URL(call.url).search)).toEqual([
      "?limit=1",
      "?limit=1&cursor=c1",
      "?limit=1&cursor=c2",
    ]);
    expect(t.stdout().trim().split("\n")).toHaveLength(3);
  });

  it("follows page until totalPages", async () => {
    const page = (n: number) => ({
      body: { products: [{ id: n }], pagination: { page: n, totalPages: 2 } },
    });
    const t = fakeIo({ replies: [page(1), page(2)] });

    await run(["turtle", "products-paginated", "list", "--page", "1", "--page-all"], t.io);

    expect(t.calls.map((call) => new URL(call.url).searchParams.get("page"))).toEqual(["1", "2"]);
  });

  it("advances offset by the items each page held", async () => {
    const spec = join(mkdtempSync(join(tmpdir(), "trt-")), "spec.json");
    writeFileSync(
      spec,
      JSON.stringify({
        paths: {
          "/turtle/events": {
            get: {
              parameters: [
                { name: "limit", in: "query", schema: { type: "integer" } },
                { name: "offset", in: "query", schema: { type: "integer" } },
              ],
            },
          },
        },
      }),
    );
    const t = fakeIo({
      env: { TRT_SPEC: spec },
      replies: [{ body: [1, 2] }, { body: [3, 4] }, { body: [5] }],
    });

    await run(["turtle", "events", "list", "--limit", "2", "--page-all"], t.io);

    expect(t.calls.map((call) => new URL(call.url).searchParams.get("offset"))).toEqual([
      null,
      "2",
      "4",
    ]);
  });

  it("stops at --page-limit", async () => {
    const more = { body: { contacts: [{ id: "x" }], nextCursor: "more" } };
    const t = fakeIo({ replies: [more, more, more] });

    await run(["sonar", "contacts", "list", "--org", ORG, "--page-all", "--page-limit", "2"], t.io);

    expect(t.calls).toHaveLength(2);
    expect(t.stderr()).toContain("stopped after 2 pages");
  });

  it("follows a numeric cursor", async () => {
    const t = fakeIo({
      replies: [
        { body: { contacts: [{ id: "a" }], nextCursor: 7 } },
        { body: { contacts: [], nextCursor: "" } },
      ],
    });

    await run(["sonar", "contacts", "list", "--org", ORG, "--page-all"], t.io);

    expect(t.calls.map((call) => new URL(call.url).searchParams.get("cursor"))).toEqual([
      null,
      "7",
    ]);
  });

  it("refuses an operation that declares no paging", async () => {
    const t = fakeIo();

    const code = await run(["sonar", "rules", "list", "--org", ORG, "--page-all"], t.io);

    expect(code).toBe(2);
    expect(t.calls).toHaveLength(0);
  });
});

describe("help and schema", () => {
  it("writes help to stderr and nothing to stdout", async () => {
    const t = fakeIo();

    const code = await run(["sonar", "--help"], t.io);

    expect(code).toBe(0);
    expect(t.stdout()).toBe("");
    expect(t.stderr()).toContain("sonar contacts merge");
    expect(t.stderr()).toContain("Sonar: Merge Contacts");
  });

  it("describes a command's flags from the spec", async () => {
    const t = fakeIo();

    await run(["sonar", "contacts", "list", "--help"], t.io);

    expect(t.stderr()).toContain("GET /organization/{organizationId}/sonar/contacts");
    expect(t.stderr()).toContain("--cursor <string>  (query) Opaque cursor");
    expect(t.stderr()).toContain("--organizationId <string>  (path, required, or --org)");
  });

  it("prints a command's input and output schema with references inlined", async () => {
    const t = fakeIo();

    const code = await run(["schema", "sonar.contacts.list"], t.io);

    expect(code).toBe(0);
    const schema = t.json() as {
      method: string;
      response: { properties: Record<string, unknown> };
    };
    expect(schema.method).toBe("GET");
    expect(Object.keys(schema.response.properties).sort()).toEqual([
      "contacts",
      "nextCursor",
      "total",
    ]);
    expect(JSON.stringify(schema.response)).not.toContain("$ref");
  });
});

describe("spec cache", () => {
  function cachedIo(
    cacheDir: string,
    now: number,
    replies: Reply[],
    env: Record<string, string> = {},
  ) {
    return fakeIo({ env: { TRT_SPEC: "", TRT_CACHE_DIR: cacheDir, ...env }, now, replies });
  }
  const specReply: Reply = (call) => {
    expect(call.url).toBe(`${API}/openapi.json`);
    expect(call.headers.Authorization).toBe("Bearer sk_live_test");
    return { body: fixtureSpec };
  };
  const listReply: Reply = { body: { products: [] } };
  const products = ["turtle", "products", "list"];

  it("fetches the spec once and serves it from the cache for a day", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "trt-cache-"));
    const start = Date.UTC(2026, 10, 16);

    const first = cachedIo(cacheDir, start, [specReply, listReply]);
    await run(products, first.io);
    const second = cachedIo(cacheDir, start + SPEC_TTL_MS - 1, [listReply]);
    await run(products, second.io);
    const third = cachedIo(cacheDir, start + SPEC_TTL_MS, [specReply, listReply]);
    await run(products, third.io);

    expect(first.calls).toHaveLength(2);
    expect(second.calls).toHaveLength(1);
    expect(third.calls).toHaveLength(2);
  });

  it("fetches again on --refresh", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "trt-cache-"));
    const now = Date.UTC(2026, 10, 16);
    await run(products, cachedIo(cacheDir, now, [specReply, listReply]).io);

    const refreshed = cachedIo(cacheDir, now, [specReply, listReply]);
    await run([...products, "--refresh"], refreshed.io);

    expect(refreshed.calls).toHaveLength(2);
  });

  it("keeps one cache per base URL", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "trt-cache-"));
    const now = Date.UTC(2026, 10, 16);
    await run(products, cachedIo(cacheDir, now, [specReply, listReply]).io);

    const other = cachedIo(cacheDir, now, [{ body: fixtureSpec }, listReply], {
      TURTLE_API_URL: "https://other.test",
    });
    await run(products, other.io);

    expect(other.calls[0]?.url).toBe("https://other.test/openapi.json");
  });

  it("falls back to a stale cache when the fetch fails", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "trt-cache-"));
    const start = Date.UTC(2026, 10, 16);
    await run(products, cachedIo(cacheDir, start, [specReply, listReply]).io);

    const stale = cachedIo(cacheDir, start + 2 * SPEC_TTL_MS, [
      { status: 503, body: "down" },
      listReply,
    ]);
    const code = await run(products, stale.io);

    expect(code).toBe(0);
    expect(stale.stderr()).toContain("using the cached spec");
  });

  it("ignores a cache whose time is not a finite number", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "trt-cache-"));
    const io = cachedIo(cacheDir, Date.UTC(2026, 10, 16), [specReply, listReply]);
    writeFileSync(
      specCacheFile(io.io, API),
      `{"fetchedAt": 1e400, "baseUrl": "${API}", "spec": {"paths": {}}}`,
    );

    const code = await run(products, io.io);

    expect(code).toBe(0);
    expect(io.calls).toHaveLength(2);
  });

  it("answers a TRT_SPEC that cannot be read as {status: 0, error} with exit 3", async () => {
    const t = fakeIo({ env: { TRT_SPEC: "/nonexistent/spec.json" } });

    const code = await run(products, t.io);

    expect(code).toBe(3);
    expect(String(t.json().error)).toMatch(/^read the spec from \/nonexistent\/spec.json: /);
  });

  it("refuses to fetch the spec without a key", async () => {
    const t = fakeIo({
      env: {
        TRT_SPEC: "",
        TRT_CACHE_DIR: mkdtempSync(join(tmpdir(), "trt-cache-")),
        TURTLE_API_KEY: "",
      },
    });

    const code = await run(products, t.io);

    expect(code).toBe(2);
    expect(t.json().error).toBe("TURTLE_API_KEY is not set: it is needed to fetch the API's spec");
  });
});
