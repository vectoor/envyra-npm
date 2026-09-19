import type { SchemaCheck } from "./types/infer.js";
import type { EnvSchema } from "./types/schema.js";

/**
 * Identity helper for `env.config.ts`. It preserves full type inference
 * (including enum literal unions) without validating anything — the CLI
 * loads this file to learn the schema without touching the environment.
 *
 * ```ts
 * // env.config.ts
 * import { defineConfig } from "envyra";
 *
 * export default defineConfig({
 *   PORT: { type: "number", default: 3000 },
 * });
 * ```
 */
export function defineConfig<const S extends EnvSchema>(schema: S & SchemaCheck<S>): S {
  return schema;
}
