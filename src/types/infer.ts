/**
 * Type-level inference from a schema to the validated environment object.
 */

/** Extract the union of enum values from a spec. */
type EnumValues<S> = S extends { values: infer V }
  ? V extends readonly string[]
    ? V[number]
    : never
  : never;

/** The parsed runtime type for a spec, before presence rules are applied. */
type BaseValue<S> = S extends { type: "number" }
  ? number
  : S extends { type: "boolean" }
    ? boolean
    : S extends { type: "url" }
      ? string
      : S extends { type: "enum" }
        ? EnumValues<S>
        : S extends { type: "json" }
          ? unknown
          : string;

/**
 * Apply presence rules:
 *
 * - a `default` guarantees a value, so the result is never `undefined`
 * - `required: false` adds `undefined`
 * - everything else is required and always present
 */
type WithPresence<S, T> = S extends { default: unknown }
  ? T
  : S extends { required: false }
    ? T | undefined
    : T;

/** The inferred type of a single environment variable. */
export type InferValue<S> = WithPresence<S, BaseValue<S>>;

/**
 * The inferred environment object for a whole schema.
 *
 * Combined with a `const` type parameter on `createEnv`, enum `values`
 * arrays keep their literal types without needing `as const`.
 */
export type InferEnv<S> = {
  [K in keyof S]: InferValue<S[K]>;
};

/**
 * Compile-time schema validation. For enum specs, `default` must be one of
 * the declared `values`; when it is not, the spec is rewritten so the
 * offending property fails assignability with a useful error.
 */
type CheckEnumDefault<S> = S extends { type: "enum"; values: infer V; default: infer D }
  ? V extends readonly string[]
    ? D extends V[number]
      ? S
      : Omit<S, "default"> & { default: V[number] }
    : S
  : S;

/** Mapped over a schema, flags invalid enum defaults at the call site. */
export type SchemaCheck<S> = {
  [K in keyof S]: CheckEnumDefault<S[K]>;
};
