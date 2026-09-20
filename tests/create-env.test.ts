import { afterEach, describe, expect, it, vi } from "vitest";
import { EnvSchemaError, EnvValidationError, createEnv } from "../src/index.js";

describe("createEnv — strings", () => {
  it("reads a required string that exists", () => {
    const env = createEnv({ DATABASE_URL: {} }, { source: { DATABASE_URL: "postgres://x" } });
    expect(env.DATABASE_URL).toBe("postgres://x");
  });

  it("fails when a required string is missing", () => {
    expect(() => createEnv({ JWT_SECRET: {} }, { source: {} })).toThrowError(EnvValidationError);
  });

  it("treats an empty string as missing for a required variable", () => {
    const error = catchValidation(() =>
      createEnv({ JWT_SECRET: {} }, { source: { JWT_SECRET: "" } }),
    );
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]).toMatchObject({ key: "JWT_SECRET", code: "missing" });
  });

  it("treats a whitespace-only string as missing when trimming (default)", () => {
    const error = catchValidation(() =>
      createEnv({ JWT_SECRET: {} }, { source: { JWT_SECRET: "   " } }),
    );
    expect(error.issues[0]?.code).toBe("missing");
  });

  it("keeps whitespace-only values when trim is disabled", () => {
    const env = createEnv(
      { NAME: {} },
      { source: { NAME: "   " }, trim: false, emptyStringAsMissing: true },
    );
    expect(env.NAME).toBe("   ");
  });

  it("accepts empty strings when emptyStringAsMissing is disabled", () => {
    const env = createEnv({ NAME: {} }, { source: { NAME: "" }, emptyStringAsMissing: false });
    expect(env.NAME).toBe("");
  });

  it("returns undefined for a missing optional variable", () => {
    const env = createEnv({ REDIS_URL: { required: false } }, { source: {} });
    expect(env.REDIS_URL).toBeUndefined();
  });

  it("never returns null for missing optional variables", () => {
    const env = createEnv({ REDIS_URL: { required: false } }, { source: {} });
    expect(env.REDIS_URL).not.toBeNull();
  });

  it("applies a string default when the variable is missing", () => {
    const env = createEnv({ LOG_LEVEL: { default: "info" } }, { source: {} });
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("prefers the environment value over the default", () => {
    const env = createEnv({ LOG_LEVEL: { default: "info" } }, { source: { LOG_LEVEL: "debug" } });
    expect(env.LOG_LEVEL).toBe("debug");
  });
});

describe("createEnv — numbers", () => {
  it("parses a valid number", () => {
    const env = createEnv({ PORT: { type: "number" } }, { source: { PORT: "3000" } });
    expect(env.PORT).toBe(3000);
  });

  it("parses floats and exponents", () => {
    const env = createEnv(
      { RATIO: { type: "number" }, BIG: { type: "number" } },
      { source: { RATIO: "3.5", BIG: "1e3" } },
    );
    expect(env.RATIO).toBe(3.5);
    expect(env.BIG).toBe(1000);
  });

  it("rejects an invalid number", () => {
    const error = catchValidation(() =>
      createEnv({ PORT: { type: "number" } }, { source: { PORT: "hello" } }),
    );
    expect(error.issues[0]).toMatchObject({ key: "PORT", code: "invalid_number" });
    expect(error.message).toContain('Received "hello"');
  });

  it("rejects malformed numbers like 123abc", () => {
    const error = catchValidation(() =>
      createEnv({ PORT: { type: "number" } }, { source: { PORT: "123abc" } }),
    );
    expect(error.issues[0]?.code).toBe("invalid_number");
  });

  it("rejects hex, Infinity, and NaN", () => {
    for (const raw of ["0x10", "Infinity", "NaN"]) {
      const error = catchValidation(() =>
        createEnv({ PORT: { type: "number" } }, { source: { PORT: raw } }),
      );
      expect(error.issues[0]?.code).toBe("invalid_number");
    }
  });

  it("applies a number default", () => {
    const env = createEnv({ PORT: { type: "number", default: 3000 } }, { source: {} });
    expect(env.PORT).toBe(3000);
  });

  it("supports optional numbers", () => {
    const env = createEnv({ CACHE_TTL: { type: "number", required: false } }, { source: {} });
    expect(env.CACHE_TTL).toBeUndefined();
  });
});

describe("createEnv — booleans", () => {
  it("parses true and false", () => {
    const env = createEnv(
      { A: { type: "boolean" }, B: { type: "boolean" } },
      { source: { A: "true", B: "false" } },
    );
    expect(env.A).toBe(true);
    expect(env.B).toBe(false);
  });

  it("parses 1 and 0", () => {
    const env = createEnv(
      { A: { type: "boolean" }, B: { type: "boolean" } },
      { source: { A: "1", B: "0" } },
    );
    expect(env.A).toBe(true);
    expect(env.B).toBe(false);
  });

  it('does not treat "false" as truthy', () => {
    const env = createEnv({ DEBUG: { type: "boolean" } }, { source: { DEBUG: "false" } });
    expect(env.DEBUG).toBe(false);
  });

  it("rejects invalid booleans", () => {
    const error = catchValidation(() =>
      createEnv({ DEBUG: { type: "boolean" } }, { source: { DEBUG: "yes" } }),
    );
    expect(error.issues[0]?.code).toBe("invalid_boolean");
  });

  it("applies a boolean default", () => {
    const env = createEnv({ DEBUG: { type: "boolean", default: false } }, { source: {} });
    expect(env.DEBUG).toBe(false);
  });
});

describe("createEnv — urls", () => {
  it("accepts a valid URL and returns a string", () => {
    const env = createEnv(
      { DATABASE_URL: { type: "url" } },
      { source: { DATABASE_URL: "postgres://user:pass@localhost:5432/db" } },
    );
    expect(env.DATABASE_URL).toBe("postgres://user:pass@localhost:5432/db");
  });

  it("rejects an invalid URL", () => {
    const error = catchValidation(() =>
      createEnv({ API_URL: { type: "url" } }, { source: { API_URL: "not a url" } }),
    );
    expect(error.issues[0]?.code).toBe("invalid_url");
  });
});

describe("createEnv — enums", () => {
  const schema = {
    NODE_ENV: { type: "enum", values: ["development", "test", "production"] },
  } as const;

  it("accepts a declared value", () => {
    const env = createEnv(schema, { source: { NODE_ENV: "production" } });
    expect(env.NODE_ENV).toBe("production");
  });

  it("rejects an undeclared value", () => {
    const error = catchValidation(() => createEnv(schema, { source: { NODE_ENV: "staging" } }));
    expect(error.issues[0]?.code).toBe("invalid_enum");
    expect(error.message).toContain("development");
    expect(error.message).toContain("production");
  });

  it("applies an enum default", () => {
    const env = createEnv(
      { NODE_ENV: { type: "enum", values: ["development", "production"], default: "development" } },
      { source: {} },
    );
    expect(env.NODE_ENV).toBe("development");
  });

  it("rejects an enum default that is not a declared value at runtime", () => {
    expect(() =>
      createEnv(
        // Intentionally bypassing the compile-time check to test the runtime guard.
        { NODE_ENV: { type: "enum", values: ["a", "b"], default: "c" } } as never,
        { source: {} },
      ),
    ).toThrowError(EnvSchemaError);
  });
});

describe("createEnv — json", () => {
  it("parses valid JSON", () => {
    const env = createEnv(
      { FEATURE_CONFIG: { type: "json" } },
      { source: { FEATURE_CONFIG: '{"foo":true}' } },
    );
    expect(env.FEATURE_CONFIG).toEqual({ foo: true });
  });

  it("rejects invalid JSON", () => {
    const error = catchValidation(() =>
      createEnv({ FEATURE_CONFIG: { type: "json" } }, { source: { FEATURE_CONFIG: "{oops" } }),
    );
    expect(error.issues[0]?.code).toBe("invalid_json");
  });
});

describe("createEnv — validation flow", () => {
  it("reports all errors together, not just the first", () => {
    const error = catchValidation(() =>
      createEnv(
        {
          DATABASE_URL: {},
          PORT: { type: "number" },
          NODE_ENV: { type: "enum", values: ["development", "production"] },
        },
        { source: { PORT: "hello", NODE_ENV: "staging" } },
      ),
    );

    expect(error.issues).toHaveLength(3);
    expect(error.issues.map((i) => i.key)).toEqual(["DATABASE_URL", "PORT", "NODE_ENV"]);
    expect(error.message).toContain("DATABASE_URL");
    expect(error.message).toContain("PORT");
    expect(error.message).toContain("NODE_ENV");
    expect(error.message).toContain("3 environment errors found.");
  });

  it("uses singular wording for a single error", () => {
    const error = catchValidation(() => createEnv({ DATABASE_URL: {} }, { source: {} }));
    expect(error.message).toContain("1 environment error found.");
  });

  it("trims surrounding whitespace by default", () => {
    const env = createEnv({ PORT: { type: "number" } }, { source: { PORT: " 3000 " } });
    expect(env.PORT).toBe(3000);
  });

  it("fails to parse padded numbers when trim is disabled", () => {
    const error = catchValidation(() =>
      createEnv({ PORT: { type: "number" } }, { source: { PORT: " 3000 " }, trim: false }),
    );
    expect(error.issues[0]?.code).toBe("invalid_number");
  });

  it("reads process.env by default", () => {
    const key = "ENVYRA_TEST_PROCESS_ENV";
    process.env[key] = "from-process";
    try {
      const env = createEnv({ [key]: {} });
      expect(env[key]).toBe("from-process");
    } finally {
      delete process.env[key];
    }
  });

  it("does not mutate process.env", () => {
    const before = { ...process.env };
    createEnv(
      { PORT: { type: "number", default: 3000 }, DEBUG: { type: "boolean", default: false } },
      { source: {} },
    );
    expect(process.env).toEqual(before);
  });

  it("does not mutate the provided source", () => {
    const source = { PORT: " 3000 " };
    createEnv({ PORT: { type: "number" } }, { source });
    expect(source.PORT).toBe(" 3000 ");
  });

  it("returns a frozen object", () => {
    const env = createEnv({ NAME: {} }, { source: { NAME: "a" } });
    expect(Object.isFrozen(env)).toBe(true);
  });
});

describe("createEnv — secrets", () => {
  it("never includes secret values in error output", () => {
    const error = catchValidation(() =>
      createEnv(
        { DB_PASSWORD: { type: "number", secret: true } },
        { source: { DB_PASSWORD: "p4ssw0rd-hunter2" } },
      ),
    );
    expect(error.message).not.toContain("p4ssw0rd-hunter2");
    expect(error.issues[0]?.message).not.toContain("p4ssw0rd-hunter2");
  });

  it("includes non-secret values in error output to aid debugging", () => {
    const error = catchValidation(() =>
      createEnv({ PORT: { type: "number" } }, { source: { PORT: "hello" } }),
    );
    expect(error.issues[0]?.message).toContain('"hello"');
  });

  it("truncates very long non-secret values in error output", () => {
    const long = "x".repeat(500);
    const error = catchValidation(() =>
      createEnv({ PORT: { type: "number" } }, { source: { PORT: long } }),
    );
    expect(error.issues[0]?.message.length).toBeLessThan(300);
  });
});

describe("createEnv — exitOnError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws by default instead of exiting", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    expect(() => createEnv({ MISSING: {} }, { source: {} })).toThrowError(EnvValidationError);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("prints the report and exits with code 1 when exitOnError is true", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit(${code ?? 0})`);
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => createEnv({ MISSING: {} }, { source: {}, exitOnError: true })).toThrowError(
      "process.exit(1)",
    );
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("MISSING");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("createEnv — example", () => {
  it("never applies example as a runtime default", () => {
    const error = catchValidation(() =>
      createEnv({ R2_ENDPOINT: { type: "url", example: "https://example.com" } }, { source: {} }),
    );
    expect(error.issues[0]).toMatchObject({ key: "R2_ENDPOINT", code: "missing" });
  });

  it("still validates the real value when example is set", () => {
    const env = createEnv(
      { R2_ENDPOINT: { type: "url", example: "https://example.com" } },
      { source: { R2_ENDPOINT: "https://real.r2.dev" } },
    );
    expect(env.R2_ENDPOINT).toBe("https://real.r2.dev");
  });
});

function catchValidation(fn: () => unknown): EnvValidationError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(EnvValidationError);
    return error as EnvValidationError;
  }
  throw new Error("Expected EnvValidationError to be thrown.");
}
