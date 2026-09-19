import { type ParseResult, fail, ok } from "./types.js";

/**
 * Explicit boolean parsing — never JavaScript truthiness.
 *
 * Accepted (case-insensitive): `true`, `false`, `1`, `0`.
 * Everything else is a validation error.
 */
export function parseBoolean(raw: string): ParseResult<boolean> {
  switch (raw.toLowerCase()) {
    case "true":
    case "1":
      return ok(true);
    case "false":
    case "0":
      return ok(false);
    default:
      return fail("invalid_boolean", '"true", "false", "1", or "0"');
  }
}
