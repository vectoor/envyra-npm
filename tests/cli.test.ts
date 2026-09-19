import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cmdCheck } from "../src/cli/commands/check.js";
import { cmdInit } from "../src/cli/commands/init.js";
import { cmdSync } from "../src/cli/commands/sync.js";
import type { Logger } from "../src/cli/logger.js";

/**
 * Config files written into temp dirs import "envyra", which cannot be
 * resolved from outside the repo — map it to the source entry for tests.
 */
const ALIAS = { envyra: fileURLToPath(new URL("../src/index.ts", import.meta.url)) };

function makeLogger(): Logger & { lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    lines,
    errors,
    log: (m) => lines.push(m),
    error: (m) => errors.push(m),
  };
}

let cwd: string;

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "envyra-test-"));
});

afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
});

function writeConfig(contents: string): void {
  fs.writeFileSync(path.join(cwd, "env.config.ts"), contents, "utf8");
}

const BASIC_CONFIG = `import { defineConfig } from "envyra";
export default defineConfig({
  DATABASE_URL: {},
  PORT: { type: "number", default: 3000 },
});
`;

describe("envyra init", () => {
  it("creates env.config.ts and .env.example", () => {
    const logger = makeLogger();
    const code = cmdInit({ cwd, logger });

    expect(code).toBe(0);
    expect(fs.existsSync(path.join(cwd, "env.config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(cwd, ".env.example"))).toBe(true);
    expect(logger.lines).toContain("✓ Created env.config.ts");
    expect(logger.lines).toContain("✓ Created .env.example");
    expect(logger.lines).toContain("envyra is ready.");
  });

  it("creates a config the other commands can load", async () => {
    cmdInit({ cwd, logger: makeLogger() });
    const logger = makeLogger();
    const code = await cmdCheck({ cwd, alias: ALIAS, env: {}, logger });
    expect(code).toBe(0);
  });

  it("refuses to overwrite existing files without --force", () => {
    fs.writeFileSync(path.join(cwd, "env.config.ts"), "// keep me\n", "utf8");
    const logger = makeLogger();

    const code = cmdInit({ cwd, logger });

    expect(code).toBe(1);
    expect(logger.errors.some((l) => l.includes("already exists"))).toBe(true);
    expect(fs.readFileSync(path.join(cwd, "env.config.ts"), "utf8")).toBe("// keep me\n");
    expect(fs.existsSync(path.join(cwd, ".env.example"))).toBe(false);
  });

  it("overwrites existing files with --force", () => {
    fs.writeFileSync(path.join(cwd, "env.config.ts"), "// old\n", "utf8");
    const code = cmdInit({ cwd, force: true, logger: makeLogger() });

    expect(code).toBe(0);
    expect(fs.readFileSync(path.join(cwd, "env.config.ts"), "utf8")).toContain("defineConfig");
  });
});

describe("envyra check", () => {
  it("exits 0 when the environment is valid", async () => {
    writeConfig(BASIC_CONFIG);
    const logger = makeLogger();

    const code = await cmdCheck({
      cwd,
      alias: ALIAS,
      env: { DATABASE_URL: "postgres://x" },
      logger,
    });

    expect(code).toBe(0);
    expect(logger.lines).toContain("✓ Environment is valid.");
  });

  it("exits 1 and reports every problem when the environment is invalid", async () => {
    writeConfig(BASIC_CONFIG);
    const logger = makeLogger();

    const code = await cmdCheck({ cwd, alias: ALIAS, env: {}, logger });

    expect(code).toBe(1);
    const output = logger.errors.join("\n");
    expect(output).toContain("Environment validation failed");
    expect(output).toContain("DATABASE_URL");
    expect(output).toContain("1 environment error found.");
  });

  it("fails with a clear error when no config exists", async () => {
    await expect(
      cmdCheck({ cwd, alias: ALIAS, env: {}, logger: makeLogger() }),
    ).rejects.toThrowError(/No env config found/);
  });

  it("honors an explicit --config path", async () => {
    fs.mkdirSync(path.join(cwd, "config"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "config", "custom.ts"), BASIC_CONFIG, "utf8");
    const logger = makeLogger();

    const code = await cmdCheck({
      cwd,
      alias: ALIAS,
      config: "config/custom.ts",
      env: { DATABASE_URL: "x" },
      logger,
    });

    expect(code).toBe(0);
  });
});

describe("envyra sync", () => {
  it("generates .env.example from the schema", async () => {
    writeConfig(BASIC_CONFIG);
    const logger = makeLogger();

    const code = await cmdSync({ cwd, alias: ALIAS, logger });

    expect(code).toBe(0);
    const example = fs.readFileSync(path.join(cwd, ".env.example"), "utf8");
    expect(example).toContain("DATABASE_URL=");
    expect(example).toContain("PORT=3000");
  });

  it("is deterministic — a second run produces no changes", async () => {
    writeConfig(BASIC_CONFIG);
    const first = makeLogger();
    await cmdSync({ cwd, alias: ALIAS, logger: first });
    const before = fs.readFileSync(path.join(cwd, ".env.example"), "utf8");

    const second = makeLogger();
    const code = await cmdSync({ cwd, alias: ALIAS, logger: second });

    expect(code).toBe(0);
    expect(fs.readFileSync(path.join(cwd, ".env.example"), "utf8")).toBe(before);
    expect(second.lines).toContain("✓ .env.example is up to date.");
  });

  it("removes variables that were removed from the schema", async () => {
    writeConfig(BASIC_CONFIG);
    await cmdSync({ cwd, alias: ALIAS, logger: makeLogger() });

    writeConfig(`import { defineConfig } from "envyra";
export default defineConfig({ PORT: { type: "number", default: 3000 } });
`);
    await cmdSync({ cwd, alias: ALIAS, logger: makeLogger() });

    const example = fs.readFileSync(path.join(cwd, ".env.example"), "utf8");
    expect(example).not.toContain("DATABASE_URL");
    expect(example).toContain("PORT=3000");
  });

  it("never writes secret or runtime values into .env.example", async () => {
    writeConfig(`import { defineConfig } from "envyra";
export default defineConfig({
  JWT_SECRET: { secret: true },
  API_TOKEN: { secret: true, default: "schema-default-that-must-not-leak" },
  REGION: { default: "us-east-1" },
});
`);
    process.env.JWT_SECRET = "super-secret-runtime-value";
    try {
      await cmdSync({ cwd, alias: ALIAS, logger: makeLogger() });
    } finally {
      // biome-ignore lint/performance/noDelete: removing the key entirely is the point
      delete process.env.JWT_SECRET;
    }

    const example = fs.readFileSync(path.join(cwd, ".env.example"), "utf8");
    expect(example).toContain("JWT_SECRET=\n");
    expect(example).toContain("API_TOKEN=\n");
    expect(example).toContain("REGION=us-east-1");
    expect(example).not.toContain("super-secret-runtime-value");
    expect(example).not.toContain("schema-default-that-must-not-leak");
  });

  it("documents enums and optional variables as comments", async () => {
    writeConfig(`import { defineConfig } from "envyra";
export default defineConfig({
  NODE_ENV: { type: "enum", values: ["development", "production"], default: "development" },
  REDIS_URL: { required: false, description: "Cache connection string." },
});
`);
    await cmdSync({ cwd, alias: ALIAS, logger: makeLogger() });

    const example = fs.readFileSync(path.join(cwd, ".env.example"), "utf8");
    expect(example).toContain('# Allowed values: "development", "production"');
    expect(example).toContain("# Cache connection string.");
    expect(example).toContain("# Optional.");
  });
});
