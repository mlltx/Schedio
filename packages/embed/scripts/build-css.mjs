// Compiles Tailwind, then scopes every generated rule under
// `.schedio-embed-root` (the wrapper our top-level components render) via
// postcss-prefix-selector. This isolates our styles from the host page
// without renaming a single Tailwind class in component source — the
// alternative, Tailwind v4's built-in `prefix()`, requires a `sch:` (or
// similar) prefix on every utility class in every component, which isn't
// worth the churn/risk for what's fundamentally a "don't leak into the
// host page" concern rather than a naming concern.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import prefixSelector from "postcss-prefix-selector";

const dir = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(dir, "../src/styles.css");
const outDir = path.join(dir, "../dist");
const output = path.join(outDir, "style.css");

const css = await readFile(input, "utf8");

const result = await postcss([
  tailwindcss(),
  prefixSelector({
    prefix: ".schedio-embed-root",
    transform(prefix, selector) {
      // Rules that already target :root / html / body (Tailwind's base
      // layer) would become inert nonsense if naively prefixed as a
      // descendant combinator — scope those to apply *to* our root
      // element instead of *within* it.
      if (selector === ":root" || selector === "html" || selector === "body") {
        return prefix;
      }
      // A plain descendant combinator (`${prefix} ${selector}`) only
      // matches a utility class applied to a *descendant* of the root —
      // it never matches the root element itself carrying that class on
      // its own `className`, which every top-level component's own root
      // div does (`schedio-embed-root mx-auto max-w-2xl ...`, all one
      // element), and so does every portaled popover (`schedio-embed-root
      // fixed z-50 ...`, reapplied since a portal escapes this ancestor
      // entirely). `:is()` matches either shape without needing to know
      // which one a given selector will end up used as.
      return `:is(${prefix} ${selector}, ${prefix}${selector})`;
    },
  }),
]).process(css, { from: input, to: output });

await mkdir(outDir, { recursive: true });
await writeFile(output, result.css, "utf8");
console.log(`Wrote ${path.relative(process.cwd(), output)} (${(result.css.length / 1024).toFixed(1)} KB)`);
