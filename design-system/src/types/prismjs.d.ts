/**
 * `@types/prismjs` types the package's *main* entry, which is the one that
 * scans the document and highlights it on load. Bundled apps import the core
 * entry instead — same API, no auto-run — and the grammars as bare side
 * effects. Neither subpath is typed upstream, so they are declared here
 * against the typings that do exist.
 */
declare module "prismjs/components/prism-core" {
  import * as Prism from "prismjs"
  export = Prism
}

declare module "prismjs/components/prism-clike"
declare module "prismjs/components/prism-javascript"
declare module "prismjs/components/prism-markup"
declare module "prismjs/components/prism-css"
declare module "prismjs/components/prism-jsx"
declare module "prismjs/components/prism-typescript"
declare module "prismjs/components/prism-tsx"
declare module "prismjs/components/prism-json"
declare module "prismjs/components/prism-yaml"
declare module "prismjs/components/prism-markdown"
declare module "prismjs/components/prism-bash"
declare module "prismjs/components/prism-python"
declare module "prismjs/components/prism-toml"
declare module "prismjs/components/prism-ini"
declare module "prismjs/components/prism-sql"
declare module "prismjs/components/prism-diff"
