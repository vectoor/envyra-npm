import type { EnvSchema } from "../types/schema.js";
import { EnvSchemaError } from "./errors.js";

const KNOWN_TYPES = new Set(["string", "number", "boolean", "url", "enum", "json"]);

/**
 * Runtime validation of the schema itself. TypeScript catches most mistakes
 * at compile time; this protects JavaScript consumers and loosely typed code.
 *
 * @throws {EnvSchemaError} listing every problem found.
 */
export function assertValidSchema(schema: unknown): asserts schema is EnvSchema {
  const problems: string[] = [];

  if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
    throw new EnvSchemaError(["The schema must be an object mapping variable names to specs."]);
  }

  for (const [key, spec] of Object.entries(schema)) {
    if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
      problems.push(`${key}: spec must be an object.`);
      continue;
    }

    const s = spec as Record<string, unknown>;

    if (s.type !== undefined && (typeof s.type !== "string" || !KNOWN_TYPES.has(s.type))) {
      problems.push(
        `${key}: unknown type ${JSON.stringify(s.type)}. ` +
          `Expected one of: ${[...KNOWN_TYPES].join(", ")}.`,
      );
      continue;
    }

    if (s.type === "enum") {
      if (
        !Array.isArray(s.values) ||
        s.values.length === 0 ||
        !s.values.every((v) => typeof v === "string")
      ) {
        problems.push(`${key}: enum specs require a non-empty "values" array of strings.`);
      } else if (s.default !== undefined && !s.values.includes(s.default as string)) {
        problems.push(
          `${key}: enum default ${JSON.stringify(s.default)} is not one of the declared values.`,
        );
      }
    }

    if (s.example !== undefined && typeof s.example !== "string") {
      problems.push(`${key}: example must be a string.`);
    }

    if (s.type === "number" && s.default !== undefined && typeof s.default !== "number") {
      problems.push(`${key}: number default must be a number.`);
    }

    if (s.type === "boolean" && s.default !== undefined && typeof s.default !== "boolean") {
      problems.push(`${key}: boolean default must be a boolean.`);
    }
  }

  if (problems.length > 0) {
    throw new EnvSchemaError(problems);
  }
}
