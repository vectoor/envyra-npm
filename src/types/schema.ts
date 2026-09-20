/**
 * Schema definitions for envyra.
 *
 * A schema maps environment variable names to specs. Every spec defaults to:
 *
 *   type     = "string"
 *   required = true
 *   default  = undefined
 */

interface BaseSpec {
  /**
   * Whether the variable must be present (non-empty) in the environment.
   *
   * @default true
   */
  required?: boolean;
  /**
   * Marks the variable as secret. Secret values are never shown in error
   * output and never written to `.env.example`.
   *
   * @default false
   */
  secret?: boolean;
  /**
   * Human-readable description. Emitted as a comment in `.env.example`
   * by `envyra sync`.
   */
  description?: string;
  /**
   * An example value written to `.env.example` by `envyra sync`, purely as
   * documentation. Unlike `default`, it is never applied at runtime — a
   * required variable with an `example` is still required. Never emitted for
   * `secret: true` variables.
   */
  example?: string;
}

export interface StringSpec extends BaseSpec {
  type?: "string";
  default?: string;
}

export interface NumberSpec extends BaseSpec {
  type: "number";
  default?: number;
}

export interface BooleanSpec extends BaseSpec {
  type: "boolean";
  default?: boolean;
}

export interface UrlSpec extends BaseSpec {
  type: "url";
  default?: string;
}

export interface EnumSpec<V extends readonly string[] = readonly string[]> extends BaseSpec {
  type: "enum";
  values: V;
  default?: V[number];
}

export interface JsonSpec extends BaseSpec {
  type: "json";
  default?: unknown;
}

/**
 * A single environment variable spec. The discriminated `type` union keeps
 * invalid combinations (for example `type: "number"` with a string default)
 * unrepresentable in TypeScript.
 */
export type EnvSpec = StringSpec | NumberSpec | BooleanSpec | UrlSpec | EnumSpec | JsonSpec;

/**
 * The schema is the source of truth for an application's environment:
 * a map of variable names to specs.
 */
export type EnvSchema = Record<string, EnvSpec>;

/** The set of supported type tags. */
export type EnvSpecType = NonNullable<EnvSpec["type"]>;
