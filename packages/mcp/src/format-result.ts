import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const MAX_RESPONSE_BYTES = 800_000;

type SdkResult = {
  data?: unknown;
  error?: unknown;
};

const isSdkResult = (value: unknown): value is SdkResult =>
  typeof value === "object" && value !== null && ("data" in value || "error" in value);

const selectPayload = (result: unknown): unknown => {
  if (!isSdkResult(result)) return result;
  if (result.data !== undefined) return result.data;
  if (result.error !== undefined) return result.error;
  return result;
};

export function formatJsonResult(result: unknown): CallToolResult {
  const payload = selectPayload(result);
  const json = JSON.stringify(payload, null, 2);

  if (json.length <= MAX_RESPONSE_BYTES) {
    return { content: [{ type: "text", text: json }] };
  }

  const truncated = json.slice(0, MAX_RESPONSE_BYTES);
  const lastNewline = truncated.lastIndexOf("\n");
  const safeEnd = lastNewline > 0 ? lastNewline : truncated.length;

  return {
    content: [
      {
        type: "text",
        text: `${truncated.slice(
          0,
          safeEnd,
        )}\n\n... [TRUNCATED: response exceeded 800KB. Use narrower inputs or pagination.]`,
      },
    ],
  };
}
