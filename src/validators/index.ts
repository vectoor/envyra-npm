import type { EnumSpec, EnvSpec, EnvSpecType } from "../types/schema.js";
import { parseBoolean } from "./boolean.js";
import { parseEnum } from "./enum.js";
import { parseJson } from "./json.js";
import { parseNumber } from "./number.js";
import { parseString } from "./string.js";
import type { ParseResult } from "./types.js";
import { parseUrl } from "./url.js";

/** Dispatch a raw string to the parser for its declared type. */
export function parseValue(type: EnvSpecType, raw: string, spec: EnvSpec): ParseResult<unknown> {
  switch (type) {
    case "string":
      return parseString(raw);
    case "number":
      return parseNumber(raw);
    case "boolean":
      return parseBoolean(raw);
    case "url":
      return parseUrl(raw);
    case "enum":
      return parseEnum(raw, (spec as EnumSpec).values);
    case "json":
      return parseJson(raw);
  }
}
