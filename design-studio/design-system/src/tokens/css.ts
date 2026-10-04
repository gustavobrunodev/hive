import { cores, curva, espacos, familias, layout, raios, sombras } from "./tokens"

const linhas = (pares: [string, string][]) => pares.map(([n, v]) => `  --${n}: ${v};`).join("\n")

/**
 * O conteúdo de src/tokens.css. O tema claro fica em :root e o escuro
 * redefine só o que muda, sob :root[data-theme='dark'].
 */
export function gerarTokensCss(): string {
  const claro: [string, string][] = [
    ...cores.map((c): [string, string] => [c.nome, c.claro]),
    ...sombras.map((s): [string, string] => [s.nome, s.claro]),
    ...raios.map((r): [string, string] => [r.nome, r.valor]),
    ...espacos.map((e): [string, string] => [e.nome, e.valor]),
    ...layout.map((l): [string, string] => [l.nome, l.valor]),
    ["f-ui", familias.ui],
    ["f-titulo", familias.titulo],
    ["ease", curva],
  ]
  const escuro: [string, string][] = [
    ...cores.filter((c) => c.escuro).map((c): [string, string] => [c.nome, c.escuro as string]),
    ...sombras.map((s): [string, string] => [s.nome, s.escuro]),
  ]
  return [
    "/* Gerado de src/tokens/tokens.ts por build.mjs. Não edite à mão. */",
    ":root {",
    linhas(claro),
    "  color-scheme: light;",
    "}",
    ":root[data-theme='dark'] {",
    linhas(escuro),
    "  color-scheme: dark;",
    "}",
    "",
  ].join("\n")
}
