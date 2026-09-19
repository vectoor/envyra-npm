import fs from "node:fs";
import path from "node:path";
import type { EnvSchema } from "../../types/schema.js";
import { renderEnvExample } from "../env-example.js";
import type { Logger } from "../logger.js";

export const CONFIG_FILE_NAME = "env.config.ts";
export const EXAMPLE_FILE_NAME = ".env.example";

const TEMPLATE_CONFIG = `import { defineConfig } from "envyra";

// Define your environment variables once, here. This file is the source of
// truth for validation, .env.example generation, and TypeScript inference.
//
// Every variable is a required string by default:
//
//   DATABASE_URL: {}
//
// is the same as:
//
//   DATABASE_URL: { type: "string", required: true }
export default defineConfig({
  NODE_ENV: {
    type: "enum",
    values: ["development", "test", "production"],
    default: "development",
    description: "Application environment.",
  },
  PORT: {
    type: "number",
    default: 3000,
    description: "Port the server listens on.",
  },
  DEBUG: {
    type: "boolean",
    default: false,
    description: "Enable debug logging.",
  },
});
`;

/** Kept in sync with TEMPLATE_CONFIG so `init` can render `.env.example`. */
const TEMPLATE_SCHEMA: EnvSchema = {
  NODE_ENV: {
    type: "enum",
    values: ["development", "test", "production"],
    default: "development",
    description: "Application environment.",
  },
  PORT: {
    type: "number",
    default: 3000,
    description: "Port the server listens on.",
  },
  DEBUG: {
    type: "boolean",
    default: false,
    description: "Enable debug logging.",
  },
};

export interface InitOptions {
  cwd: string;
  /** Overwrite existing files. */
  force?: boolean;
  logger: Logger;
}

/**
 * `envyra init` — create `env.config.ts` and `.env.example`.
 * Existing files are never overwritten unless `--force` is passed.
 *
 * @returns the process exit code (0 success, 1 refused/failed).
 */
export function cmdInit(options: InitOptions): number {
  const { cwd, force = false, logger } = options;

  const files: Array<{ name: string; contents: string }> = [
    { name: CONFIG_FILE_NAME, contents: TEMPLATE_CONFIG },
    { name: EXAMPLE_FILE_NAME, contents: renderEnvExample(TEMPLATE_SCHEMA) },
  ];

  if (!force) {
    const existing = files.filter((f) => fs.existsSync(path.join(cwd, f.name)));
    if (existing.length > 0) {
      for (const f of existing) {
        logger.error(`✖ ${f.name} already exists. Use --force to overwrite.`);
      }
      return 1;
    }
  }

  for (const f of files) {
    fs.writeFileSync(path.join(cwd, f.name), f.contents, "utf8");
    logger.log(`✓ Created ${f.name}`);
  }

  logger.log("");
  logger.log("envyra is ready.");
  return 0;
}
