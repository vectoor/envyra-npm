import type { EnvIssueCode } from "../core/errors.js";

export type ParseSuccess<T> = { ok: true; value: T };

export type ParseFailure = {
  ok: false;
  code: EnvIssueCode;
  /** Short description of what was expected, for example `a number`. */
  expected: string;
};

export type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export function ok<T>(value: T): ParseSuccess<T> {
  return { ok: true, value };
}

export function fail(code: EnvIssueCode, expected: string): ParseFailure {
  return { ok: false, code, expected };
}
