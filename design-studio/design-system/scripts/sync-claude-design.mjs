// Monta, a partir da lib, a pasta que o design system da Claude Design espera
// (o formato "Design System": tokens.json, bundle IIFE, prévias ao vivo,
// READMEs, assets e o índice). Não publica nada: quem publica é o agente,
// com a ferramenta de Artifacts, a partir de .design-sync/saida/.
//
//   node scripts/sync-claude-design.mjs          monta a saída
//
// Os assets (SVG/PNG) sobem como uploads; .design-sync/blobs.json guarda o
// sha256 e o id de cada um já enviado. Um asset novo ou alterado sai em
// .design-sync/saida/uploads.json e o índice só é gerado quando todos têm id.
import * as esbuild from "esbuild"
import { createHash } from "node:crypto"
import { execSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const RAIZ = resolve(dirname(new URL(import.meta.url).pathname), "..")
const SAIDA = join(RAIZ, ".design-sync/saida")
const PROJETO = join(SAIDA, "project")
const TMP = join(RAIZ, ".design-sync/tmp")
const BLOBS = join(RAIZ, ".design-sync/blobs.json")
const INDICE_ATUAL = join(RAIZ, ".design-sync/referencia/design-system.json")
const NS = "DesignStudio"

const escrever = (rel, conteudo) => {
  const p = join(PROJETO, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, conteudo)
}
const sha = (buf) => createHash("sha256").update(buf).digest("hex")

rmSync(SAIDA, { recursive: true, force: true })
mkdirSync(PROJETO, { recursive: true })
mkdirSync(TMP, { recursive: true })

// 0. tokens.css em dia e a lib compilando.
execSync("node build.mjs", { cwd: RAIZ, stdio: "inherit" })

const pastas = readdirSync(join(RAIZ, "src/components")).filter((p) => existsSync(join(RAIZ, "src/components", p, `${p}.stories.tsx`)))

// `?raw` (README nas histórias) vira texto; na prévia não é usado.
const raw = {
  name: "raw",
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: resolve(a.resolveDir, a.path.replace(/\?raw$/, "")), namespace: "raw" }))
    b.onLoad({ filter: /.*/, namespace: "raw" }, (a) => ({ contents: readFileSync(a.path, "utf8"), loader: "text" }))
  },
}

// 1. Sonda em Node: tokens, ícones, marcas e o meta de cada história.
await esbuild.build({
  stdin: {
    contents:
      `export * as tokens from "./src/tokens/tokens"\nexport { icones } from "./src/icones/icones"\nexport { marcasDosAgentes } from "./src/marcas/marcas"\n` +
      pastas.map((p, i) => `import * as h${i} from "./src/components/${p}/${p}.stories"`).join("\n") +
      `\nexport const historias = { ${pastas.map((p, i) => `${JSON.stringify(p)}: h${i}`).join(", ")} }\n`,
    resolveDir: RAIZ,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  outfile: join(TMP, "sonda.mjs"),
  external: ["react", "react-dom", "react/jsx-runtime"],
  loader: { ".css": "empty", ".woff2": "empty" },
  plugins: [raw],
  logLevel: "warning",
})
const sonda = await import(pathToFileURL(join(TMP, "sonda.mjs")).href + `?t=${Date.now()}`)
const GRUPOS = ["Marca e ícones", "Agentes", "Ações", "Seleção", "Rótulos", "Entrada", "Navegação", "Quadro", "Modo ao vivo", "Conversa", "Avisos", "Superfícies", "Dados"]
const grupoDe = (p) => GRUPOS.indexOf(sonda.historias[p].default.title.split("/")[0])
pastas.sort((a, b) => grupoDe(a) - grupoDe(b) || a.localeCompare(b))
const T = sonda.tokens

// 2. tokens.json no formato que a página lê (listas, nunca mapas).
const tokensJson = {
  name: "Design Studio",
  version: 2,
  color: {
    themes: [
      { id: "light", name: "Claro" },
      { id: "dark", name: "Escuro" },
    ],
    tokens: T.cores.map((c) => ({ name: c.nome, value: c.escuro ? { light: c.claro, dark: c.escuro } : { light: c.claro }, usage: c.uso })),
  },
  type: {
    fonts: T.arquivosDeFonte.map((f) => ({ family: f.familia, file: f.arquivo, weight: f.peso, style: "normal" })),
    families: { ...T.familias },
    groups: [
      ["Títulos", "titulo"],
      ["Interface", "ui"],
    ].map(([name, family]) => ({
      name,
      family,
      styles: T.estilosDeTexto
        .filter((e) => e.familia === family)
        .map((e) => ({
          name: e.nome,
          fontSize: e.tamanho,
          lineHeight: e.alturaDeLinha,
          fontWeight: e.peso,
          ...(e.espacamento ? { letterSpacing: e.espacamento } : {}),
          ...(e.tamanhoOptico ? { opticalSize: e.tamanhoOptico } : {}),
          sample: e.amostra,
          usage: e.uso,
        })),
    })),
  },
  spacing: { tokens: T.espacos.map((t) => ({ name: t.nome, value: t.valor, usage: t.uso })) },
  radius: { tokens: T.raios.map((t) => ({ name: t.nome, value: t.valor, usage: t.uso })) },
  shadow: { note: "Três degraus de camada e uma sombra de papel. Sem brilho, sem sombra colorida.", tokens: T.sombras.map((t) => ({ name: t.nome, value: { light: t.claro, dark: t.escuro }, usage: t.uso })) },
  layout: { note: "Medidas fixas da estrutura do app.", tokens: T.layout.map((t) => ({ name: t.nome, value: t.valor, usage: t.uso })) },
}
escrever("tokens.json", JSON.stringify(tokensJson, null, 2) + "\n")
for (const f of T.arquivosDeFonte) {
  mkdirSync(join(PROJETO, "fonts"), { recursive: true })
  copyFileSync(join(RAIZ, "src", f.arquivo), join(PROJETO, f.arquivo))
}

// 3. bundle.js: a lib inteira como script clássico em window.DesignStudio,
//    lendo React e ReactDOM globais (a página carrega React 18).
const globaisReact = {
  name: "globais-react",
  setup(b) {
    b.onResolve({ filter: /^react(-dom(\/client)?)?$|^react\/jsx-runtime$/ }, (a) => ({ path: a.path, namespace: "global" }))
    b.onLoad({ filter: /.*/, namespace: "global" }, (a) => {
      if (a.path === "react/jsx-runtime")
        return {
          loader: "js",
          contents: `var R = window.React
function props(p, k) { var o = {}; for (var x in p) if (x !== "children") o[x] = p[x]; if (k !== undefined) o.key = k; return o }
function jsx(t, p, k) { return p.children === undefined ? R.createElement(t, props(p, k)) : R.createElement(t, props(p, k), p.children) }
function jsxs(t, p, k) { return R.createElement.apply(null, [t, props(p, k)].concat(p.children)) }
module.exports = { jsx: jsx, jsxs: jsxs, Fragment: R.Fragment }`,
        }
      return { loader: "js", contents: `module.exports = window.${a.path === "react" ? "React" : "ReactDOM"}` }
    })
  },
}
const bundle = await esbuild.build({
  entryPoints: [join(RAIZ, "src/index.ts")],
  bundle: true,
  format: "iife",
  globalName: NS,
  platform: "browser",
  jsx: "automatic",
  minify: true,
  write: false,
  loader: { ".css": "empty", ".woff2": "empty" },
  plugins: [globaisReact],
  logLevel: "warning",
})
let js = bundle.outputFiles[0].text
if (/<\/script|<!--/i.test(js)) throw new Error("bundle.js contém </script ou <!--")
const cabecalho = { format: 4, namespace: NS, components: pastas.map((name) => ({ name })) }
escrever("components/bundle.js", `/* @ds-bundle: ${JSON.stringify(cabecalho)} */\n${js}`)

// 4. bundle.css: base + componentes, sem tokens nem fontes (a página gera os
//    dela a partir do tokens.json). Liga os nomes de fonte do app aos da página.
const ordemCss = ["reset.css", ...pastas.map((p) => `components/${p}/${p}.css`)]
const css = await esbuild.build({
  stdin: { contents: ordemCss.map((f) => `@import "./src/${f}";`).join("\n"), resolveDir: RAIZ, loader: "css" },
  bundle: true,
  write: false,
  outfile: join(TMP, "bundle.css"),
  logLevel: "warning",
})
const ponte = `/* Design Studio: base e componentes. Tokens e fontes vêm do tokens.css da página. */\n:root { --f-ui: var(--font-ui); --f-titulo: var(--font-titulo); --ease: cubic-bezier(0.16, 1, 0.3, 1); }\n`
const cssTexto = ponte + css.outputFiles[0].text
if (/<\/style/i.test(cssTexto)) throw new Error("bundle.css contém </style")
escrever("components/bundle.css", cssTexto)

// 5. index.d.ts: os tipos da lib num arquivo só (documentação das props).
execSync(`npx dts-bundle-generator --silent --no-check --project tsconfig.build.json -o ${JSON.stringify(join(PROJETO, "components/index.d.ts"))} src/index.ts`, { cwd: RAIZ, stdio: "inherit" })

// 6. Prévias: a história Vitrine de cada componente, montada com os
//    componentes reais de window.DesignStudio.
const daLib = (caminho) => {
  const r = relative(join(RAIZ, "src"), caminho)
  return !r.startsWith("..") && !r.startsWith("stories") && !/\.stories\.tsx$/.test(r)
}
const libGlobal = {
  name: "lib-global",
  setup(b) {
    b.onResolve({ filter: /^\.\.?\// }, async (a) => {
      if (a.namespace !== "file" || a.path.endsWith("?raw")) return undefined
      const r = await b.resolve(a.path, { resolveDir: a.resolveDir, kind: a.kind, pluginData: { pular: true } })
      if (a.pluginData?.pular || r.errors.length) return undefined
      if (/\.tsx?$/.test(r.path) && daLib(r.path) && !daLib(a.importer)) return { path: "lib", namespace: "global-lib" }
      return undefined
    })
    b.onLoad({ filter: /.*/, namespace: "global-lib" }, () => ({ loader: "js", contents: `module.exports = window.${NS}` }))
  },
}
const semRaw = {
  name: "sem-raw",
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, () => ({ path: "raw", namespace: "vazio" }))
    b.onLoad({ filter: /.*/, namespace: "vazio" }, () => ({ loader: "js", contents: `module.exports = ""` }))
  },
}
const leiaCodigo = (pasta) => {
  const fonte = readFileSync(join(RAIZ, "src/components", pasta, `${pasta}.tsx`), "utf8")
  return [...fonte.matchAll(/^export (?:const|function) ([A-Z]\w*)/gm)].map((m) => m[1])
}
for (const pasta of pastas) {
  const meta = sonda.historias[pasta].default
  const cd = meta.parameters?.claudeDesign ?? {}
  const grupo = meta.title.split("/")[0]
  const entrada = `import * as H from ${JSON.stringify(join(RAIZ, "src/components", pasta, `${pasta}.stories.tsx`))}
import React from "react"
import { createRoot } from "react-dom/client"
const meta = H.default, v = H.Vitrine
const args = Object.assign({}, meta.args || {}, v.args || {})
const contexto = { args: args, globals: { theme: document.documentElement.getAttribute("data-theme") || "light" } }
let el = v.render ? v.render(args, contexto) : React.createElement(meta.component, args)
for (const d of [].concat(v.decorators || [], meta.decorators || [])) { const dentro = el; el = d(function () { return dentro }, contexto) }
createRoot(document.getElementById("root")).render(el)
`
  const saida = await esbuild.build({
    stdin: { contents: entrada, resolveDir: RAIZ, loader: "tsx" },
    bundle: true,
    format: "iife",
    platform: "browser",
    jsx: "automatic",
    minify: true,
    write: false,
    loader: { ".css": "empty", ".woff2": "empty" },
    plugins: [semRaw, globaisReact, libGlobal],
    logLevel: "warning",
  })
  const script = saida.outputFiles[0].text
  if (/<\/script/i.test(script)) throw new Error(`prévia de ${pasta} contém </script`)
  const marcador = `<!-- @dsCard group="${grupo}" height=${cd.altura ?? 160}${cd.largura ? ` width=${cd.largura}` : ""} -->`
  const tela = meta.parameters?.layout === "fullscreen" ? "padding: 0;" : "padding: 20px;"
  escrever(
    `components/${pasta}/preview.html`,
    `${marcador}
<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${pasta}</title>
<style>body { margin: 0; ${tela} background: var(--quadro); } #root { --z: 1; }</style>
</head>
<body>
<div id="root"></div>
<script>${script}</script>
</body>
</html>
`
  )
  const exportados = leiaCodigo(pasta)
  const leia = readFileSync(join(RAIZ, "src/components", pasta, "README.md"), "utf8").trimEnd()
  escrever(
    `components/${pasta}/README.md`,
    `${leia}\n\n## Código\nExporta ${exportados.map((n) => `\`${n}\``).join(", ")}. Numa página da Claude Design: \`const { ${exportados.join(", ")} } = window.${NS}\` (React 18 na página). No código: \`import { ${exportados.join(", ")} } from "@design-studio/design-system"\`. As props estão em \`components/index.d.ts\`.\n`
  )
}

// 7. Capa e o manual da marca.
escrever("components/Cover/preview.html", readFileSync(join(RAIZ, "scripts/claude-design/capa.html"), "utf8"))
escrever("README.md", readFileSync(join(RAIZ, "docs/marca.md"), "utf8"))

// 8. Assets: SVG gerados das fontes de dados da lib + os do iu-memorable.
const TINTA = T.cores.find((c) => c.nome === "tinta")
const acento = T.cores.find((c) => c.nome === "acento")
const sobre = T.cores.find((c) => c.nome === "sobre-acento")
const assets = {}
for (const [nome, corpo] of Object.entries(sonda.icones)) {
  const fill = nome === "mais3" ? TINTA.claro : "none"
  assets[`Icones/${nome}.svg`] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="${fill}" stroke="${TINTA.claro}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${corpo}</svg>\n`
}
const sinal = (a, s) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><rect x="2" y="2" width="28" height="28" rx="9" fill="${a}"/><path d="M10 21.5h7.5a5.5 5.5 0 0 0 0-11H10z" fill="none" stroke="${s}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="22.6" cy="21.4" r="2.1" fill="${s}"/></svg>\n`
assets["Marca/sinal.svg"] = sinal(acento.claro, sobre.claro)
assets["Marca/sinal-escuro.svg"] = sinal(acento.escuro, sobre.escuro)
const logo = (m, cor) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${m.viewBox}" width="48" height="48"><path d="${m.caminho}" fill="${cor}"/></svg>\n`
assets["Agentes/claude.svg"] = logo(sonda.marcasDosAgentes.claude, sonda.marcasDosAgentes.claude.cor)
assets["Agentes/devin.svg"] = logo(sonda.marcasDosAgentes.devin, TINTA.claro)
assets["Agentes/devin-claro.svg"] = logo(sonda.marcasDosAgentes.devin, TINTA.escuro)
for (const f of readdirSync(join(RAIZ, "assets/iu-memorable"))) if (!f.endsWith(".md")) assets[`iu-memorable/${f}`] = readFileSync(join(RAIZ, "assets/iu-memorable", f))
for (const [rel, conteudo] of Object.entries(assets)) escrever(`assets/${rel}`, conteudo)
for (const g of readdirSync(join(RAIZ, "assets"))) if (existsSync(join(RAIZ, "assets", g, "README.md"))) escrever(`assets/${g}/README.md`, readFileSync(join(RAIZ, "assets", g, "README.md")))

const blobs = existsSync(BLOBS) ? JSON.parse(readFileSync(BLOBS, "utf8")) : {}
const tipo = (f) => (f.endsWith(".png") ? "image/png" : "image/svg+xml")
const pendentes = []
const registros = {}
for (const rel of Object.keys(assets)) {
  const s = sha(readFileSync(join(PROJETO, "assets", rel)))
  const b = blobs[`assets/${rel}`]
  if (b && b.sha256 === s) registros[rel] = b
  else pendentes.push(join(PROJETO, "assets", rel))
}
writeFileSync(join(SAIDA, "uploads.json"), JSON.stringify(pendentes, null, 2))

// 9. O índice, por último, mantendo o que a página já guarda.
if (pendentes.length) {
  console.log(`${pendentes.length} assets para enviar (ver .design-sync/saida/uploads.json); índice não gerado.`)
} else {
  const atual = existsSync(INDICE_ATUAL) ? JSON.parse(readFileSync(INDICE_ATUAL, "utf8")) : {}
  const ordem = { Marca: ["sinal.svg", "sinal-escuro.svg"], Agentes: ["claude.svg", "devin.svg", "devin-claro.svg"], "iu-memorable": ["lockup.png", "lockup-escuro.png", "lockup-vertical.png", "lockup-vertical-escuro.png", "simbolo.svg", "simbolo-escuro.svg", "simbolo-16.svg", "simbolo-16-escuro.svg"] }
  const tiles = { Marca: "l", "iu-memorable": "l", Agentes: "m", Icones: "xs" }
  const grupos = ["Marca", "iu-memorable", "Agentes", "Icones"]
  const assetGroups = {}
  for (const g of grupos) {
    const arquivos = Object.keys(registros).filter((r) => r.startsWith(`${g}/`)).map((r) => r.slice(g.length + 1))
    assetGroups[g] = {
      name: g,
      tile: tiles[g],
      order: ordem[g] ?? arquivos.sort((a, b) => a.localeCompare(b)),
      files: Object.fromEntries(arquivos.map((n) => [n, { name: n, blob: registros[`${g}/${n}`].blob, size: registros[`${g}/${n}`].size, type: tipo(n) }])),
    }
  }
  const indice = {
    ...atual,
    v: 3,
    layout: "files",
    createdOnFiles: atual.createdOnFiles ?? { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, "Z") },
    title: "Design Studio",
    namespace: NS,
    libraries: [
      { name: "react", version: "18" },
      { name: "react-dom", version: "18" },
    ],
    sections: atual.sections ?? {},
    groups: grupos,
    assetGroups,
    blobs: atual.blobs ?? {},
    docs: atual.docs ?? { readme: "project/README.md", sections: [] },
    lastChange: {
      by: "Gustavo Bruno",
      at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
      via: "Claude Code",
      note: `Lib TypeScript (React 18): ${pastas.length} componentes com prévia ao vivo em window.${NS}, tipos e tokens gerados de src/tokens/tokens.ts.`,
    },
  }
  escrever("design-system.json", JSON.stringify(indice, null, 2) + "\n")
  console.log("Índice gerado.")
}

const arquivos = []
const andar = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) andar(p)
    else arquivos.push(relative(SAIDA, p))
  }
}
andar(PROJETO)
writeFileSync(join(SAIDA, "arquivos.json"), JSON.stringify(arquivos.filter((a) => !/\.(svg|png)$/.test(a) && a !== "project/design-system.json"), null, 2))
console.log(`${pastas.length} componentes, ${Object.keys(assets).length} assets, ${arquivos.length} arquivos em .design-sync/saida/project`)
