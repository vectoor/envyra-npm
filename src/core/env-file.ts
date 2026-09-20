import fs from "node:fs";
import path from "node:path";
import { EnvyraError } from "./errors.js";

/**
 * Minimal `.env` parser, kept deliberately small so envyra needs no dotenv
 * dependency. Supported:
 *
 * - `KEY=VALUE` lines
 * - blank lines and `#` comments
 * - an optional `export ` prefix
 * - single-quoted values (literal) and double-quoted values (with
 *   `\n`, `\r`, `\t`, `\"`, and `\\` escapes)
 *
 * Not supported, by design: variable expansion, multiline values, and inline
 * comments after unquoted values. Keep the file simple.
 */
export function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const entry = line.startsWith("export ") ? line.slice("export ".length).trimStart() : line;
    const eq = entry.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const key = entry.slice(0, eq).trim();
    if (key === "") {
      continue;
    }

    result[key] = unquote(entry.slice(eq + 1).trim());
  }

  return result;
}

function unquote(value: string): string {
  if (value.length < 2) {
    return value;
  }
  const quote = value[0];
  if (quote !== '"' && quote !== "'") {
    return value;
  }
  if (!value.endsWith(quote)) {
    return value;
  }
  const inner = value.slice(1, -1);
  if (quote === "'") {
    return inner;
  }
  return inner
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/**
 * Read and parse the `.env` file in `cwd`. The file name is fixed on
 * purpose: `source: "file"` is a convention, not a configuration surface.
 *
 * @throws {EnvyraError} when no `.env` file exists — never a silent pass.
 */
export function loadEnvFile(cwd: string): Record<string, string> {
  const file = path.join(cwd, ".env");
  if (!fs.existsSync(file)) {
    throw new EnvyraError(
      `source: "file" was requested, but no .env file exists in ${cwd}. Create one or use the default process.env source.`,
    );
  }
  return parseEnvFile(fs.readFileSync(file, "utf8"));
}
