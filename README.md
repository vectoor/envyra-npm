# envyra

> Define your environment once. Validate it at startup. Use it type-safely everywhere.

`envyra` is a small, dependency-light library for Node.js and TypeScript that
turns `process.env` into a validated, fully typed configuration object.

- **Type-safe by default** — full inference from the schema, no duplicate interfaces.
- **Fail early, fail loud** — invalid configuration crashes at startup with every problem listed.
- **Secure by default** — secrets never appear in error output or `.env.example`.
- **Source-agnostic** — works with `.env` files, Docker, Kubernetes, CI/CD, and any hosting platform, because the runtime source of truth is `process.env`.

> **Name note:** if the npm name `envyra` is taken at publish time, rename the
> `name` field in `package.json` (and the imports below) before publishing.
> Everything else is name-agnostic.

## Installation

```bash
npm install envyra
```

Requires Node.js 20 or later.

## Quick start

Define the schema once — every variable is a **required string** unless you say otherwise:

```ts
// env.ts
import { createEnv } from "envyra";

export const env = createEnv({
  DATABASE_URL: {},
  JWT_SECRET: { secret: true },
  PORT: { type: "number", default: 3000 },
  DEBUG: { type: "boolean", default: false },
  REDIS_URL: { required: false },
  NODE_ENV: {
    type: "enum",
    values: ["development", "test", "production"],
    default: "development",
  },
});
```

Use it everywhere — with autocomplete and compile-time protection against typos:

```ts
import { env } from "./env";

server.listen(env.PORT);              // number
connectDatabase(env.DATABASE_URL);    // string
env.REDIS_URL;                        // string | undefined
env.NODE_ENV;                         // "development" | "test" | "production"
env.DATABSE_URL;                      // ✗ compile error — no such key

if (env.DEBUG) {
  enableDebugLogging();
}
```

## Sensible defaults

For every variable:

| Option     | Default    |
| ---------- | ---------- |
| `type`     | `"string"` |
| `required` | `true`     |
| `default`  | `undefined` |

So `DATABASE_URL: {}` means "a required string". No boilerplate.

## Supported types

| Type      | Runtime result | Notes |
| --------- | -------------- | ----- |
| `string`  | `string`       | The default. |
| `number`  | `number`       | Decimals and exponents allowed; `123abc`, `0x10`, `NaN`, `Infinity` rejected. |
| `boolean` | `boolean`      | Explicit only: `true`, `false`, `1`, `0` (case-insensitive). Never JS truthiness. |
| `url`     | `string`       | Validated with the platform `URL`; any scheme (`https:`, `postgres:`, ...). |
| `enum`    | literal union  | Only declared `values` are valid; inferred as `"a" \| "b"`, not `string`. |
| `json`    | `unknown`      | Parsed with `JSON.parse`; narrow the result yourself. |

```ts
createEnv({
  PORT: { type: "number" },
  DEBUG: { type: "boolean" },
  DATABASE_URL: { type: "url" },
  NODE_ENV: { type: "enum", values: ["development", "production"] },
  FEATURE_CONFIG: { type: "json" },
});
```

## Optional variables and defaults

```ts
createEnv({
  REDIS_URL: { required: false },                  // string | undefined
  CACHE_TTL: { type: "number", required: false },  // number | undefined
  PORT: { type: "number", default: 3000 },         // number — a default guarantees a value
});
```

Missing optional variables are `undefined`, never `null`. Invalid
schema/default combinations (a string default for a number, an enum default
outside its values) are rejected by TypeScript at compile time.

## Required variables and empty strings

Required variables must be present **and non-empty**:

- `JWT_SECRET` unset → validation error.
- `JWT_SECRET=` (empty) → validation error.
- `JWT_SECRET=   ` → trimmed, then treated as missing.

Both behaviors are configurable:

```ts
createEnv(schema, { trim: false, emptyStringAsMissing: false });
```

## Error handling

Validation collects **all** problems before failing, so one restart reveals
every issue:

```txt
Environment validation failed

✖ DATABASE_URL
  Required environment variable is missing.

✖ PORT
  Expected a number. Received "hello".

✖ NODE_ENV
  Expected one of: "development", "production". Received "staging".

3 environment errors found.
```

Errors are structured, so you can handle them programmatically:

```ts
import { createEnv, EnvValidationError } from "envyra";

try {
  createEnv(schema);
} catch (error) {
  if (error instanceof EnvValidationError) {
    for (const issue of error.issues) {
      issue.key;     // "PORT"
      issue.code;    // "invalid_number"
      issue.message; // human-readable, secret-safe
    }
  }
}
```

By default `createEnv` throws. For scripts and CLIs you can opt into printing
the report and exiting with code 1 instead:

```ts
createEnv(schema, { exitOnError: true });
```

## Secrets

Mark sensitive variables and their values will never appear in error output:

```ts
createEnv({
  JWT_SECRET: { secret: true },
});
```

For non-secret variables, invalid values are shown (truncated at 100
characters) to aid debugging. `envyra sync` writes only schema defaults to
`.env.example` — never current runtime values, and never defaults of
`secret: true` variables.

## Custom sources and testing

`createEnv` never mutates `process.env`, and you can validate any source:

```ts
const env = createEnv(schema, {
  source: { PORT: "3000", DEBUG: "true" },
});
```

This makes tests trivial — no `process.env` stubbing required.

## `.env` files

`envyra` deliberately does **not** load `.env` files. Populate `process.env`
however you like — Node's `--env-file`, dotenv, Docker, Kubernetes, your
hosting platform — and `envyra` validates the result. In production you
usually don't need a `.env` file at all.

## CLI

```bash
npx envyra init    # create env.config.ts and .env.example
npx envyra check   # validate the current environment (CI-friendly)
npx envyra sync    # generate/update .env.example from the schema
```

The CLI discovers `env.config.ts` (or `env.config.js`) in the current
directory; pass `--config <path>` to use a different file. The config exports
the schema via `defineConfig`, and is loaded without compiling your project:

```ts
// env.config.ts
import { defineConfig } from "envyra";

export default defineConfig({
  DATABASE_URL: { type: "url" },
  PORT: { type: "number", default: 3000 },
});
```

```ts
// src/env.ts
import { createEnv } from "envyra";
import schema from "../env.config";

export const env = createEnv(schema);
```

### init

```txt
✓ Created env.config.ts
✓ Created .env.example

envyra is ready.
```

Existing files are never overwritten without `--force`.

### check

```txt
✓ Environment is valid.
```

Exit codes: `0` = valid, `1` = invalid. Perfect for CI/CD:

```yaml
# .github/workflows/ci.yml
- name: Validate environment
  run: npx envyra check
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

### sync

Regenerates `.env.example` from the schema — the file is fully managed, so
output is deterministic and re-running without schema changes produces no
diff. Removed variables disappear, new ones appear, defaults are filled in,
and enums get an "allowed values" comment:

```env
# Generated by envyra from your env config. Do not edit by hand.
# Run `npx envyra sync` to regenerate.

DATABASE_URL=

JWT_SECRET=

PORT=3000

# Optional.
REDIS_URL=

# Allowed values: "development", "test", "production"
NODE_ENV=development
```

## Docker and production

`envyra` validates `process.env`, so production needs nothing special:

```dockerfile
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]   # createEnv() validates at startup
```

```bash
docker run -e DATABASE_URL=... -e JWT_SECRET=... my-app
```

## TypeScript

Inference is automatic — no parallel interface to maintain:

| Schema | Inferred type |
| ------ | ------------- |
| `{}` | `string` |
| `{ type: "number" }` | `number` |
| `{ required: false }` | `string \| undefined` |
| `{ type: "number", default: 3000 }` | `number` |
| `{ type: "enum", values: ["a", "b"] }` | `"a" \| "b"` |
| `{ type: "json" }` | `unknown` |

Enum literals are preserved without `as const`. The `InferEnv<typeof schema>`
type is exported for advanced use.

## API

```ts
import {
  createEnv,           // (schema, options?) => typed env object
  defineConfig,        // identity helper for env.config.ts
  EnvyraError,         // base error class
  EnvValidationError,  // validation failure; exposes .issues
  EnvSchemaError,      // invalid schema (programmer error)
} from "envyra";

import type {
  EnvSchema,
  EnvSpec,
  EnvIssue,
  InferEnv,
  CreateEnvOptions,
} from "envyra";
```

That's the whole public API.

## License

MIT
