import * as esbuild from "esbuild"
import { execSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

// 1. src/tokens.css a partir de src/tokens/tokens.ts (a fonte dos tokens).
mkdirSync(".design-sync/tmp", { recursive: true })
await esbuild.build({ entryPoints: ["src/tokens/css.ts"], bundle: true, format: "esm", platform: "node", outfile: ".design-sync/tmp/tokens-css.mjs", logLevel: "silent" })
const { gerarTokensCss } = await import(pathToFileURL(".design-sync/tmp/tokens-css.mjs").href + `?t=${Date.now()}`)
writeFileSync("src/tokens.css", gerarTokensCss())
console.log("Gerado src/tokens.css")

// 2. O bundle ESM + o CSS (tokens, fontes, base e componentes).
await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/ds-bundle.js",
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime"],
  sourcemap: true,
  loader: { ".woff2": "file" },
  assetNames: "fonts/[name]",
  logLevel: "warning",
})
console.log("Gerado dist/ds-bundle.js + dist/ds-bundle.css")

// 3. As declarações de tipo.
execSync("npx tsc -p tsconfig.build.json", { stdio: "inherit" })
console.log("Gerado dist/index.d.ts")
