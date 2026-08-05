declare module "*.svg" {
  const src: string
  export default src
}

/**
 * `?raw` is Vite's explicit "give me the file's text" import. The bundled build
 * inlines `.svg` through esbuild's `text` loader, but under Vite a plain `.svg`
 * import resolves to a URL — so a test that needs to assert on the *artwork*
 * (Logo.test.tsx) asks for the source explicitly rather than reaching for
 * `node:fs`, which this package has no types for.
 */
declare module "*.svg?raw" {
  const source: string
  export default source
}
