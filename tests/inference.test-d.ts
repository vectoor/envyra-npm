import { describe, expectTypeOf, it } from "vitest";
import { type InferEnv, createEnv, defineConfig } from "../src/index.js";

describe("type inference", () => {
  it("defaults to a required string", () => {
    const env = createEnv({ NAME: {} }, { source: {} });
    expectTypeOf(env.NAME).toEqualTypeOf<string>();
  });

  it("infers numbers", () => {
    const env = createEnv({ PORT: { type: "number" } }, { source: {} });
    expectTypeOf(env.PORT).toEqualTypeOf<number>();
  });

  it("adds undefined for optional variables", () => {
    const env = createEnv(
      {
        REDIS_URL: { required: false },
        CACHE_TTL: { type: "number", required: false },
      },
      { source: {} },
    );
    expectTypeOf(env.REDIS_URL).toEqualTypeOf<string | undefined>();
    expectTypeOf(env.CACHE_TTL).toEqualTypeOf<number | undefined>();
  });

  it("defaults remove undefined", () => {
    const env = createEnv(
      {
        PORT: { type: "number", default: 3000 },
        DEBUG: { type: "boolean", default: false },
      },
      { source: {} },
    );
    expectTypeOf(env.PORT).toEqualTypeOf<number>();
    expectTypeOf(env.DEBUG).toEqualTypeOf<boolean>();
  });

  it("infers enum values as literal unions without as const", () => {
    const env = createEnv(
      { NODE_ENV: { type: "enum", values: ["development", "production"] } },
      { source: {} },
    );
    expectTypeOf(env.NODE_ENV).toEqualTypeOf<"development" | "production">();
  });

  it("infers enum defaults as the literal union, not string", () => {
    const env = createEnv(
      {
        NODE_ENV: {
          type: "enum",
          values: ["development", "test", "production"] as const,
          default: "development",
        },
      },
      { source: {} },
    );
    expectTypeOf(env.NODE_ENV).toEqualTypeOf<"development" | "test" | "production">();
  });

  it("infers url as string and json as unknown", () => {
    const env = createEnv(
      {
        API_URL: { type: "url" },
        FEATURE_CONFIG: { type: "json" },
      },
      { source: {} },
    );
    expectTypeOf(env.API_URL).toEqualTypeOf<string>();
    expectTypeOf(env.FEATURE_CONFIG).toEqualTypeOf<unknown>();
  });

  it("exposes InferEnv for advanced use", () => {
    const schema = defineConfig({
      PORT: { type: "number", default: 3000 },
      REDIS_URL: { required: false },
    });
    expectTypeOf<InferEnv<typeof schema>>().toEqualTypeOf<{
      readonly PORT: number;
      readonly REDIS_URL: string | undefined;
    }>();
  });
});

describe("schema type safety", () => {
  it("rejects unknown keys on the result", () => {
    const env = createEnv({ DATABASE_URL: {} }, { source: {} });
    // @ts-expect-error the key does not exist in the schema
    void env.DATABSE_URL;
  });

  it("rejects a string default for a number", () => {
    createEnv(
      // @ts-expect-error number defaults must be numbers
      { PORT: { type: "number", default: "hello" } },
      { source: {} },
    );
  });

  it("rejects a numeric default for a boolean", () => {
    createEnv(
      // @ts-expect-error boolean defaults must be booleans
      { DEBUG: { type: "boolean", default: 123 } },
      { source: {} },
    );
  });

  it("rejects an enum default outside the declared values", () => {
    createEnv(
      // @ts-expect-error the default must be one of the enum values
      { NODE_ENV: { type: "enum", values: ["development", "production"], default: "staging" } },
      { source: {} },
    );
  });

  it("rejects unknown type tags", () => {
    createEnv(
      // @ts-expect-error "integer" is not a supported type
      { COUNT: { type: "integer" } },
      { source: {} },
    );
  });

  it("defineConfig preserves inference", () => {
    const schema = defineConfig({
      NODE_ENV: { type: "enum", values: ["development", "production"] },
    });
    const env = createEnv(schema, { source: {} });
    expectTypeOf(env.NODE_ENV).toEqualTypeOf<"development" | "production">();
  });
});
