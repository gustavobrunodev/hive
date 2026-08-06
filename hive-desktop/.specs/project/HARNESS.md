# Harness — Hive Desktop

O que **guia** o agente, o que o **mede**, e o que deliberadamente **não
existe**. Produzido pelo `harness-builder` em 2026-07-27.

**Memória viva, não arquivo morto.** Descreve o harness como ele está *agora*.
Atualize aqui mesmo, sem esperar uma nova avaliação, quando:

- você pedir ("o agente insiste em X", "põe/tira esse check");
- um controle for adicionado, removido, reajustado ou mudar de stage — **inclusive
  como efeito colateral de trabalho normal de feature**;
- uma falha reincidir pela segunda vez;
- um sensor passar a disparar ruído que ninguém trata;
- um guia e um sensor começarem a se contradizer;
- algo escrito aqui se provar falso.

Uma mudança que altera o que guia ou mede o agente e deixa §2/§5b intactos é
trabalho pela metade. §5b acumula como log datado; §7 guarda os controles
recusados com o motivo — nenhum dos dois é podado em silêncio, porque são as
recusas que impedem a próxima rodada de re-propor o que já foi decidido.

## 1. Contexto

- **Projeto / escopo:** `hive-desktop/` — app Electron + React + TS que dá
  superfície visual ao BMAD. Subprojeto de um monorepo cujo **git root é `hive/`**.
- **Stack & harnessability:** TypeScript `strict` nos dois projetos (node + web),
  fronteiras de módulo **explícitas e impostas pelo runtime** (main / preload /
  renderer via IPC), React 18, Vitest + Playwright. Greenfield, ~13 meses de
  histórico denso. → Harnessability **alta**: o type checker já vem de graça, as
  fronteiras Electron são das mais checáveis que existem, e o repo já demonstrou
  saber escrever sensores próprios (`noInlineStrings.test.ts`).
- **Dor que motivou:** pedido genérico de melhoria; a evidência real veio do
  `STATE.md` (1411 linhas de lições), que registra as falhas recorrentes citadas
  em §4 — cada achado abaixo aponta para uma delas.
- **Categorias em escopo:** manutenibilidade (principal), architecture fitness
  (fronteiras + a11y), comportamento (limitado — ver §7).
- **Agentes-alvo:** Claude Code (primário, via `.claude/skills/`), Cursor,
  Windsurf, Copilot (há `.cursor/`, `.windsurf/`, `.github/agents/` no monorepo).

## 2. O que guia e o que mede o agente

| Controle | Direção | Execução | Categoria | Stage | Gate? | Acionável p/ LLM | O que realmente impõe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tsc --noEmit` (node + web) | feedback | comput. | manut. | in-session | sim | sim | `strict: true` nos **dois** projetos |
| ESLint 9 flat + bloco anti-sprawl | feedback | comput. | manut. | in-session | sim (errors) | parcial | `no-explicit-any` **error**, `complexity: 15` **error**, `max-lines-per-function: 150` **warn**, react-hooks/react-refresh |
| Prettier | feedforward | comput. | manut. | manual | não | n/a | estilo — **ignore list não cobre `.claude/`, `.specs/`, `.scratch/`** |
| Vitest (123 arquivos, ~1805 testes) | feedback | comput. | comportamento | in-session | sim | sim | regressão; `*.e2e.test.ts` excluídos do suite rápido |
| Coverage v8 per-file 90% | feedback | comput. | manut. | in-session | **só em `test:coverage`** | sim | ~37 globs **curados à mão** (≈200 linhas de config) |
| `noInlineStrings.test.ts` | feedback | comput. | arch. fitness | in-session | sim | sim | zero literais de UI fora do `t()` — **o padrão de sensor caseiro a replicar** |
| Playwright E2E (7 specs, Electron real) | feedback | comput. | comportamento | manual | não | sim | fluxos reais contra disco/git de verdade |
| `AGENTS.md` | feedforward | inferencial | cross | in-session | — | — | ambiente/Node, comandos, 4 convenções, fronteiras |
| `.specs/` + skill `tlc-spec-driven` | feedforward | inferencial | cross | in-session | — | — | SDD: PROJECT/ROADMAP/STATE + spec/design/tasks por feature |
| `.claude/skills/` (tlc-spec-driven, impeccable, harness-builder) | feedforward | inferencial | cross | in-session | — | — | playbooks de planejamento, UI e harness |

## 2b. Piso de higiene

| ID | Controle | Status | Evidência / correção |
| --- | --- | --- | --- |
| **CI-04** | Tooling de pre-commit instalado | ✗ | Nenhum husky/lefthook/`core.hooksPath`; `.git/hooks` só com samples. Complicador real: o git root é o **monorepo**, então o hook vale para todos os subprojetos — precisa ser escopado por path. |
| **HYG-02** | `.gitignore` cobre `.env` e `.env.*` | ✗ | `hive-desktop/.gitignore` não tem nenhum padrão `.env`; o monorepo **não tem `.gitignore` nenhum**. Hoje não existe arquivo `.env` no repo → é prevenção barata, não vazamento ativo. |
| **HYG-08** | Credenciais MCP via `${ENV_VAR}` | n/a | Não há `.mcp.json` versionado (o Playwright MCP é usado, mas configurado fora do repo). Nada a corrigir; passa a valer no dia em que um MCP for versionado. |

## 3. Mapa de cobertura

**Direção × execução** — o loop está equilibrado?

| | Computacional | Inferencial |
| --- | --- | --- |
| **Feedforward** | Prettier (inerte) | AGENTS.md, `.specs/`, skills |
| **Feedback** | tsc, ESLint, Vitest, coverage, `noInlineStrings`, Playwright | — (nenhum review inferencial no fluxo) |

Equilibrado no eixo direção. O buraco está no **outro** eixo:

**Categoria × stage** — a cobertura está distribuída no ciclo de vida?

| Categoria \ Stage | In-session | Pre-commit | CI | Contínuo | Runtime |
| --- | --- | --- | --- | --- | --- |
| Manutenibilidade | tsc, ESLint, coverage | — | — | — | — |
| Arquitetura | `noInlineStrings` | — | — | — | — |
| Comportamento | Vitest (E2E manual) | — | — | — | — |
| Segurança | — | — | — | — | — |

**Uma coluna só.** Todo o harness depende de alguém (agente ou humano) lembrar de
rodar `npm run verify`. Não existe nenhuma execução em infra limpa.

## 4. Achados

- **[Higiene] HYG-02** — nenhum padrão `.env` no `.gitignore` do subprojeto nem no
  monorepo. Custo da correção: uma linha.
- **[Higiene] CI-04** — sem pre-commit. O loop de feedback mais à esquerda não existe.
- **[Conflito] O guia empurra o agente para dentro da falha — `npm run format`.**
  `AGENTS.md` diz *"`npm run format` cuida de estilo — não formate à mão"*, e o
  script é `prettier --write .` com um `.prettierignore` que **não** cobre
  `.claude/`, `.specs/` nem `.scratch/`. Resultado registrado no STATE.md
  (2026-07-27): reescreveu **200 arquivos fora da mudança**. É a terceira
  ocorrência da mesma classe ("ferramenta repo-wide não respeita a unidade de
  trabalho" — junto com `git add -u` varrendo 1075 deleções para dentro de um
  commit de feature, e o dirty-tree do `scripts/release.mjs`). Classe recorrente,
  sem sensor e com guia apontando na direção errada.
- **[Conflito] Piso do Node divergente.** `package.json` declara
  `engines.node: ">=20.19.0"`; `.nvmrc` e o `AGENTS.md` dizem que 22.22.1 é piso
  **rígido** (abaixo disso o BMAD e o Vitest quebram com
  `node:util does not provide an export named 'styleText'`). O contrato
  machine-readable contradiz o guia — e é o contrato que um instalador lê.
- **[Timing] Harness inteiro em uma stage só.** Sem `.github/workflows/`. Nenhum
  sensor roda em infra limpa nem bloqueia integração. Evidência de que isso já
  custou: o STATE.md registra que **4 specs E2E estavam quebradas há tempo
  indeterminado** e só foram descobertas (e confirmadas como pré-existentes)
  durante uma investigação ad-hoc no M12.
- **[Falsa segurança] "verify green" não inclui o gate de cobertura — e o gate
  está vermelho.** `verify = typecheck && lint && test` — `test`, não
  `test:coverage`. Rodando o gate pela primeira vez (2026-07-27) ele reprova em
  **14 pontos**, todos herdados e nenhum conhecido:

  | Arquivo | Métricas abaixo de 90% |
  | --- | --- |
  | `explorer/viewers/ImageViewer.tsx` | branches 79.06 · statements 85.84 · lines 85.84 |
  | `explorer/viewers/PdfViewer.tsx` | branches 79.66 · functions 81.81 |
  | `explorer/Explorer.tsx` | functions 82.95 · branches 89.56 |
  | `explorer/viewers/SlidesViewer.tsx` | functions 83.33 |
  | `explorer/viewers/docViewerShared.tsx` | functions 83.33 |
  | `explorer/viewers/DocxViewer.tsx` | branches 85.71 |
  | `explorer/viewers/SheetViewer.tsx` | branches 85.71 |
  | `WorkUI.tsx` | functions 85.96 |
  | `preload/index.ts` | functions 88.99 |
  | `chat/Chat.tsx` | branches 88.98 |

  "1570 testes, verify verde" lia como completo e não era. O CI reporta esses
  números sem bloquear até que estejam limpos — um gate permanentemente vermelho
  ensina todo mundo a ignorá-lo.
- **[Desequilíbrio] A regressão visual/a11y é a falha mais recorrente e é a única
  sem nenhum sensor.** STATE.md, M12.1: *"quatro defeitos que os testes não
  poderiam ter pego, todos achados olhando o app rodando (a lição do M12 se
  repetindo, então vale institucionalizar o passe visual em vez de tratá-lo como
  formalidade)"* — incluindo **contraste 3.93:1 e 3.46:1 no tema claro**, ambos
  abaixo do piso de 4.5:1. A receita para fazer esse passe existe, mas está
  re-derivada dentro de `.specs/features/*/tasks.md` de cada feature, não como guia
  reutilizável; o `AGENTS.md` não a menciona.
- **[Desequilíbrio] "Desacople o agente" é prosa sem sensor.** O `AGENTS.md`
  proíbe hardcodar specifics do Claude fora do `AgentAdapter` e o Electron dá a
  fronteira main/preload/renderer de bandeja — mas nada verifica. Compare com
  i18n, que tem a mesma força de convenção **e** um guard test: essa é a assimetria.
- **[Manutenção] A lista de thresholds de cobertura é curada à mão.** ~35 globs e
  ~200 linhas de comentário no `vitest.config.ts`; toda feature precisa lembrar de
  se acrescentar (o próprio arquivo registra um "T10 regression pass: T1 missed
  these two"). Ainda não é falha, mas é dívida de harness com trajetória conhecida.

## 5. Recomendações priorizadas

### P1 — Fechar os conflitos e a higiene (minutos, risco zero)
- **O quê:** (a) `.prettierignore` ganha `.claude/`, `.specs/`, `.scratch/`,
  `coverage`, `test-results`; (b) `.gitignore` ganha `.env` e `.env.*` com
  `!.env.example`; (c) `engines.node` → `">=22.22.1"`.
- **Por quê:** fecha [Conflito] format, [Conflito] Node, [Higiene] HYG-02. O (a)
  converte uma lição repetida três vezes em impossibilidade computacional.
- **Tipo:** guide · computacional · **Categoria:** manutenibilidade
- **Stage:** in-session · report (o (c) vira gate no `npm install`)
- **Esforço:** S

### P2 — CI no GitHub Actions (a coluna que falta)
- **O quê:** `.github/workflows/hive-desktop.yml` — em push/PR que toquem
  `hive-desktop/**`: Node 22.22.1 via `.nvmrc`, `npm ci`, `npm run verify`,
  `npm run test:coverage` (fecha a falsa segurança), e um job separado de E2E com
  `xvfb-run` (`continue-on-error` no começo, dado que 4 specs já estão vermelhas —
  vira gate quando limparem).
- **Por quê:** fecha [Timing]. Hoje nada roda em infra limpa; a prova de que isso
  custa está no episódio dos 4 specs quebrados sem ninguém saber.
- **Tipo:** sensor · computacional · **Categoria:** todas
- **Stage:** CI · gate (E2E como report até estabilizar)
- **Esforço:** M

### P3 — Institucionalizar o passe visual/a11y
- **O quê:** extrair a receita hoje espalhada pelos `tasks.md` para
  `docs/visual-validation.md` (boot do renderer buildado + mock de `window.hive` +
  `hive.tourSeen` + pinar tema), referenciada em uma linha do `AGENTS.md`; e um
  **probe de contraste** que amostra pixels reais (o STATE.md já registra que
  parsear `getComputedStyle().color` mente com `color-mix()`) e falha abaixo de
  4.5:1, rodável nos dois temas.
- **Por quê:** fecha o [Desequilíbrio] mais caro — a única classe de falha que
  reincidiu em milestones consecutivos, com o próprio STATE.md pedindo
  institucionalização. Converte parte dela de inferencial (olho humano) para
  computacional (contraste é objetivo).
- **Tipo:** guide + sensor · inferencial → computacional · **Categoria:** arch. fitness
- **Stage:** in-session · report (gate quando estiver estável)
- **Esforço:** M (guia S, probe M)

### P4 — Guard test de fronteira, no molde do `noInlineStrings`
- **O quê:** um teste que falha se `src/renderer/**` importar de `src/main/**` (e
  vice-versa) fora do contrato do preload, e se algo fora de `agentAdapter.ts`
  citar specifics do Claude. Mensagem de auto-correção embutida no `expect`,
  apontando o caminho certo — como o `noInlineStrings` já faz.
- **Por quê:** fecha o [Desequilíbrio] de "desacople o agente"; usa uma
  harnessability que o projeto já tem e um padrão que ele já domina.
- **Tipo:** sensor · computacional · **Categoria:** arquitetura
- **Stage:** in-session (entra no `verify` de graça) · gate
- **Esforço:** S

### P5 — Pre-commit escopado (CI-04)
- **O quê:** husky + lint-staged **no git root** (`hive/`), com a regra filtrando
  `hive-desktop/**` e rodando `prettier --write` + `eslint --fix` só nos arquivos
  staged.
- **Por quê:** fecha CI-04 e mata a classe "ferramenta repo-wide" de vez —
  lint-staged opera por definição sobre a unidade de trabalho.
- **Tipo:** sensor · computacional · **Categoria:** manutenibilidade
- **Stage:** pre-commit · gate
- **Esforço:** M (mexe no monorepo, fora do `hive-desktop/`)

Os itens considerados e **não** construídos estão em §7, com o motivo e o gatilho
de reavaliação — não são "backlog", são decisões.

## 5b. Change log

### 2026-07-27 — primeira passada (modo Full)

| # | Mudança | Onde |
| --- | --- | --- |
| P1 | `.prettierignore` cobre `.claude/`, `.specs/`, `.scratch/`, `coverage`, `test-results`, `playwright-report` | `hive-desktop/.prettierignore` |
| P1 | `.env` / `.env.*` ignorados, com `!.env.example` — no subprojeto **e** no monorepo | `hive-desktop/.gitignore`, `.gitignore` |
| P1 | `engines.node` alinhado ao piso real (`>=22.22.1`) | `hive-desktop/package.json` |
| P2 | CI: `verify` como gate; cobertura e E2E como relatório enquanto herdam vermelho | `.github/workflows/hive-desktop.yml` |
| P3 | Receita do passe visual extraída da memória do agente para o repo | `hive-desktop/docs/visual-validation.md` |
| P3 | Probe de contraste WCAG, com o bug do `color(srgb …)` fixado em teste | `src/renderer/src/ui/contrast.ts` + `.test.ts` |
| P4 | Guard test de fronteira main/preload/renderer, com correção na mensagem | `src/main/moduleBoundaries.test.ts` |
| P5 | Pre-commit escopado a `hive-desktop/**` via `core.hooksPath`, auto-ativado no `npm install` | `.githooks/pre-commit`, `hive-desktop/scripts/setupHooks.mjs` |

**Não implementado, com motivo:** a metade "specifics do Claude" do P4. A regra
do `AGENTS.md` está **sendo cumprida** — o renderer tem zero ids de modelo
hardcoded (a única ocorrência, `'claude-cli'` em `agentVisuals.ts`, é id de
agente, não de modelo). Sem falha observada, um guard aqui precisaria de uma
allowlist de 28 arquivos que citam "claude" legitimamente (`.claude/skills/`,
registry de agentes, ícones) — custo de ruído sem sinal. Fica para o dia em que
a regra for de fato violada.

**Verificação:** `npm run verify` verde — 109 arquivos, **1589** testes (de 1570;
os 19 novos são 8 do guard de fronteira + 11 do probe). O hook foi provado com um
commit real: o git o chamou, o lint-staged formatou, e o conteúdo **commitado**
saiu formatado — depois desfeito com `reset --mixed`. O CI ainda não rodou de
verdade; o YAML parseia e os comandos passam local, mas as libs do Electron no
runner e o `xvfb-run` só se provam no primeiro push.

**Estado depois da mudança** — a linha que faltava no mapa categoria × stage:

| Categoria \ Stage | In-session | Pre-commit | CI | Contínuo | Runtime |
| --- | --- | --- | --- | --- | --- |
| Manutenibilidade | tsc, ESLint, coverage | ESLint --fix, Prettier | verify + coverage (report) | — | — |
| Arquitetura | `noInlineStrings`, `moduleBoundaries` (+ fronteira `dictation/`↛`chat/`), `contrast` (+ transporte de ditado, 3 temas), `reducedMotion` (+ sem animar layout) | — | verify | — | — |
| Comportamento | Vitest | — | verify + E2E (report) | — | — |
| Segurança | — | — | — | — | — |

Segurança segue vazia **de propósito** — ver §7.

### 2026-08-05 — voice-prompt (M13): três sensores novos

Nenhuma ferramenta nova; três regras que antes eram **comentário** viraram
teste. Cada uma nasceu de um defeito real desta feature ou de um que ela
tornaria fácil de introduzir.

| # | Sensor | Onde | Por que |
| --- | --- | --- | --- |
| — | Nenhum módulo de `dictation/` importa de `chat/` | `src/main/moduleBoundaries.test.ts` | VP-R5.1. Reusabilidade decidida depois é refatoração; o `DictationTarget` existe justamente pra o compositor ser **um** chamador e não o dono. Um import de `chat/` lá dentro é a regressão que transformaria "ligar o próximo campo" em reescrita. |
| — | O bloco de ditado não anima nenhuma propriedade de layout (`findLayoutTransitions`) | `src/renderer/src/assets/reducedMotion.test.ts` | VP-R6.1 era uma promessa em comentário, sem nada checando. Pega `width/height/inset/margin/padding/font-size/line-height/gap` — e `all`, que é a mesma promessa sem a evidência. Verificado que morde: uma `transition: width` no medidor derruba o teste. |
| — | Sweep de contraste **com o transporte aberto**, nos três temas | `e2e/contrast.spec.ts` | O sweep que já existia só via a work UI ociosa, então nunca viu o transporte — que só existe durante uma tomada. Inclui os três indicadores não-textuais (anel, ponto, barras) no piso próprio de 3:1. |

O passe visual achou **dois** defeitos que nenhum teste pegaria (terceira
milestone seguida — M12, M12.1, M13): o medidor "sem sinal" renderizando como
régua pontilhada, e o seam de E2E cobrindo só dois dos três canais do
`Capture`. O item de contraste acima é a parte disso que dá pra
institucionalizar; o resto continua sendo **olhar**.

## 6. Steering loop

- **Observar:** toda lição do `STATE.md` que comece com "de novo" / "a lição do
  M<n> se repetindo" — é o gatilho canônico deste projeto e funcionou para achar
  tudo em §4.
- **Adicionar quando:** uma falha reincidir pela 2ª vez. Preferir converter a
  lição em controle computacional a escrever mais uma linha de guia.
- **Aposentar quando:** um sensor virar ruído (falha sem ninguém agir) ou um guia
  passar a repetir o que um sensor já impõe.
- **Manter em sincronia:** `AGENTS.md` é a única fonte de convenção; se um sensor
  novo cobre uma linha dele, a linha encolhe para um ponteiro. Nenhum guia deve
  descrever o que o linter já sabe dizer.
- **Re-medir:** rodar de novo
  `python3 skills/harness-builder/references/harness-engineer/scripts/harness_inventory.py hive-desktop`
  — mas **conferir à mão**. O script tem quatro falsos negativos conhecidos
  neste repo, todos por procurar tooling padrão em vez de comportamento:
  - `strict: true` mora em `tsconfig.node.json`/`tsconfig.web.json` (projetos),
    não em `tsconfig.json` (que é só um arquivo de referências);
  - **CI-04** procura `.husky/`; aqui o hook é `.githooks/pre-commit` via
    `core.hooksPath`, e mora no **git root**, fora do diretório escaneado.
    Verificado com um commit real: o git chama, o lint-staged formata, o
    conteúdo commitado sai formatado;
  - "no module/architecture rules" procura dependency-cruiser/import-linter;
    aqui a regra é `moduleBoundaries.test.ts`, que roda no `verify`;
  - **HYG-08** continua `n/a` de verdade — não há MCP versionado.

## 7. O que deliberadamente não existe

Cada linha é uma decisão, não um backlog. Estão aqui para que a próxima rodada
— humana ou agente — não as re-proponha como ideia nova, e para que dê para
distinguir ausência deliberada de esquecimento.

| Controle | Por que não | Reavaliar quando |
| --- | --- | --- |
| Guard de "specifics do Claude" (metade do P4) | A regra está **sendo cumprida**: zero ids de modelo hardcoded no renderer (a única ocorrência, `'claude-cli'`, é id de agente). Um guard precisaria de allowlist de 28 arquivos que citam "claude" legitimamente — ruído sem sinal. | A regra for de fato violada |
| Mutation testing (Stryker) | O suite é grande e escrito majoritariamente para descrever intenção; hoje mediria uma fraqueza que já conhecemos, caro. | Um teste verde esconder um bug |
| Secret scanning (GitLeaks) | Sem segredos no repo e sem deploy — não há o que vazar. É por isso que a linha "Segurança" do mapa está vazia. | Primeira credencial, ou primeiro deploy |
| Review inferencial no fluxo (célula vazia em Feedback × Inferencial) | Custo por PR real, e as falhas recorrentes deste repo foram todas capturáveis por controle computacional. | Aparecer classe de falha que só semântica pega |
| Automatizar os globs de cobertura (derivar do diff) | Os ~35 globs curados à mão são dívida conhecida, mas o gate já está vermelho em 14 pontos — automatizar a curadoria antes de limpar o vermelho só esconde o problema. | O gate de §5b ficar verde |
| Gate de cobertura e de E2E no CI | Ambos nascem vermelhos (14 arquivos / 4 specs, todos herdados). Um gate permanentemente vermelho ensina todo mundo a ignorá-lo. | Cada um ficar limpo — aí tira o `continue-on-error` |

**Limites honestos** — o que *nenhum* controle daqui cobre:

- **Comportamento continua sendo o elo fraco.** 1589 testes e E2E em Electron
  real dizem que o app não regrediu; não dizem que ele faz a coisa certa. O
  próprio STATE.md registra defeitos "que os testes não poderiam ter pego".
- **Nenhum sensor pega diagnóstico errado, over-engineering ou requisito mal
  entendido.** É exatamente aí que a atenção humana deve ir — o harness existe
  para liberar essa atenção, não para substituí-la.
- **Cobertura mede o que rodou, não o que foi asseverado.** O gate de 90% per-file
  é um piso, não um selo.
- **P3 cobre contraste, não estética.** Hierarquia visual, copy e "duas
  affordances fingindo ser uma" seguem exigindo olho humano.
