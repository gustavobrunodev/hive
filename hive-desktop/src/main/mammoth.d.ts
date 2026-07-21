/**
 * Minimal ambient declaration for `mammoth` (docx → HTML). The package ships
 * no type definitions, and we only touch `convertToHtml` with a `path` input,
 * a `convertImage` image handler, and the `{ value, messages }` result — so a
 * hand-written surface is leaner (and safer to pin) than pulling a community
 * `@types` package for one call site.
 */
declare module 'mammoth' {
  interface MammothImage {
    contentType: string
    read(encoding: 'base64'): Promise<string>
  }
  interface MammothImageHandler {
    (element: MammothImage): Promise<{ src: string }>
  }
  interface MammothInput {
    path?: string
    buffer?: Buffer
  }
  interface MammothOptions {
    styleMap?: string[] | string
    convertImage?: MammothImageHandler
    includeDefaultStyleMap?: boolean
  }
  interface MammothMessage {
    type: string
    message: string
  }
  interface MammothResult {
    value: string
    messages: MammothMessage[]
  }
  interface Mammoth {
    convertToHtml(input: MammothInput, options?: MammothOptions): Promise<MammothResult>
    images: {
      imgElement(handler: MammothImageHandler): MammothImageHandler
    }
  }
  const mammoth: Mammoth
  export = mammoth
}
