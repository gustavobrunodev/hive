import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.js"],
  bundle: true,
  outfile: "dist/ds-bundle.js",
  format: "esm",
  platform: "browser",
  external: ["react", "react-dom"],
  sourcemap: true,
  loader: { ".svg": "text" },
});

console.log("Built dist/ds-bundle.js + dist/ds-bundle.css");
