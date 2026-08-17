# AGENTS.md — Hive Desktop

App Electron + React + TypeScript que dá uma superfície visual ao **BMAD**
(orquestração de workflows agentic). Decisões, blockers e lições que se repetem
vivem em `.specs/project/STATE.md` — **leia no início de cada sessão**.

## Ambiente — antes de QUALQUER comando

Node é pinado em `22.22.1` (`.nvmrc`) e é um piso **rígido**: BMAD e o Vitest
quebram abaixo disso (`node:util does not provide an export named 'styleText'`).
`nvm use` **não persiste** entre invocações de tool — encadeie no mesmo comando,
sempre:

```bash
source ~/.nvm/nvm.sh && nvm use 22.22.1 && npm run <script>
```

## Comandos

- `npm run verify` — gate único (typecheck + lint + test). **Rode antes de dar
  qualquer tarefa como pronta.** Ele **não** inclui cobertura — o CI roda
  `test:coverage` à parte, hoje como relatório porque o gate está vermelho em 14
  arquivos herdados (lista em `.specs/project/HARNESS.md`). Não aumente a lista.
- `npm run test -- <arquivo>` — roda um teste só (Vitest).
  `npm run test:coverage` aplica o gate de cobertura **per-file 90%** nos
  arquivos que a feature toca (não global) — acrescente o glob do arquivo novo
  em `vitest.config.ts`, senão ele não é medido.
- `npm run dev` — app em modo dev.
- **E2E** (Electron real via Playwright):

  ```bash
  source ~/.nvm/nvm.sh && nvm use 22.22.1 && npm run build && xvfb-run -a npm run test:e2e:app
  ```

  O spec **precisa** stripar `ELECTRON_RUN_AS_NODE` do `env` passado a
  `_electron.launch` (leak do WSL interop) — senão o Electron sobe como Node
  puro e `_electron.launch()` falha com "Process failed to launch!".

`npm run format` / `npm run lint` cuidam de estilo — não formate à mão. O lint
também sinaliza sprawl (`complexity`, `max-lines-per-function`): mantenha as
funções focadas.

## Convenções que o código não revela sozinho

- **Desacople o agente.** Tudo que fala com um CLI de agente passa pelo contrato
  `AgentAdapter` (`src/main/agentAdapter.ts`). Nunca hardcode specifics do Claude
  na UI ou em `AgentService` — modelos/efforts vêm de `capabilities()`, e o
  terminal escolhido vira variável de ambiente em `shellBinding()`, no adapter
  (`CLAUDE_CODE_*` não existe fora dele).
- **Só o turno do agente passa pelo shell escolhido** (`RunOptions.shell`, veja
  `shellCatalog.ts`). `git`, `npx bmad-method` e os probes continuam com spawn
  direto: cada um depende do stdout exato, e um banner de rc quebraria o parser.
- **Processos não se importam.** `main`, `preload` e `renderer` são bundles
  separados; o renderer fala com o main **só** pela bridge `window.hive` e deriva
  tipos dela (`Awaited<ReturnType<Window['hive'][…]>>`). Só o preload pode
  `import type` do main — é o contrato. `moduleBoundaries.test.ts` falha se
  escapar, com o caminho da correção na mensagem.
- **BMAD é source of truth.** Orquestramos o `bmad-method`; não reimplementamos
  workflows. Mudou o BMAD → ajuste o adapter, não o domínio. Integração com
  Claude Code é via **`.claude/skills/`** (Skills, não slash commands).
- **i18n obrigatório.** Toda copy de UI (`src/renderer/src`) vem de `t()`
  (`i18n/pt-BR.ts`) — **zero literais inline** em JSX ou atributos de texto. O
  teste `noInlineStrings.test.ts` falha se escapar; para uma exceção técnica
  pontual, comentário `i18n-exempt` na mesma linha.
- **Design system.** UI usa `@hive/design-system`. Componente DS presentational
  tornado clicável (`role="button"`) não herda `:focus-visible` — adicione a
  regra própria (padrão em `chat/IntentGrid.css`).
- **Identidade do produto vive em dois arquivos que precisam concordar.**
  `electron-builder.yml` (`productName`, `appId`) manda no app empacotado;
  `src/main/appIdentity.ts` manda no `npm run dev`. `appIdentity.test.ts` falha
  se divergirem. Mudar `productName` **move o `userData`** — o Electron o deriva
  de `app.name` — então qualquer novo nome entra em `LEGACY_USER_DATA_NAMES`
  (`userDataMigration.ts`), nunca substitui o anterior.
- **Nada de arte de marca desenhada à mão.** Ícones do app, do instalador e os
  BMP do NSIS saem de `npm run build:brand-artwork`, derivados de
  `design-system/assets/logos/current_logo_mark.svg`. Mexeu no logo ou na
  paleta → roda o script. Os tamanhos pequenos usam **outro desenho** de
  propósito (o cérebro de traços fecha abaixo de 48px): o piso está medido no
  cabeçalho do script, com `--contact-sheet` para reconferir.

## Fronteiras

- Não edite `out/`, `dist/`, `coverage/`, `node_modules/` (gerados).
- Não commite segredos nem chaves de API.
- O diretório de trabalho é `hive-desktop/`; o **git root é o monorepo pai**
  (`hive/`). `bmad-method install` não respeita `--directory` para tudo —
  `cd` no alvo antes de rodá-lo (ver STATE.md, lições).

## Onde está o resto

- `docs/visual-validation.md` — como olhar a UI de verdade (mock de `window.hive`
  - build estático) e medir contraste. **Todo trabalho de UI fecha com esse
    passe** — nos dois temas; é a classe de defeito que mais reincidiu aqui.
- `.specs/project/HARNESS.md` — o que guia e o que mede o agente, e o que
  deliberadamente não existe — **atualize quando mudar um controle**, inclusive
  se a mudança for efeito colateral de outro trabalho.
- `.specs/project/PROJECT.md` — visão, goals e não-goals.
- `.specs/project/ROADMAP.md` — marcos.
- `.specs/project/STATE.md` — memória viva (decisões + lições) — **leia antes de começar**.
- `.specs/features/` — specs por feature (requisitos, design, tasks).
