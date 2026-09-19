import type { InferEnv, SchemaCheck } from "../types/infer.js";
import type { EnvSchema } from "../types/schema.js";
import { EnvValidationError } from "./errors.js";
import { assertValidSchema } from "./schema.js";
import { type ValidateEnvOptions, validateEnv } from "./validate.js";

export interface CreateEnvOptions extends ValidateEnvOptions {
  /**
   * When `true`, print the validation report to stderr and exit the process
   * with code 1 instead of throwing. Off by default so validation stays easy
   * to test; throw-and-crash is the recommended default for applications.
   *
   * @default false
   */
  exitOnError?: boolean;
}

/**
 * Define environment variables once, validate them at startup, and use them
 * type-safely everywhere.
 *
 * ```ts
 * export const env = createEnv({
 *   DATABASE_URL: {},
 *   PORT: { type: "number", default: 3000 },
 *   NODE_ENV: { type: "enum", values: ["development", "production"] },
 * });
 * ```
 *
 * Validation runs once, eagerly, and reports every problem together. The
 * returned object is frozen and fully inferred. `process.env` is the default
 * source and is never mutated.
 *
 * @throws {EnvSchemaError} when the schema itself is invalid.
 * @throws {EnvValidationError} when one or more variables fail validation.
 */
export function createEnv<const S extends EnvSchema>(
  schema: S & SchemaCheck<S>,
  options: CreateEnvOptions = {},
): InferEnv<S> {
  assertValidSchema(schema);

  try {
    const values = validateEnv(schema, options);
    return Object.freeze(values) as InferEnv<S>;
  } catch (error) {
    if (error instanceof EnvValidationError && options.exitOnError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}
