import { type ParseResult, ok } from "./types.js";

export function parseString(raw: string): ParseResult<string> {
  return ok(raw);
}
