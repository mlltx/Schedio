import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // @schedio/embed is a type-only dependency (see README) — nothing from
  // it should ever end up in this bundle. There's nothing else to
  // externalize: this connector's only runtime dependency is fetch.
  external: ["@schedio/embed"],
});
