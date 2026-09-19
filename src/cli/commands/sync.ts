import fs from "node:fs";
import path from "node:path";
import { renderEnvExample } from "../env-example.js";
import { findConfigFile, loadSchema } from "../load-config.js";
import type { Logger } from "../logger.js";
import { EXAMPLE_FILE_NAME } from "./init.js";

export interface SyncOptions {
  cwd: string;
  /** Explicit config file path (overrides discovery). */
  config?: string;
  /** Internal: module aliases for config loading (used by tests). */
  alias?: Record<string, string>;
  logger: Logger;
}

/**
 * `envyra sync` — regenerate `.env.example` from the schema.
 *
 * The file is fully managed: variables removed from the schema disappear,
 * new ones are added, and the output is deterministic. Only schema defaults
 * are written — never current runtime values, never secrets.
 *
 * @returns the process exit code (0 success, 1 failed).
 */
export async function cmdSync(options: SyncOptions): Promise<number> {
  const { cwd, config, alias, logger } = options;

  const configPath = findConfigFile(cwd, config);
  const schema = await loadSchema(configPath, alias);

  const target = path.join(cwd, EXAMPLE_FILE_NAME);
  const next = renderEnvExample(schema);

  const previous = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : undefined;
  if (previous === next) {
    logger.log(`✓ ${EXAMPLE_FILE_NAME} is up to date.`);
    return 0;
  }

  fs.writeFileSync(target, next, "utf8");
  logger.log(`✓ ${previous === undefined ? "Created" : "Updated"} ${EXAMPLE_FILE_NAME}`);
  return 0;
}
