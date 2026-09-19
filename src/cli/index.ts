#!/usr/bin/env node
import fs from "node:fs";
import { cmdCheck } from "./commands/check.js";
import { cmdInit } from "./commands/init.js";
import { cmdSync } from "./commands/sync.js";
import { consoleLogger } from "./logger.js";

const HELP = `envyra — define your environment once, validate it at startup, use it type-safely everywhere.

Usage
  envyra <command> [options]

Commands
  init      Create env.config.ts and .env.example
  check     Validate the current environment against the schema (exit 0 = valid, 1 = invalid)
  sync      Generate or update .env.example from the schema

Options
  --config <path>  Path to the config file (default: env.config.ts in the current directory)
  --force          Overwrite existing files (init only)
  -h, --help       Show this help
  -v, --version    Show the version
`;

interface ParsedArgs {
  command: string | undefined;
  config?: string;
  force: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = { command: undefined, force: false, help: false, version: false };
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        result.help = true;
        break;
      case "-v":
      case "--version":
        result.version = true;
        break;
      case "--force":
        result.force = true;
        break;
      case "--config": {
        const value = argv[i + 1];
        if (value === undefined) {
          throw new Error("--config requires a path.");
        }
        result.config = value;
        i += 1;
        break;
      }
      default:
        if (arg.startsWith("--config=")) {
          result.config = arg.slice("--config=".length);
        } else if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        } else {
          rest.push(arg);
        }
    }
  }

  result.command = rest[0];
  return result;
}

function readVersion(): string {
  try {
    const url = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(fs.readFileSync(url, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(readVersion());
    return 0;
  }

  if (args.help || args.command === undefined) {
    console.log(HELP);
    return 0;
  }

  const cwd = process.cwd();

  switch (args.command) {
    case "init":
      return cmdInit({ cwd, force: args.force, logger: consoleLogger });
    case "check":
      return cmdCheck({ cwd, config: args.config, logger: consoleLogger });
    case "sync":
      return cmdSync({ cwd, config: args.config, logger: consoleLogger });
    default:
      console.error(`Unknown command: ${args.command}\n`);
      console.error(HELP);
      return 1;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
