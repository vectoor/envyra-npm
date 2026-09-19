import { describe, expect, it } from "vitest";
import { parseBoolean } from "../src/validators/boolean.js";
import { parseEnum } from "../src/validators/enum.js";
import { parseJson } from "../src/validators/json.js";
import { parseNumber } from "../src/validators/number.js";
import { parseString } from "../src/validators/string.js";
import { parseUrl } from "../src/validators/url.js";

describe("parseString", () => {
  it("returns the value unchanged", () => {
    expect(parseString("anything goes")).toEqual({ ok: true, value: "anything goes" });
  });
});

describe("parseNumber", () => {
  it.each([
    ["3000", 3000],
    ["-4", -4],
    ["3.5", 3.5],
    [".5", 0.5],
    ["1e3", 1000],
    ["+7", 7],
    ["0", 0],
  ])("parses %s as %i", (raw, expected) => {
    expect(parseNumber(raw)).toEqual({ ok: true, value: expected });
  });

  it.each(["123abc", "abc", "", "0x10", "Infinity", "-Infinity", "NaN", "1,000", "1 000", "--1"])(
    "rejects %s",
    (raw) => {
      const result = parseNumber(raw);
      expect(result.ok).toBe(false);
    },
  );

  it("rejects numbers that overflow to Infinity", () => {
    const result = parseNumber("1e999");
    expect(result.ok).toBe(false);
  });
});

describe("parseBoolean", () => {
  it.each([
    ["true", true],
    ["TRUE", true],
    ["1", true],
    ["false", false],
    ["False", false],
    ["0", false],
  ])("parses %s as %s", (raw, expected) => {
    expect(parseBoolean(raw)).toEqual({ ok: true, value: expected });
  });

  it.each(["yes", "no", "on", "off", "", "2", "trueee"])("rejects %s", (raw) => {
    expect(parseBoolean(raw).ok).toBe(false);
  });
});

describe("parseUrl", () => {
  it.each([
    "https://example.com",
    "http://localhost:3000/path?q=1",
    "postgres://user:pass@host:5432/db",
    "redis://default@cache:6379",
  ])("accepts %s", (raw) => {
    expect(parseUrl(raw)).toEqual({ ok: true, value: raw });
  });

  it.each(["not a url", "example.com", "://missing-scheme", ""])("rejects %s", (raw) => {
    expect(parseUrl(raw).ok).toBe(false);
  });
});

describe("parseEnum", () => {
  const values = ["development", "test", "production"];

  it("accepts a declared value", () => {
    expect(parseEnum("test", values)).toEqual({ ok: true, value: "test" });
  });

  it("rejects an undeclared value", () => {
    const result = parseEnum("staging", values);
    expect(result.ok).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(parseEnum("Production", values).ok).toBe(false);
  });
});

describe("parseJson", () => {
  it("parses objects, arrays, and primitives", () => {
    expect(parseJson('{"foo":true}')).toEqual({ ok: true, value: { foo: true } });
    expect(parseJson("[1,2,3]")).toEqual({ ok: true, value: [1, 2, 3] });
    expect(parseJson('"text"')).toEqual({ ok: true, value: "text" });
  });

  it("rejects malformed JSON", () => {
    expect(parseJson("{oops").ok).toBe(false);
    expect(parseJson("undefined").ok).toBe(false);
  });
});
