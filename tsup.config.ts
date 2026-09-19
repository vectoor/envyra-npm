import { defineConfig } from "tsup";

// The library ships dual ESM + CJS. The CLI is ESM-only — it is executed via
// the `envyra` bin (a `node dist/cli.js` shim), which supports ESM on every
// supported Node version, and it relies on `import.meta.url`.
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    target: "node20",
    outDir: "dist",
  },
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["esm"],
    dts: false,
    sourcemap: true,
    target: "node20",
    outDir: "dist",
  },
]);
