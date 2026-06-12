import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

type RequestPart = "body" | "path" | "query";

type OperationSchema = {
  ref: string;
  optional: boolean;
};

type Operation = {
  sdkExportName: string;
  toolName: string;
  title: string;
  description: string;
  schemas: Partial<Record<RequestPart, OperationSchema>>;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const repoRoot = resolve(packageRoot, "../..");
const sdkRoot = resolve(repoRoot, "packages/sdk");
const sdkGenPath = resolve(sdkRoot, "src/client/sdk.gen.ts");
const sdkIndexPath = resolve(sdkRoot, "src/index.ts");
const zodGenPath = resolve(sdkRoot, "src/client/zod.gen.ts");
const generatedDir = resolve(packageRoot, "src/generated");

const requestParts = ["body", "path", "query"] as const;

function runSdkCodegen(): void {
  const result = spawnSync("bun", ["run", "codegen"], {
    cwd: sdkRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("SDK codegen failed; cannot update MCP tools.");
  }
}

function readSourceFile(path: string): ts.SourceFile {
  const source = readFileSync(path, "utf8");
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ===
      true
  );
}

function collectExportedConsts(sourceFile: ts.SourceFile): Map<string, ts.VariableDeclaration> {
  const exports = new Map<string, ts.VariableDeclaration>();

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        exports.set(declaration.name.text, declaration);
      }
    }
  }

  return exports;
}

function assertSdkPublicEntryPoint(): void {
  const indexSource = readFileSync(sdkIndexPath, "utf8");
  if (!indexSource.includes('export * from "./client/sdk.gen";')) {
    throw new Error(
      "SDK entrypoint must publicly re-export ./client/sdk.gen before MCP tools can be generated.",
    );
  }

  if (!indexSource.includes('export * as schemas from "./client/zod.gen";')) {
    throw new Error(
      "SDK entrypoint must publicly re-export ./client/zod.gen as schemas before MCP tools can be generated.",
    );
  }
}

function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

function toTitle(value: string): string {
  return toSnakeCase(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractJsDoc(node: ts.Node): string {
  const sourceFile = node.getSourceFile();
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) ?? [];
  const jsDoc = ranges
    .map((range) => sourceFile.text.slice(range.pos, range.end))
    .find((comment) => comment.startsWith("/**"));

  if (!jsDoc) return "";

  return jsDoc
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .join("\n");
}

function extractSchemaExpression(
  operationSource: string,
  part: RequestPart,
): OperationSchema | null {
  const match = operationSource.match(new RegExp(`${part}:\\s*([^,\\n}]+)`));
  if (!match?.[1]) {
    throw new Error(`Could not find ${part} schema expression in operation source.`);
  }

  const expression = match[1].trim();
  if (expression.startsWith("z.never()")) return null;

  const refMatch = expression.match(/^(z[A-Za-z0-9_]+)/);
  if (!refMatch?.[1]) {
    throw new Error(`Unsupported ${part} schema expression: ${expression}`);
  }

  return {
    ref: refMatch[1],
    optional: expression.includes(".optional()"),
  };
}

function extractSchemas(
  declaration: ts.VariableDeclaration,
): Partial<Record<RequestPart, OperationSchema>> {
  if (!declaration.initializer) {
    throw new Error(`Operation ${declaration.name.getText()} has no initializer.`);
  }

  const operationSource = declaration.initializer.getText(declaration.getSourceFile());
  const schemas: Partial<Record<RequestPart, OperationSchema>> = {};

  for (const part of requestParts) {
    const schema = extractSchemaExpression(operationSource, part);
    if (schema) schemas[part] = schema;
  }

  return schemas;
}

function collectOperations(): Operation[] {
  assertSdkPublicEntryPoint();

  const sdkSourceFile = readSourceFile(sdkGenPath);
  const zodSourceFile = readSourceFile(zodGenPath);
  const sdkExports = collectExportedConsts(sdkSourceFile);
  const zodExports = collectExportedConsts(zodSourceFile);

  return [...sdkExports.entries()].map(([sdkExportName, declaration]) => {
    const schemas = extractSchemas(declaration);
    const missingSchemas = Object.values(schemas)
      .map((schema) => schema.ref)
      .filter((ref) => !zodExports.has(ref));

    if (missingSchemas.length > 0) {
      throw new Error(
        `${sdkExportName} references schemas not exported by SDK zod.gen.ts: ${missingSchemas.join(
          ", ",
        )}`,
      );
    }

    const description = extractJsDoc(declaration.parent.parent);

    return {
      sdkExportName,
      toolName: toSnakeCase(sdkExportName),
      title: toTitle(sdkExportName),
      description: description || toTitle(sdkExportName),
      schemas,
    };
  });
}

function renderSchemaShape(operation: Operation): string {
  const fields = requestParts.flatMap((part) => {
    const schema = operation.schemas[part];
    if (!schema) return [];

    const expression = `sdk.schemas.${schema.ref}${schema.optional ? ".optional()" : ""}`;
    return [`  ${part}: ${expression},`];
  });

  return fields.length === 0 ? "" : `\n${fields.join("\n")}\n`;
}

function renderToolsFile(operations: Operation[]): string {
  const schemaDeclarations = operations
    .map(
      (operation) =>
        `const ${operation.sdkExportName}InputSchema = z.object({${renderSchemaShape(
          operation,
        )}});`,
    )
    .join("\n\n");

  const registrations = operations
    .map(
      (operation) => `  server.registerTool(
    ${JSON.stringify(operation.toolName)},
    {
      title: ${JSON.stringify(operation.title)},
      description: ${JSON.stringify(operation.description)},
      inputSchema: ${operation.sdkExportName}InputSchema,
    },
    async (input) =>
      formatJsonResult(
        await sdk.${operation.sdkExportName}(
          input as Parameters<typeof sdk.${operation.sdkExportName}>[0],
        ),
      ),
  );`,
    )
    .join("\n\n");

  return `// This file is auto-generated by packages/mcp/scripts/update-tools.ts

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as sdk from "@turtlexyz/sdk";
import { z } from "zod";
import { formatJsonResult } from "../format-result.js";

${schemaDeclarations}

export function registerGeneratedTools(server: McpServer): void {
${registrations}
}
`;
}

function renderManifestFile(operations: Operation[]): string {
  const manifest = operations.map((operation) => ({
    sdkExportName: operation.sdkExportName,
    toolName: operation.toolName,
    title: operation.title,
    schemas: Object.fromEntries(
      requestParts.flatMap((part) => {
        const schema = operation.schemas[part];
        return schema ? [[part, schema.ref]] : [];
      }),
    ),
  }));

  return `// This file is auto-generated by packages/mcp/scripts/update-tools.ts

export const toolsManifest = ${JSON.stringify(manifest, null, 2)} as const;
`;
}

function writeGeneratedFiles(operations: Operation[]): void {
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(resolve(generatedDir, "tools.ts"), renderToolsFile(operations));
  writeFileSync(resolve(generatedDir, "manifest.ts"), renderManifestFile(operations));
}

runSdkCodegen();
const operations = collectOperations();
writeGeneratedFiles(operations);

const relativeGeneratedDir = relative(repoRoot, generatedDir);
console.log(`Generated ${operations.length} MCP tools in ${relativeGeneratedDir}`);
