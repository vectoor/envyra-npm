import { type ParseResult, fail, ok } from "./types.js";

/**
 * Validates with the platform `URL` implementation. Any absolute URL with a
 * scheme is accepted (`https://`, `postgres://`, `redis://`, ...). The result
 * stays a string.
 */
export function parseUrl(raw: string): ParseResult<string> {
  try {
    new URL(raw);
    return ok(raw);
  } catch {
    return fail("invalid_url", "a valid URL (for example https://example.com)");
  }
}
