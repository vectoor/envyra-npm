import type { EnvSchema, EnvSpecType } from "../types/schema.js";
import { parseValue } from "../validators/index.js";
import { loadEnvFile } from "./env-file.js";
import { type EnvIssue, EnvValidationError } from "./errors.js";

/**
 * Where values are read from.
 *
 * - omitted: `process.env`
 * - `"file"`: the `.env` file in the current working directory, with real
 *   environment variables taking precedence (dotenv convention). No path
 *   option on purpose — `.env` in cwd is the whole convention.
 * - an object: used as-is, which keeps validation trivially testable.
 */
export type EnvSource = "file" | Record<string, string | undefined>;

export interface ValidateEnvOptions {
  /**
   * Where values are read from. See {@link EnvSource}.
   *
   * @default process.env
   */
  source?: EnvSource;
  /**
   * Trim surrounding whitespace from raw values before parsing.
   *
   * @default true
   */
  trim?: boolean;
  /**
   * Treat empty strings (after trimming, if enabled) as missing.
   *
   * @default true
   */
  emptyStringAsMissing?: boolean;
}

function resolveSource(source: EnvSource | undefined): Record<string, string | undefined> {
  if (source === "file") {
    // Real environment variables win over file values, so deployments that
    // inject env vars directly keep working when a .env file is present.
    return { ...loadEnvFile(process.cwd()), ...process.env };
  }
  return source ?? process.env;
}

/**
 * Cap on how much of an invalid value is echoed back in error messages.
 * Secret values are never echoed at all.
 */
const MAX_RECEIVED_LENGTH = 100;

function receivedSuffix(raw: string, secret: boolean): string {
  if (secret) {
    return "";
  }
  const truncated =
    raw.length > MAX_RECEIVED_LENGTH ? `${raw.slice(0, MAX_RECEIVED_LENGTH)}…` : raw;
  // JSON.stringify quotes the value and escapes control characters.
  return ` Received ${JSON.stringify(truncated)}.`;
}

/**
 * Validate every variable in the schema against the source.
 *
 * All problems are collected and reported together in a single
 * {@link EnvValidationError}; validation never stops at the first failure.
 *
 * @returns the parsed, typed values keyed by variable name.
 * @throws {EnvValidationError} when one or more variables are invalid.
 */
export function validateEnv(
  schema: EnvSchema,
  options: ValidateEnvOptions = {},
): Record<string, unknown> {
  const source = resolveSource(options.source);
  const trim = options.trim ?? true;
  const emptyStringAsMissing = options.emptyStringAsMissing ?? true;

  const values: Record<string, unknown> = {};
  const issues: EnvIssue[] = [];

  for (const [key, spec] of Object.entries(schema)) {
    const type: EnvSpecType = spec.type ?? "string";
    const secret = spec.secret === true;

    let raw = source[key];
    if (typeof raw === "string" && trim) {
      raw = raw.trim();
    }

    const isMissing = raw === undefined || (emptyStringAsMissing && raw === "");

    if (isMissing) {
      if (spec.default !== undefined) {
        values[key] = spec.default;
        continue;
      }
      if (spec.required === false) {
        values[key] = undefined;
        continue;
      }
      issues.push({
        key,
        code: "missing",
        message: "Required environment variable is missing.",
      });
      continue;
    }

    const result = parseValue(type, raw as string, spec);
    if (result.ok) {
      values[key] = result.value;
      continue;
    }

    issues.push({
      key,
      code: result.code,
      message: `Expected ${result.expected}.${receivedSuffix(raw as string, secret)}`,
    });
  }

  if (issues.length > 0) {
    throw new EnvValidationError(issues);
  }

  return values;
}
