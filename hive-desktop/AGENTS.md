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
  qualquer tarefa como pronta.**
- `npm run test -- <arquivo>` — roda um teste só (Vitest).
  `npm run test:coverage` aplica o gate de cobertura **per-file 90%** nos
  arquivos que a feature toca (não global).
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
  na UI ou em `AgentService` — modelos/efforts vêm de `capabilities()`.
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

## Fronteiras

- Não edite `out/`, `dist/`, `coverage/`, `node_modules/` (gerados).
- Não commite segredos nem chaves de API.
- O diretório de trabalho é `hive-desktop/`; o **git root é o monorepo pai**
  (`hive/`). `bmad-method install` não respeita `--directory` para tudo —
  `cd` no alvo antes de rodá-lo (ver STATE.md, lições).

## Onde está o resto

- `.specs/project/PROJECT.md` — visão, goals e não-goals.
- `.specs/project/ROADMAP.md` — marcos.
- `.specs/project/STATE.md` — memória viva (decisões + lições) — **leia antes de começar**.
- `.specs/features/` — specs por feature (requisitos, design, tasks).
