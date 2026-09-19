import { EnvValidationError } from "../../core/errors.js";
import { validateEnv } from "../../core/validate.js";
import { findConfigFile, loadSchema } from "../load-config.js";
import type { Logger } from "../logger.js";

export interface CheckOptions {
  cwd: string;
  /** Explicit config file path (overrides discovery). */
  config?: string;
  /**
   * Environment source to validate. Defaults to `process.env`.
   * Tests pass an isolated object here.
   */
  env?: Record<string, string | undefined>;
  /** Internal: module aliases for config loading (used by tests). */
  alias?: Record<string, string>;
  logger: Logger;
}

/**
 * `envyra check` — validate the current environment against the schema
 * without starting the application. Suitable for CI/CD.
 *
 * @returns 0 when the environment is valid, 1 when it is not.
 */
export async function cmdCheck(options: CheckOptions): Promise<number> {
  const { cwd, config, env, alias, logger } = options;

  const configPath = findConfigFile(cwd, config);
  const schema = await loadSchema(configPath, alias);

  try {
    validateEnv(schema, { source: env ?? process.env });
    logger.log("✓ Environment is valid.");
    return 0;
  } catch (error) {
    if (error instanceof EnvValidationError) {
      logger.error(error.message);
      return 1;
    }
    throw error;
  }
}
