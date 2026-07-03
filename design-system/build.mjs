import * as esbuild from "esbuild";
import { execSync } from "node:child_process";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  outfile: "dist/ds-bundle.js",
  format: "esm",
  platform: "browser",
  external: ["react", "react-dom"],
  sourcemap: true,
  loader: { ".svg": "text" },
});

console.log("Built dist/ds-bundle.js + dist/ds-bundle.css");

execSync("tsc -p tsconfig.build.json", { stdio: "inherit" });

console.log("Built dist/index.d.ts");
