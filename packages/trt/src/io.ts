/** What trt touches outside itself, injected so tests can stand in for it. */
export interface Io {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  /** Program output: JSON only. */
  stdout: (text: string) => void;
  /** Help, warnings and progress. */
  stderr: (text: string) => void;
  now: () => number;
  platform: NodeJS.Platform;
  /** Whether stdout is a terminal: JSON is indented for a person, compact for a pipe. */
  isTTY: boolean;
}

// Exit codes. 0 is success, a dry run, or a write printed and not sent.

/** The API answered with an error status. */
export const EXIT_API_ERROR = 1;
/** The command line is wrong: unknown command or flag, missing value, bad JSON. */
export const EXIT_USAGE = 2;
/** The API could not be reached, or its spec could not be read. */
export const EXIT_UNREACHABLE = 3;

/** An error trt reports as `{status, error}` and exits on. */
export class TrtError extends Error {
  constructor(
    message: string,
    readonly exitCode: number,
    /** The HTTP status, or 0 when no response was involved. */
    readonly status = 0,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
