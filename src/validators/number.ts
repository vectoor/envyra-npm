import { type ParseResult, fail, ok } from "./types.js";

/**
 * Decimal numbers with an optional exponent: `3000`, `-4`, `3.5`, `.5`, `1e3`.
 * Hex (`0x10`), `Infinity`, `NaN`, and malformed strings like `123abc`
 * are rejected so parsing stays predictable.
 */
const NUMBER_PATTERN = /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/;

export function parseNumber(raw: string): ParseResult<number> {
  if (!NUMBER_PATTERN.test(raw)) {
    return fail("invalid_number", "a number");
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fail("invalid_number", "a finite number");
  }
  return ok(value);
}
