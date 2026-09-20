import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnvFile, parseEnvFile } from "../src/core/env-file.js";
import { EnvyraError, createEnv } from "../src/index.js";

describe("parseEnvFile", () => {
  it("parses simple KEY=VALUE lines", () => {
    expect(parseEnvFile("A=1\nB=two")).toEqual({ A: "1", B: "two" });
  });

  it("handles CRLF line endings", () => {
    expect(parseEnvFile("A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" });
  });

  it("skips blank lines and comments", () => {
    expect(parseEnvFile("# hello\n\nA=1\n   # indented comment")).toEqual({ A: "1" });
  });

  it("supports the optional export prefix", () => {
    expect(parseEnvFile("export A=1")).toEqual({ A: "1" });
  });

  it("trims surrounding whitespace of keys and values", () => {
    expect(parseEnvFile("  A  =  padded  ")).toEqual({ A: "padded" });
  });

  it("treats empty values as empty strings", () => {
    expect(parseEnvFile("A=")).toEqual({ A: "" });
  });

  it("preserves = characters inside values", () => {
    expect(parseEnvFile("URL=postgres://u:p@h/db?x=1")).toEqual({
      URL: "postgres://u:p@h/db?x=1",
    });
  });

  it("strips double quotes and expands escapes", () => {
    expect(parseEnvFile('A="line1\\nline2"\nB="tab\\there"')).toEqual({
      A: "line1\nline2",
      B: "tab\there",
    });
  });

  it("treats single-quoted values as literal", () => {
    expect(parseEnvFile("A='no\\nescape'")).toEqual({ A: "no\\nescape" });
  });

  it("skips malformed lines without a key or equals sign", () => {
    expect(parseEnvFile("no-equals\n=novalue\nA=1")).toEqual({ A: "1" });
  });

  it("lets later duplicate keys win", () => {
    expect(parseEnvFile("A=1\nA=2")).toEqual({ A: "2" });
  });
});

describe("loadEnvFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "envyra-envfile-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reads .env from the given directory", () => {
    fs.writeFileSync(path.join(dir, ".env"), "PORT=8080\n");
    expect(loadEnvFile(dir)).toEqual({ PORT: "8080" });
  });

  it("throws EnvyraError when .env does not exist", () => {
    expect(() => loadEnvFile(dir)).toThrowError(EnvyraError);
    expect(() => loadEnvFile(dir)).toThrowError(/no \.env file exists/);
  });
});

describe('createEnv with source: "file"', () => {
  let dir: string;
  let originalCwd: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "envyra-envfile-"));
    originalCwd = process.cwd();
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    // biome-ignore lint/performance/noDelete: must actually unset the env var between tests
    delete process.env.ENVYRA_TEST_FROM_ENV;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("validates values read from the .env file", () => {
    fs.writeFileSync(path.join(dir, ".env"), "PORT=1234\nNAME=envyra\n");

    const env = createEnv(
      {
        PORT: { type: "number" },
        NAME: {},
      },
      { source: "file" },
    );

    expect(env.PORT).toBe(1234);
    expect(env.NAME).toBe("envyra");
  });

  it("lets real environment variables win over file values", () => {
    fs.writeFileSync(path.join(dir, ".env"), "ENVYRA_TEST_FROM_ENV=file\n");
    process.env.ENVYRA_TEST_FROM_ENV = "real-env";

    const env = createEnv({ ENVYRA_TEST_FROM_ENV: {} }, { source: "file" });

    expect(env.ENVYRA_TEST_FROM_ENV).toBe("real-env");
  });

  it("never mutates process.env", () => {
    fs.writeFileSync(path.join(dir, ".env"), "ENVYRA_TEST_FROM_ENV=file\n");

    createEnv({ ENVYRA_TEST_FROM_ENV: {} }, { source: "file" });

    expect(process.env.ENVYRA_TEST_FROM_ENV).toBeUndefined();
  });

  it("throws when no .env file exists", () => {
    expect(() => createEnv({ NAME: {} }, { source: "file" })).toThrowError(EnvyraError);
  });
});
