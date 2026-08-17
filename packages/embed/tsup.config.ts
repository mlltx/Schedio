import { defineConfig } from "tsup";

const shared = {
  format: ["esm", "cjs"] as const,
  dts: true,
  sourcemap: true,
  external: ["react", "react-dom"],
};

export default defineConfig([
  {
    ...shared,
    entry: { index: "src/index.ts" },
    clean: true,
    // Every component in this entry needs a browser — see src/server.ts's
    // own docs for why the model-only entry below deliberately has none of
    // this, and must be built as a separate bundle to stay that way.
    banner: { js: '"use client";' },
  },
  {
    ...shared,
    entry: { server: "src/server.ts" },
    clean: false,
  },
]);
