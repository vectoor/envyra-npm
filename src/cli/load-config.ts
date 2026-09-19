import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import { EnvyraError } from "../core/errors.js";
import { assertValidSchema } from "../core/schema.js";
import type { EnvSchema } from "../types/schema.js";

/** Config file candidates, in priority order, relative to the project root. */
export const CONFIG_CANDIDATES = [
  "env.config.ts",
  "env.config.mts",
  "env.config.js",
  "env.config.mjs",
  "env.config.cjs",
] as const;

/**
 * Resolve the config file path. An explicit `--config` path wins; otherwise
 * the first matching candidate in `cwd` is used.
 *
 * @throws {EnvyraError} when no config file can be found.
 */
export function findConfigFile(cwd: string, explicitPath?: string): string {
  if (explicitPath !== undefined) {
    const resolved = path.resolve(cwd, explicitPath);
    if (!fs.existsSync(resolved)) {
      throw new EnvyraError(`Config file not found: ${resolved}`);
    }
    return resolved;
  }

  for (const candidate of CONFIG_CANDIDATES) {
    const resolved = path.join(cwd, candidate);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  throw new EnvyraError(
    `No env config found in ${cwd}.\nExpected one of: ${CONFIG_CANDIDATES.join(", ")}.\nRun \`envyra init\` to create one.`,
  );
}

/**
 * Load the schema from a config file. TypeScript configs are supported via
 * jiti, so consumers never need a separate compilation step.
 *
 * The config must export the schema as its default export (recommended, via
 * `defineConfig`) or as a named `schema` export. The config is never executed
 * against the environment — it only describes it.
 *
 * @throws {EnvyraError} when the file has no usable schema export.
 * @throws {EnvSchemaError} when the exported schema is invalid.
 */
export async function loadSchema(
  configPath: string,
  alias?: Record<string, string>,
): Promise<EnvSchema> {
  // Caches are disabled so repeated loads (sync after editing the config,
  // tests, programmatic use) always see the current file contents.
  const jiti = createJiti(import.meta.url, { alias, fsCache: false, moduleCache: false });
  const mod = (await jiti.import(pathToFileURL(configPath).href)) as Record<string, unknown>;

  const schema = mod.default ?? mod.schema;
  if (schema === undefined) {
    throw new EnvyraError(
      `${path.basename(configPath)} must export the schema as its default export (via defineConfig) or as a named \`schema\` export.`,
    );
  }

  assertValidSchema(schema);
  return schema;
}
