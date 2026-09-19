import { type ParseResult, fail, ok } from "./types.js";

/** Only the declared values are valid. Matching is exact and case-sensitive. */
export function parseEnum(raw: string, values: readonly string[]): ParseResult<string> {
  if (values.includes(raw)) {
    return ok(raw);
  }
  return fail("invalid_enum", `one of: ${values.map((v) => JSON.stringify(v)).join(", ")}`);
}
