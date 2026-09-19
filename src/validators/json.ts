import { type ParseResult, fail, ok } from "./types.js";

/** Parsed with `JSON.parse`. The result type is `unknown` — narrow it yourself. */
export function parseJson(raw: string): ParseResult<unknown> {
  try {
    return ok(JSON.parse(raw));
  } catch {
    return fail("invalid_json", "valid JSON");
  }
}
