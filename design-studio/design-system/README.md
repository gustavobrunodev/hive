# Design Studio Design System

Os componentes React do Design Studio, o quadro de oficina onde as Dores dos clientes ficam ao lado das telas. Nomes e props em pt-BR, como o app. O manual da marca (voz, cor, tipo, espaço, movimento, quadro, gráficos) está em [docs/marca.md](docs/marca.md) e abre a Introdução do Storybook.

## Uso

```js
import "@design-studio/design-system/dist/ds-bundle.css"
import { Botao, CampoDoChat, NotaAutoadesiva } from "@design-studio/design-system"
```

O CSS traz tokens, fontes (Geist e Bricolage Grotesque, OFL), base e componentes. Toda classe começa com `dst-`. O tema escuro liga com `data-theme="dark"` no `<html>`; sem atributo vale o claro. Os tokens também saem como dados (`cores`, `raios`, `estilosDeTexto`), junto com `razaoDeContraste`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run storybook` | Storybook em http://localhost:6007, com alternador de tema e o addon de acessibilidade |
| `npm test` | Testes unitários e de integração (Vitest + Testing Library + axe) |
| `npm run test:coverage` | O mesmo, com cobertura mínima de 90% |
| `npm run typecheck` | `tsc` em tudo: componentes, testes, histórias e Storybook |
| `npm run build` | Gera `src/tokens.css` a partir dos tokens, `dist/ds-bundle.{js,css}`, as fontes e os tipos |
| `npm run verify` | typecheck + cobertura + build |
| `npm run sync:claude-design` | Monta em `.design-sync/saida/` o design system da Claude Design (ver abaixo) |

## Estrutura

```
src/
  tokens/tokens.ts      a fonte dos tokens; build.mjs gera src/tokens.css
  tokens/contraste.ts   razão de contraste WCAG; o contrato de pares fica em tokens.ts
  icones/icones.ts      os 67 ícones de traço do app
  marcas/marcas.ts      as logos oficiais de Claude e Devin
  components/<Nome>/    <Nome>.tsx, .css, .test.tsx, .stories.tsx e README.md
  stories/              páginas MDX (Introdução, Tokens, Tipografia) e dados de exemplo
test/integracao/        fluxos de ponta a ponta, todas as histórias com axe, convenções do pacote
scripts/                sincronização com a Claude Design e a capa
assets/                 iu-memorable (PNG e SVG originais) e as notas de cada grupo de assets
```

Cada componente segue as mesmas regras, cobradas por `test/integracao/pacote.test.ts`: os cinco arquivos, um README sem título, uma história `Vitrine` com `parameters.claudeDesign` (altura e largura da prévia), CSS só com classes `dst-` e sem hex solto.

## Testes

- **Unitários**: um arquivo por componente, pelo papel e nome acessível (Testing Library), com teclado e estados.
- **Tokens**: `src/tokens.css` não pode divergir de `tokens.ts`; todo par de contraste prometido passa nos dois temas; as exceções documentadas continuam com o valor medido.
- **Integração**:
  - `historias` renderiza todas as histórias com o preview do Storybook e passa o axe;
  - `campo-do-chat`, `inserir` e `graficos` montam fluxos inteiros só com peças da lib;
  - `pacote` confere as exportações e as convenções.

O jsdom não calcula cor, então o axe roda sem a regra de contraste; o contraste é coberto pelo contrato dos tokens.

## Claude Design

`npm run sync:claude-design` gera em `.design-sync/saida/project/`:
- o `tokens.json`;
- o `bundle.js` (a lib como script clássico em `window.DesignStudio`, lendo React 18 global);
- o `bundle.css`, sem tokens nem fontes, que a página serve;
- o `index.d.ts`;
- uma prévia ao vivo por componente (a história `Vitrine` montada com os componentes do bundle);
- os READMEs, a capa, o manual e os assets.

Os assets (SVG e PNG) sobem como uploads. `.design-sync/blobs.json` guarda o sha256 e o id de cada um já enviado. Um asset novo ou alterado aparece em `.design-sync/saida/uploads.json`, e o índice `design-system.json` só é gerado quando todos têm id. Antes de publicar, leia o índice atual do design system para `.design-sync/referencia/design-system.json`: a sincronização mantém o que a página já guarda (`createdOnFiles`, seções). Publique `.design-sync/saida/` (root) com `project/design-system.json` por último. O `index.d.ts` sobe como `text/plain`, porque `.ts` não é um tipo servido, e cartões que deixaram de existir saem com `null`.

O conteúdo das telas dentro da `MolduraDeAparelho` é o Protótipo do cliente e não usa estes tokens.
