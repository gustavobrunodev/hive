# Addendum: Design Studio

Conteúdo técnico e de rationale que não pertence a um PRD de capacidades, mas que vale preservar para quem for desenhar a arquitetura. Nada aqui é normativo — é contexto de apoio.

## Comparação de Design Systems open source de web components (para FR-12/FR-13)

Avaliadas três opções como padrão da v1, todas web components de verdade (não React-com-nome-de-DS):

- **Shoelace / Web Awesome** (escolhida) — agnóstica de framework, tema via CSS custom properties, sem identidade visual de marca forte. Isso é o que mais importa aqui: como o Adaptador de Design System (FR-12) vai, no futuro, apontar para o DS interno da empresa, um DS de partida sem "cara" própria forte minimiza o trabalho de reskin e evita que o time se acostume com decisões visuais que não vão sobreviver à troca. Cobertura boa de formulários, overlays (dialog, dropdown, tooltip) e componentes de produto (card, tabs, badge) — o vocabulário que a maioria das Specs de UX de produto vai precisar.
- **Adobe Spectrum Web Components** — tecnicamente maduro e completo, mas carrega a identidade visual da Adobe de forma forte (cor, tipografia, motion). Rejeitada como padrão porque geraria mais trabalho de "descaracterização" do que valeria a pena para um DS que é só ponto de partida.
- **IBM Carbon (`@carbon/web-components`)** — considerada brevemente; mesmo problema de identidade de marca forte (IBM), além de superfície de API mais pesada que o necessário para um DS de validação rápida.

Decisão registrada no memlog desta sessão; não é um requisito funcional do PRD porque é substituível por definição (FR-12).

## Estratégia de isolamento do Preview (para §8 do PRD)

O precedente mais próximo no código é `hive-desktop/src/renderer/src/explorer/HtmlPreview.tsx`: iframe com `sandbox="allow-scripts"` e `srcDoc`, deliberadamente **sem** `allow-same-origin` (origem opaca — sem acesso a `window.parent`, cookies ou filesystem). Isso é a base certa para o Design Studio, mas com uma diferença importante: `HtmlPreview.tsx` renderiza um arquivo estático do workspace do usuário; o Design Studio renderiza conteúdo *gerado e re-gerado repetidamente por um agente de IA* a partir de linguagem natural — uma superfície de ataque mais dinâmica (prompt injection via conteúdo da Spec de UX, por exemplo, poderia tentar induzir a Skill de Design System a gerar markup malicioso).

Duas lacunas conhecidas de `HtmlPreview.tsx` que o Visualizador de Preview do Design Studio não pode herdar sem resolver:
1. **Sem base URL em `srcDoc`** → assets relativos (ex.: ícones do DS, fontes) quebram. O comentário no próprio código já sinaliza "preview com servidor local é um trabalho futuro" — isso deixa de ser opcional aqui, já que o DS escolhido (Shoelace/Web Awesome) carrega assets (ícones SVG, fontes) que precisam resolver corretamente.
2. **CSP `script-src 'self'`** do renderer (confirmado em `PdfViewer.tsx`/`whisperProtocol.ts` — tudo precisa ser same-origin, sem CDN/`blob:`/`eval`) — carregar os web components do DS via CDN está descartado; precisam ser empacotados e servidos same-origin, provavelmente via um protocolo customizado do Electron (mesmo padrão já usado para o worker do PDF.js) ou um servidor local efêmero.

Recomendação para a fase de arquitetura: um preview backed por servidor local (ou protocolo customizado same-origin), não `srcDoc`, resolve os dois problemas de uma vez e é consistente com o que o próprio código já sinaliza como direção.

## Formato provável do Bundle de Exportação (para FR-14/FR-15, Pergunta em Aberto #1)

Sem confirmação do contrato exato do Figma Agent nesta sessão. Hipótese de trabalho, baseada no que se sabe de ferramentas desse tipo (ingerem HTML/DOM real, não código-fonte de componente): um arquivo HTML autocontido por Tela, com:
- CSS inline ou `<style>` embutido (sem folha de estilo externa).
- Web components do DS "abertos" (shadow DOM renderizado ou componentes resolvidos para markup + estilo equivalente, a decidir) — depende de como o Figma Agent lê a árvore DOM; se ele não atravessa shadow DOM, pode ser necessário achatar antes de exportar.
- Assets (ícones, imagens) inline como data URI, para não repetir o problema de asset relativo de `HtmlPreview.tsx`.

Isso é uma hipótese de arquitetura, não um requisito confirmado — precisa validação com uma amostra real do Figma Agent antes de travar o formato.

## Padrão de módulo: sidebar view vs. dialog modal

O Hive Desktop hoje tem dois padrões de registro de módulo:
- **View de sidebar persistente**: Explorer, SCM (Git), Review, Second Brain — trocadas via `SidebarHost.tsx`/`ActionRail.tsx`, um `SidebarView` (`'explorer' | 'scm' | 'review' | 'brain'`) mantido montado por vez.
- **Dialog modal**: MCP, Skill Studio — abrem como overlay a partir do `ActionRail`, fecham para voltar ao estado anterior.

O Design Studio se parece mais com o primeiro grupo: é um espaço de trabalho de sessão longa, multi-painel (Preview + Inspetor + Árvore + Chat), não uma tarefa pontual como configurar um servidor MCP. Also relevante: `mvp-vertical-slice/design.md` já esboça um "artifact pane" ao lado do chat como conceito não construído — o Design Studio pode ser a primeira implementação real desse conceito, o que reforça o padrão de sidebar/view persistente em vez de dialog.
