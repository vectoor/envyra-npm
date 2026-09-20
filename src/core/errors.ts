/**
 * Structured errors thrown by envyra.
 */

/** Machine-readable codes for validation issues. */
export type EnvIssueCode =
  | "missing"
  | "invalid_number"
  | "invalid_boolean"
  | "invalid_url"
  | "invalid_enum"
  | "invalid_json";

/**
 * A single validation problem. `message` is human-readable and safe to print:
 * it never contains the value of a variable marked `secret: true`.
 */
export interface EnvIssue {
  /** The environment variable name, for example `"DATABASE_URL"`. */
  key: string;
  /** Machine-readable problem code. */
  code: EnvIssueCode;
  /** Human-readable explanation, safe to print to logs. */
  message: string;
}

/** Base class for every error thrown by envyra. */
export class EnvyraError extends Error {
  // `{ cause }` instead of the global `ErrorOptions` so the emitted types do
  // not require consumers to have ES2022 libs configured.
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EnvyraError";
  }
}

/**
 * Thrown when one or more environment variables fail validation.
 * Carries the structured `issues` list as well as a formatted,
 * human-readable `message`.
 */
export class EnvValidationError extends EnvyraError {
  readonly issues: readonly EnvIssue[];

  constructor(issues: readonly EnvIssue[]) {
    super(formatValidationMessage(issues));
    this.name = "EnvValidationError";
    this.issues = Object.freeze([...issues]);
  }
}

/**
 * Thrown when the schema itself is invalid (for example an enum `default`
 * that is not one of the declared `values`). This is a programmer error,
 * not an environment problem.
 */
export class EnvSchemaError extends EnvyraError {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid env schema\n\n${problems.map((p) => `✖ ${p}`).join("\n")}`);
    this.name = "EnvSchemaError";
    this.problems = Object.freeze([...problems]);
  }
}

/** Render the issues list as the familiar multi-error report. */
export function formatValidationMessage(issues: readonly EnvIssue[]): string {
  const lines: string[] = ["Environment validation failed", ""];
  for (const issue of issues) {
    lines.push(`✖ ${issue.key}`);
    for (const line of issue.message.split("\n")) {
      lines.push(`  ${line}`);
    }
    lines.push("");
  }
  const count = issues.length;
  lines.push(`${count} environment ${count === 1 ? "error" : "errors"} found.`);
  return lines.join("\n");
}
