---
workflowStatus: 'completed'
totalSteps: 5
stepsCompleted:
  [
    'step-01-detect-mode',
    'step-02-load-context',
    'step-03-risk-and-testability',
    'step-04-coverage-plan',
    'step-05-generate-output'
  ]
lastStep: 'step-05-generate-output'
nextStep: ''
lastSaved: '2026-07-29'
workflowType: 'testarch-test-design'
inputDocuments:
  - '_bmad/tea/config.yaml'
  - 'hive-desktop/.specs/project/{PROJECT,ROADMAP,STATE,HARNESS}.md'
  - 'hive-desktop/.specs/features/*/spec.md (11 features)'
  - 'hive-desktop/PRODUCT.md'
  - 'hive-desktop/AGENTS.md'
  - 'hive-desktop/{package.json,vitest.config.ts,vitest.e2e.config.ts,playwright.config.ts}'
  - '.github/workflows/hive-desktop.yml'
  - 'knowledge/{risk-governance,probability-impact,test-levels-framework,test-priorities-matrix,nfr-criteria,adr-quality-readiness-checklist}.md'
  - 'medição própria: npx vitest run --coverage (2026-07-29), relatório em hive-desktop/coverage/'
---

# Test Design — Progresso

## Step 1 — Detecção de Modo & Pré-requisitos

### Modo selecionado: **System-Level**

**Justificativa (intenção explícita do usuário — prioridade máxima):**
O pedido é "cobertura de testes completa regressiva de **todas as features** do
projeto `./hive-desktop` (unitários, integração, e2e)". O escopo atravessa o
sistema inteiro (11 features / M0–M12.1), não um épico isolado — portanto
System-Level, produzindo os dois documentos (Architecture + QA) e o handoff.

**Detecção por arquivo (confirmatória):**
`_bmad-output/implementation-artifacts/sprint-status.yaml` **não existe** →
regra B do step-01 também aponta para System-Level.

**Nuance registrada:** este é um caso *brownfield / regressivo*. O projeto já
possui suíte de testes substancial (~1570 testes segundo o histórico do
projeto). Portanto o test design não parte do zero: deve inventariar a cobertura
existente, expor lacunas por feature e nível (unit/integração/E2E), e definir o
pacote de regressão. O inventário de cobertura existente será carregado no
Step 2 (embora o step-02 marque essa varredura como epic-level, ela é
indispensável aqui — o objetivo declarado é regressão sobre features já
implementadas).

### Pré-requisitos (System-Level) — atendidos

Este projeto não usa artefatos BMM (`planning-artifacts/`); usa o padrão
`tlc-spec-driven` em `hive-desktop/.specs/`. Equivalências:

| Requisito do step-01 | Artefato equivalente no projeto | Status |
| --- | --- | --- |
| PRD (FR + NFR) | `.specs/project/PROJECT.md` (visão, problema, G1–G5, non-goals) + `spec.md` por feature (requisitos + critérios de aceite) | ✅ |
| ADR / decisões de arquitetura | `.specs/project/STATE.md` (log de decisões persistente, 1411 linhas — D1..D22+) | ✅ |
| Arquitetura / tech-spec | `.specs/project/HARNESS.md` + `design.md` por feature | ✅ |
| Épicos (escopo) | `.specs/project/ROADMAP.md` (M0–M12.1) + `tasks.md` por feature | ✅ |

Nenhuma condição de HALT acionada.

### Observações de configuração

- `_bmad/tea/config.yaml` → `user_name: "{{name}}"` e
  `project_name: "{{project_name}}"` seguem como placeholders não resolvidos do
  installer. Não bloqueia o workflow; nomes serão omitidos ou usados por papel
  nos documentos. Para corrigir de forma durável: reexecutar o installer ou
  fixar em `_bmad/custom/config.user.toml`.
- `communication_language` / `document_output_language`: Brazilian Portuguese.
- O resolver `_bmad/scripts/resolve_customization.py` falhou (exige Python 3.11+;
  o ambiente tem 3.10.12). Bloco `workflow` resolvido manualmente conforme o
  fallback do SKILL.md: sem overrides de team/user, apenas a base
  (`persistent_facts = ["file:{project-root}/**/project-context.md"]` — nenhum
  arquivo correspondente existe; `activation_steps_*` vazios; `on_complete` vazio).

---

## Step 2 — Contexto & Base de Conhecimento

### Config resolvida

| Flag | Valor | Consequência para este design |
| --- | --- | --- |
| `tea_use_playwright_utils` | `true` | **Não aplicado.** `@seontechnologies/playwright-utils` não é dependência do projeto e não há superfície HTTP para `apiRequest`/`auth-session`. Carregar o perfil completo (~4.500 linhas) seria contexto sem sinal. Registrado como decisão, não omissão. |
| `tea_use_pactjs_utils` | `false` | Pact não se aplica: não há serviços HTTP. O análogo real é **contract testing sobre CLIs externos** (ver R-07). |
| `tea_pact_mcp` | `none` | n/a |
| `tea_browser_automation` | `auto` | O projeto já usa `@playwright/test` + `_electron.launch`; `playwright-cli` não instalado. Sem exploração de browser (o alvo é um app Electron, não uma URL). |
| `test_stack_type` | `auto` → **frontend** | Ver nuance abaixo. |
| `risk_threshold` | `p1` | Mitigação obrigatória a partir de score ≥6. |

**Nuance de stack:** pela regra do step-02 o resultado é `frontend`
(`playwright.config.ts` + React, nenhum indicador de backend). Na prática o
processo **main** do Electron é uma superfície Node/servidor (FS, `spawn` de
CLIs, IPC) — funcionalmente *fullstack dentro de um processo*. Isso importa para
a seleção de nível: o que seria "teste de API" aqui é **teste de handler IPC**
(`src/main/index.test.ts` + `src/preload/index.test.ts`), não HTTP.

### Artefatos do projeto carregados

`PROJECT.md`, `ROADMAP.md` (M0–M12.1), `STATE.md` (1411 linhas de decisões e
lições), `HARNESS.md`, `AGENTS.md`, `PRODUCT.md`, os 11 `spec.md`, as três
configs de teste e o workflow de CI.

**Universo de rastreabilidade: 377 IDs de requisito** em 11 features:

| Feature | IDs | Prefixo |
| --- | --- | --- |
| mvp-vertical-slice | 46 | `R*` |
| chat-controls | 20 | `CC-R*` |
| file-management | 26 | `FM-R*` |
| explorer-editor-ux | 39 | `UX-R*` |
| workspace-switching | 34 | `WS-R*` |
| role-personalization | 25 | `RP-R*` |
| agent-selection | 14 | `AG-R*` |
| npm-distribution | 50 | `ND-R*` |
| git-management | 50 | `GIT-R*` |
| agent-change-review | 25 | `ACR-R*` |
| second-brain | 48 | `SB-R*` |

### Inventário de cobertura — **medido, não estimado**

Rodei `npx vitest run --coverage` neste worktree em 2026-07-29. Resultado:

- **109 arquivos de teste, 1589 testes, 100% passando** em ~30 s. `npm run test`
  (e portanto `npm run verify`) está **verde**.
- **`npm run test:coverage` sai com código 1** — o gate per-file de 90% reprova
  em **14 pontos**, exatamente os que o `HARNESS.md` documenta (reprodução
  independente confirmou a lista, nenhum ponto novo).

| Arquivo | Eixos abaixo de 90% |
| --- | --- |
| `explorer/viewers/ImageViewer.tsx` | branches 79,06 · statements/lines 85,84 |
| `explorer/viewers/PdfViewer.tsx` | branches 79,66 · functions 81,81 |
| `explorer/Explorer.tsx` | functions 82,95 · branches 89,56 |
| `explorer/viewers/SlidesViewer.tsx` | functions 83,33 |
| `explorer/viewers/docViewerShared.tsx` | functions 83,33 |
| `explorer/viewers/DocxViewer.tsx` | branches 85,71 |
| `explorer/viewers/SheetViewer.tsx` | branches 85,71 |
| `WorkUI.tsx` | functions 85,96 |
| `preload/index.ts` | functions 88,99 |
| `chat/Chat.tsx` | branches 88,98 |

**Defeito de medição encontrado (novo, não estava no HARNESS.md):** o número
global — `Statements 16,3% (19.626/120.335)` — é **artefato**, não cobertura.
O denominador inclui os bundles de build: `out/renderer/assets/pdf.worker.min*`,
`out/renderer/ort/ort-wasm-simd-threaded*.mjs`, `out/renderer/assets/transformers.web*`,
`out/main/index.js`, além de `scripts/*.mjs` e `*.config.ts`. Todos com 0% e
somando ~100 mil statements. Enquanto isso não for excluído, **nenhuma meta
global de cobertura tem significado** — só as per-file têm. Vira R-04.

Distribuição real (177 arquivos no relatório, 68 com algum eixo <90%; excluindo
os 22 artefatos de build/config/tipo, sobram **46 arquivos-fonte** abaixo de 90%
em pelo menos um eixo — os 14 do gate mais 32 que nenhum glob mede).

**Piores lacunas fora do gate atual** (nenhum glob as cobre, logo não reprovam):

| Arquivo | S | B | F | Leitura |
| --- | --- | --- | --- | --- |
| `onboarding/AgentSetup.tsx` | 84,4 | 88,9 | **25,0** | handlers do setup de agente quase não exercitados |
| `ui/ChoiceCard.tsx` | **64,6** | 77,8 | 50,0 | menor cobertura de statements do código-fonte |
| `ui/fileIcons.tsx` | **69,4** | 100 | 53,3 | mapa de ícones por extensão |
| `main/mcpProbe.ts` | **76,3** | **50,0** | 91,7 | probe JSON-RPC — caminhos de erro descobertos |
| `onboarding/InstallConfigForm.tsx` | 91,2 | 75,0 | **40,0** | formulário do install guiado |
| `ui/AgentPicker.tsx` | 100 | 92,9 | **40,0** | callbacks de seleção |
| `ui/ProfileSheet.tsx` | 94,3 | 90,5 | **44,4** | — |
| `chat/useAttachments.ts` | **79,5** | **68,4** | 100 | anexos: caminhos de rejeição |
| `main/documentReader.ts` | 88,4 | **66,7** | 100 | parsers docx/xlsx/pptx/pdf — ver R-09 |
| `onboarding/RoleSetup.tsx` | 89,2 | 90,0 | 100 | — |
| `ui/agentVisuals.ts` | 83,3 | 50,0 | 50,0 | — |

**25 arquivos-fonte não têm sequer o nome citado em nenhum arquivo de teste**
(sem sibling `.test.*` e sem import indireto detectável) — entre eles
`onboarding/WorkspacePicker.tsx`, `onboarding/bmadInstallCatalog.ts`,
`scm/ScmActions.tsx`, `scm/useCheckoutGuard.ts`, `chat/useMentions.ts`,
`chat/SlashMenu.tsx`, `ui/FileSearchDialog.tsx`, `ui/paneDnd.ts`,
`tour/useGuidedTour.ts`, `secondBrain/HealthNudge.tsx`.

### Inventário por nível

| Nível | Runner / config | Volume | Estado |
| --- | --- | --- | --- |
| Unit + componente | `vitest.config.ts` (jsdom/node) | 109 arquivos · 1589 testes | ✅ verde |
| Integração (IPC) | idem — `main/index.test.ts`, `preload/index.test.ts` | dentro dos 1589 | ✅ verde, mas `preload` reprova F=88,99 |
| E2E "CLI real" (node) | `vitest.e2e.config.ts` | **1** arquivo (`bmadCli.e2e.test.ts`) | manual; cobre install/update do BMAD |
| E2E app real (Electron) | `playwright.config.ts` | **7** specs | **4 vermelhas** (ver R-01) |

**Mapa de testes por feature** (classificação por padrão de caminho):
second-brain 22 · git-management 21 · agent-change-review 11 · chat 11 ·
explorer/file-management/UX 9 · harness/infra 10 · onboarding/workspace 8 ·
npm-distribution 6+3 · role-personalization 5 · mcp 4 · agent-selection 3.

**E2E por feature:**

| Spec | Feature | Status |
| --- | --- | --- |
| `app-launch.spec.ts` | M0/M1 boot | ✅ passa |
| `second-brain.spec.ts` | second-brain | ✅ passa |
| `agent-change-review.spec.ts` | agent-change-review | ✅ passa |
| `git-management.spec.ts` | git-management | ✅ passa (T32) |
| `file-management.spec.ts` | file-management | ❌ vermelha |
| `explorer-editor-ux.spec.ts` | explorer-editor-ux (×2 cenários) | ❌ vermelha |
| `workspace-switching.spec.ts` | workspace-switching | ❌ vermelha |
| — | **mvp-vertical-slice (chat→PRD)** | ❌ **inexistente** |
| — | **chat-controls** | ❌ inexistente |
| — | **agent-selection** | ❌ inexistente |
| — | **npm-distribution** | ❌ inexistente |
| — | **role-personalization** | ❌ inexistente |

### Fragmentos de conhecimento carregados (tier core + os exigidos por System-Level)

`risk-governance.md`, `probability-impact.md`, `test-levels-framework.md`,
`test-priorities-matrix.md`, `nfr-criteria.md`,
`adr-quality-readiness-checklist.md`, e o checklist de DoD de `test-quality.md`
(sem hard waits, sem condicionais, <300 linhas, <1,5 min, self-cleaning,
asserções explícitas, dados únicos, paralelo-seguro).

---

## Step 3 — Testabilidade & Riscos

### 3.1 Revisão de testabilidade (System-Level)

#### Controlabilidade — ⚠️ é aqui que dói

| Dimensão | Estado | Evidência |
| --- | --- | --- |
| Semeadura de estado | **Parcial** | `configStore` pode ser semeado no `userData` (specs fazem isso), mas `provisioned: true` **só evita o install de primeiro uso** — `updateBmad()` nunca lê a flag, então todo launch cai no `UpdateGate` e dispara `npx bmad-method install` de verdade. |
| Bypass de gate para teste | **Ausente** | Não existe `HIVE_E2E` / `SKIP_ONBOARDING` em main, preload ou renderer (registrado no `STATE.md` e confirmado por busca). O único escape é clicar em "continuar mesmo assim" quando o gate emite `error` — o que os specs fazem como corrida contra o happy path. |
| Injeção de falha | **Boa no unit, ausente no E2E** | `processRunner` é injetável, `mcpProbe` aceita transporte injetado, adapters scriptáveis. Nada disso é alcançável do E2E, que sobe o app buildado. |
| Mockabilidade de dependência externa | **Boa** | `AgentAdapter` isola os CLIs; `window.hive` tem mocks dedicados (`testSupport/hive*Mock.ts`). |

**Consequência direta:** as 4 specs E2E vermelhas não são bugs de produto nem
flakiness — são a ausência desse seam. Confirmado como **pré-existente** por
checkout do base `ae5551e` em worktree limpo, build e reexecução: falha
idêntica, no mesmo `waitForWorkUI`.

#### Observabilidade — ✅ forte

Fronteiras IPC explícitas e tipadas (`window.hive`), `moduleBoundaries.test.ts`
falha se alguém atravessar, `noInlineStrings.test.ts` garante copy via `t()`,
probe de contraste (`ui/contrast.ts`) amostra pixels reais em vez de parsear
`getComputedStyle` (que mente com `color-mix()`). Asserções determinísticas são
viáveis nos três níveis.

#### Confiabilidade / isolamento — ✅ boa, com uma ressalva

`vitest` roda em ~30 s com 1589 testes; specs E2E usam `userData` descartável e
repositório git de rascunho. Ressalva: `playwright.config.ts` fixa
`workers: 1` e `retries: 0` — correto para diagnosticar hoje, mas é o teto de
throughput quando o E2E virar gate.

#### ASRs (requisitos arquiteturalmente significativos)

| ASR | Classificação |
| --- | --- |
| Seam de teste que permita subir o app sem executar `npx bmad-method install` | **ACTIONABLE** — bloqueia toda a camada E2E |
| Fronteira main/preload/renderer via `window.hive` (contrato tipado) | FYI — já imposta por sensor |
| `AgentAdapter` como único ponto de contato com CLIs de agente | **ACTIONABLE** na metade "contract test do formato de stream" (R-07) |
| Copy 100% via `t()` | FYI — já imposta por sensor |
| Piso rígido de Node 22.22.1 | FYI — `engines.node` já alinhado |
| Contraste ≥4,5:1 nos dois temas | **ACTIONABLE** — probe existe, gate não |

### 3.2 Registro de riscos

Escala: Probabilidade e Impacto 1–3; Score = P×I; ≥6 exige mitigação, 9 bloqueia.

| ID | Cat | Risco | P | I | Score | Ação |
| --- | --- | --- | --- | --- | --- | --- |
| **R-01** | TECH | Sem seam de teste para o gate de provisionamento BMAD → 4 de 7 specs E2E vermelhas; a camada E2E depende de rede e do CLI real a cada launch | 3 | 3 | **9** | **BLOCK** |
| **R-02** | OPS | E2E não é gate no CI (`continue-on-error`) **e nunca executou em infra limpa** — o workflow só dispara em push→`main`/PR e a branch atual não foi mergeada; libs do Electron + `xvfb` no runner são não-provadas | 3 | 2 | **6** | MITIGATE |
| **R-03** | OPS | Gate de cobertura fora do `verify` e vermelho em 14 pontos → "verify verde" lê como completo e não é | 3 | 2 | **6** | MITIGATE |
| **R-04** | TECH | Denominador de cobertura contaminado por `out/**`, `scripts/**`, `*.config.*` → global 16,3% sem significado; nenhuma meta agregada é confiável | 3 | 2 | **6** | MITIGATE |
| **R-05** | BUS | Regressão visual/a11y sem gate — contraste 3,93:1 e 3,46:1 no tema claro (piso 4,5:1); classe reincidente em M12 **e** M12.1, sempre achada por olho humano | 3 | 2 | **6** | MITIGATE |
| **R-06** | BUS | 5 features sem nenhum E2E — inclusive o fluxo que prova a tese do produto (pedir PRD → ver `PRD.md` no explorer), hoje coberto só por adapter scriptado + passe manual | 2 | 3 | **6** | MITIGATE |
| **R-07** | TECH | Nenhum teste de contrato contra os CLIs externos (`claude`, `devin`, `copilot`): o formato do stream JSON é contrato de fato e uma mudança upstream passa despercebida até o usuário ver | 2 | 3 | **6** | MITIGATE |
| **R-08** | DATA | Caminhos destrutivos sobre arquivos do usuário — rejeitar hunk / restaurar checkpoint (shadow-git) e escrita no vault do second-brain — com apenas 1 spec E2E cada | 2 | 3 | **6** | MITIGATE |
| **R-09** | SEC | Parsers de documento de origem arbitrária (docx/xlsx/pptx/pdf via mammoth/xlsx/jszip/pdf.js) sem teste de arquivo malformado ou hostil; `documentReader.ts` com branches em 66,7%; sem `npm audit` no CI | 2 | 3 | **6** | MITIGATE |
| **R-10** | OPS | Auto-update (npm como fonte de versão + GitHub Releases como payload) sem E2E de troca real de payload; T17/T18 bloqueados (token ND-B2, sem hardware Windows) | 2 | 3 | **6** | MITIGATE |
| **R-11** | PERF | Whisper offline (modelo de 2,4 GB, `ort-wasm`, transcrição local) sem nenhum threshold de latência, memória ou tamanho definido | 2 | 2 | 4 | MONITOR |
| **R-12** | TECH | ~35 globs de cobertura curados à mão (~200 linhas de config); cada feature precisa lembrar de se inscrever e já falhou uma vez ("T10 regression pass: T1 missed these two") | 3 | 1 | 3 | DOCUMENT |
| **R-13** | TECH | `workers: 1` / `retries: 0` no Playwright — adequado para diagnosticar, teto de throughput quando o E2E virar gate de PR | 2 | 1 | 2 | DOCUMENT |

**Resumo:** 13 riscos — **1 BLOCK (score 9)**, 9 MITIGATE (score 6), 1 MONITOR,
2 DOCUMENT. Categorias mais carregadas: TECH (5) e OPS (4).

Nota deliberada: R-01 é a raiz de R-02, R-06 e metade de R-08/R-10. Resolvê-lo
destrava mais valor do que qualquer outro item deste registro — é a única
mudança de arquitetura que o plano pede como pré-requisito.

### 3.3 Planejamento de NFR

| Categoria | Threshold | Suporte atual | Lacuna / decisão | Evidência planejada |
| --- | --- | --- | --- | --- |
| Segurança | `contextIsolation: true`, `nodeIntegration: false`, zero path traversal, sem segredos no repo | **Bom** — asserções existem (`contextIsolation`/`nodeIntegration` ×3, traversal ×5 incluindo `%2e%2e%2f` percent-encoded, `sanitize` ×13, `openExternal` ×40) | Sem teste de **arquivo hostil**; sem `npm audit` no CI; GitLeaks recusado deliberadamente (HARNESS §7) | Suíte de fixtures hostis + job `npm audit` |
| Performance | **UNKNOWN** | Nenhum threshold definido em nenhuma spec | Whisper (2,4 GB, transcrição), abertura de PDF/XLSX grande, boot do app: **três thresholds a definir com o produto** — não devem ser adivinhados | Benchmark de boot, de transcrição e de abertura de documento |
| Confiabilidade | Falha de CLI/rede degrada com mensagem e escape, nunca spinner infinito | **Parcial** — lição do STATE.md já institucionalizada ("gate precisa de escape *enquanto* roda") | Sem teste sistemático de degradação por feature | Cenários de erro/offline por adapter |
| Manutenibilidade | per-file 90% nos arquivos tocados; global ≥80% | **Parcial e mal medido** — per-file vermelho em 14, global sem sentido (R-04) | Sanear denominador → então fixar meta global | `test:coverage` como gate |
| Acessibilidade | Contraste ≥4,5:1 nos dois temas | Probe existe (`ui/contrast.ts`), não roda como gate nem varre telas | Elevar de inferencial para computacional | Passe de contraste automatizado, dark+light |

**Thresholds UNKNOWN → itens de clarificação, não valores inventados:**
latência de transcrição do Whisper, teto de memória do processo com modelo
carregado, tempo de abertura de documento grande, tempo de boot aceitável.

**Fronteira:** este workflow *planeja* validação de NFR. O veredito
PASS/CONCERNS/FAIL pertence a `bmad-testarch-nfr` depois que houver evidência.

---

## Step 4 — Plano de Cobertura & Estratégia de Execução

### 4.1 Princípio de alocação por nível

Aplicando `test-levels-framework.md` à topologia Electron:

- **Unit** — lógica pura: parsers (`gitParse`, `conflictParse`, `inlineDiff`),
  stores, catálogos, helpers de cópia. É onde o projeto já é forte.
- **Componente (jsdom)** — props/eventos/estados de React com `window.hive`
  mockado. Também forte.
- **Integração (IPC)** — o análogo local de "teste de API": handler registrado
  em `main/index.ts` ↔ bridge do `preload` ↔ chamada do renderer. **É a camada
  mais fina hoje** e a que mais barato fecha lacuna, porque não precisa do seam
  do R-01.
- **E2E (Electron real)** — jornadas do usuário sobre disco/git de verdade.
  Reservado a caminho crítico; **bloqueado pelo R-01** para 5 features.

Guarda anti-duplicação: nada sobe de nível se o nível abaixo já asseverou o
mesmo. Os cenários novos abaixo indicam nível único, exceto onde a defesa em
profundidade é intencional (caminhos destrutivos, R-08).

### 4.2 Matriz de cobertura por feature

Legenda de estado: ✅ adequado · ⚠️ lacuna pontual · ❌ lacuna estrutural

| Feature | IDs | Unit/Comp | Integr. IPC | E2E | Lacuna dominante | Novos cenários |
| --- | --- | --- | --- | --- | --- | --- |
| mvp-vertical-slice | 46 | ✅ 11 | ⚠️ | ❌ nenhum p/ chat→PRD | A jornada que prova a tese não tem E2E automatizado | 4 (1 P0 E2E, 2 P1 IPC, 1 P1 comp.) |
| chat-controls | 20 | ✅ | ✅ | ❌ | Slash menu e interrupt só em componente | 3 (1 P1 E2E, 2 P2 comp.) |
| file-management | 26 | ✅ | ✅ | ❌ **vermelha** | Bloqueada por R-01 | 2 (reabilitar + 1 P0 destrutivo) |
| explorer-editor-ux | 39 | ⚠️ viewers 79–86% | ✅ | ❌ **vermelha** ×2 | 7 dos 14 pontos do gate estão aqui | 8 (4 P1 comp. de viewer, 2 P0 SEC, 2 reabilitar) |
| workspace-switching | 34 | ✅ | ✅ | ❌ **vermelha** | Bloqueada por R-01 | 2 (reabilitar + 1 P1 troca com pendências) |
| role-personalization | 25 | ⚠️ Profile/Choice/Role 44–89% | ✅ | ❌ | Onboarding é o buraco de cobertura mais fundo | 5 (3 P1 comp., 2 P2) |
| agent-selection | 14 | ⚠️ Picker/Switcher F=40–50% | ✅ | ❌ | Detecção de disponibilidade e troca por conversa | 4 (2 P1 comp., 1 P1 IPC, 1 P2 E2E) |
| npm-distribution | 50 | ✅ 9 | ✅ | ❌ | Troca real de payload nunca exercitada ponta a ponta | 4 (1 P0 integr., 2 P1, 1 P2 manual matriz OS) |
| git-management | 50 | ✅ 21 | ✅ | ✅ passa | Cobertura madura; falta caminho de conflito no E2E | 3 (1 P1 E2E conflito, 2 P2) |
| agent-change-review | 25 | ✅ 11 | ✅ | ✅ passa | Rejeição/restauração destrutiva com defesa única | 4 (2 P0 destrutivo, 2 P1) |
| second-brain | 48 | ✅ 22 | ✅ | ✅ passa | Whisper sem threshold; vault destrutivo | 5 (2 P0 DATA, 1 P1, 2 P3 benchmark) |
| **transversal** | — | — | — | — | Contraste, arquivos hostis, contrato de CLI, saneamento de medição | 12 |

### 4.3 Cenários P0 (bloqueiam a rede de regressão)

| ID | Cenário | Nível | Risco | Nota |
| --- | --- | --- | --- | --- |
| P0-001 | App sobe até a work UI **sem** executar `npx bmad-method install` (seam de teste honrado) | E2E | R-01 | Pré-requisito de todos os demais E2E |
| P0-002 | Jornada da tese: pedir PRD ao agente → `PRD.md` aparece no explorer e abre | E2E | R-06 | Com adapter scriptado no lugar do CLI real |
| P0-003 | Rejeitar hunk do agente não perde alteração vizinha aceita (shadow-git) | E2E + integr. | R-08 | Defesa em profundidade intencional |
| P0-004 | Restaurar checkpoint não apaga arquivo criado pelo usuário fora do escopo do agente | Integr. IPC | R-08 | — |
| P0-005 | Escrita no vault do second-brain é atômica: falha no meio não deixa nota corrompida | Integr. IPC | R-08 | — |
| P0-006 | `documentReader` rejeita docx/xlsx/pptx/pdf malformado com erro tratado, sem crash do main | Unit | R-09 | Fixtures hostis |
| P0-007 | Zip com entrada de path traversal (`../`) não escreve fora do destino | Unit | R-09 | `jszip` é a superfície |
| P0-008 | Contraste ≥4,5:1 em todas as telas-chave, tema dark **e** light | Visual autom. | R-05 | Probe já existe |
| P0-009 | `test:coverage` verde e promovido a gate no `verify` e no CI | CI | R-03/R-04 | Requer sanear denominador primeiro |
| P0-010 | Aplicar update baixado troca o payload e o app sobe na nova versão | Integr. | R-10 | Sem hardware real ainda (ver limites) |

### 4.4 Estratégia de execução (PR / Nightly / Pre-release)

| Tier | Quando | Conteúdo | Orçamento | Gate? |
| --- | --- | --- | --- | --- |
| **T0** | Todo PR | `verify` = typecheck + lint + 1589 vitest **+ `test:coverage`** | ~2–4 min | **sim** (coverage entra como gate após P0-009) |
| **T1** | Todo PR | E2E smoke em Electron real: `app-launch` + 1 caminho por feature | ~8–12 min | **sim**, depois do R-01 (hoje `continue-on-error`) |
| **T2** | Nightly | E2E completo (todas as specs, todos os cenários) + `bmadCli.e2e.test.ts` (CLI real) + passe de contraste dark/light + `npm audit` | ~25–40 min | report → gate |
| **T3** | Pre-release | Update real npm→GitHub Releases em Windows e macOS; benchmark de Whisper (latência/memória); suíte de arquivos hostis completa | horas / manual | checklist de release |

Justificativa: o T0 já é rápido o suficiente para não merecer sharding. O T1
precisa que o Playwright saia de `workers: 1` (R-13) para caber em 12 min quando
os cenários novos entrarem.

### 4.5 Estimativas (intervalos, sem falsa precisão)

| Bloco | Escopo | Esforço |
| --- | --- | --- |
| Seam de teste do R-01 | Mudança de produto em `bmadService`/`UpdateGate` + reabilitar 4 specs | ~8–16 h (dev, não QA) |
| Sanear medição de cobertura + limpar os 14 pontos | `coverage.exclude` + testes nos viewers/Explorer/WorkUI/Chat/preload | ~16–28 h |
| Cenários P0 (10) | Inclui fixtures hostis e caminhos destrutivos | ~30–45 h |
| Cenários P1 (~22) | Componente + IPC + E2E por feature | ~35–55 h |
| Cenários P2 (~14) | Bordas e regressão secundária | ~12–24 h |
| Cenários P3 (~4) | Benchmarks de Whisper e boot | ~4–8 h |
| Contract test de CLI (R-07) | Fixtures de stream gravadas + verificação de formato | ~10–18 h |
| Gate de contraste (R-05) | Automatizar o probe existente nas telas-chave | ~8–14 h |
| **Total** | | **~125–210 h** (~4–6 semanas para 1 pessoa dedicada) |

Excluído: manutenção contínua (~10%) e o E2E em hardware Windows/macOS real,
que depende de máquina indisponível hoje.

### 4.6 Quality gates

- P0: **100%** de aprovação, sem exceção.
- P1: **≥95%**, falhas restantes triadas e aceitas por escrito.
- Nenhum risco score 9 em aberto → hoje **R-01 reprova o gate**.
- Riscos score ≥6 com plano, dono e prazo registrados.
- Cobertura: per-file 90% em todo arquivo tocado (já é convenção) **e** meta
  global ≥80% depois de sanear o denominador — não antes, porque hoje o número
  global é ficção.
- Contraste ≥4,5:1 nos dois temas em todas as telas-chave.
- DoD de teste (`test-quality.md`): sem hard waits, sem condicionais de fluxo,
  <300 linhas, <1,5 min, self-cleaning, asserções no corpo do teste.

**Decisão de gate hoje: FAIL** — pelo R-01 (score 9, aberto). Depois de
resolvido e com os 14 pontos de cobertura limpos, o esperado é CONCERNS até que
o E2E rode verde em infra limpa, e então PASS.

---

## Adendo de verificação (passe independente, 2026-07-29)

Executei os três níveis nesta sessão para confirmar o registro acima por
evidência própria antes de gerar os documentos finais. Resultado: **o registro
R-01–R-13 se sustenta**; três achados novos entram como R-14–R-16; e uma
afirmação preliminar minha foi **descartada por ser falsa** (registrado abaixo
para não ser re-proposta).

### Execução medida

| Suíte | Comando | Resultado |
| --- | --- | --- |
| Unit + componente | `npm run test` | **109 arquivos / 1589 testes, 100% verde**, ~21 s |
| Gate de cobertura | `npm run test:coverage` | **exit 1 — 14 violações**, idênticas às documentadas (nenhuma nova, nenhuma resolvida) |
| E2E Electron real | `npm run build && xvfb-run -a npm run test:e2e:app` | **4 falharam · 4 passaram · 6 skipados** em **10,6 min** |

Detalhe do E2E (execução própria, não citação):

| # | Spec / caso | Resultado |
| --- | --- | --- |
| 1 | `agent-change-review` — view de revisão, estado vazio | ✓ 8,4 s |
| 2 | `app-launch` — bridge `window.hive` | ✓ 1,2 s |
| 3 | `explorer-editor-ux` caso 1 (abrir editável + Ctrl+S) | **✘ 0 ms** (falha de `beforeAll`) |
| 4–9 | `explorer-editor-ux` casos 2,3,4,5,7,8 | **– skipados por cascata** |
| 10 | `explorer-editor-ux` caso 6 (resize do rail, instância dedicada) | **✘ 2,0 min** (timeout) |
| 11 | `file-management` — jornada destrutiva completa em disco | **✘ 3,4 min** (timeout) |
| 12 | `git-management` — flip→diff→stage→commit→push→stash | ✓ 6,0 s |
| 13 | `second-brain` — view, FAB, protocolo `hive-model:` | ✓ 38,6 s |
| 14 | `workspace-switching` — A→B provisionado→C não provisionado | **✘ 3,3 min** (timeout) |

Confirma R-01 por mecanismo: as 4 falhas são **timeouts esperando a work UI**, em
3 arquivos de spec, todos os que atravessam provisionamento. Os 4 verdes são os
que já entram com workspace pronto ou não dependem do gate.

### Riscos adicionais (numeração continua o registro)

| ID | Cat | Risco | P | I | Score | Ação |
| --- | --- | --- | --- | --- | --- | --- |
| **R-14** | OPS | **Falha de E2E não deixa rastro.** `playwright.config.ts` não tem bloco `use:` nenhum — sem `trace`, sem `screenshot`, sem `video`; `retries: 0`; `reporter: 'list'`. E o CI faz `upload-artifact` de `hive-desktop/playwright-report/`, **diretório que o reporter `list` nunca cria** (os artefatos caem em `test-results/`). O upload do CI é um no-op. É o mecanismo pelo qual as 4 vermelhas ficaram invisíveis por tempo indeterminado. | 3 | 2 | **6** | MITIGATE |
| **R-15** | TECH | **12 das 23 features foram shipadas sem `.specs/`**, logo sem IDs de requisito — anexos/menções `#`, histórico de sessão, tour, folha de perfil, atalhos personalizáveis, Estúdio de skills, módulo MCP, viewers de documento, busca `Ctrl+P`, switcher de agente, shell/busca. Os 377 IDs cobrem 11 features; as outras 12 não têm de onde derivar rastreabilidade. Caso extremo: **`FileSearchDialog.tsx` não tem teste nenhum**. | 3 | 2 | **6** | MITIGATE |
| **R-16** | TECH | **Acoplamento entre casos no único spec multi-caso.** `explorer-editor-ux` usa `describe.serial` sobre **workspace compartilhado**: observado nesta sessão, 1 falha de `beforeAll` apagou a evidência de 6 casos. A suíte reporta 1 falha onde há 7 incógnitas. | 3 | 1 | 3 | DOCUMENT |

**Registro atualizado: 16 riscos** — 1 BLOCK (score 9), **11 MITIGATE** (score 6),
1 MONITOR, 3 DOCUMENT.

### Afirmação descartada (para não ser re-proposta)

Numa primeira passada eu havia registrado que as invariantes de segurança do
Electron "são afirmadas em prosa e nunca asseveradas". **Falso, e verificado como
falso:** `src/main/index.test.ts:310-317` assevera
`contextIsolation === true`, `nodeIntegration === false` e `sandbox === true` nas
`webPreferences` da `BrowserWindow`; `fsService.test.ts` tem 36 asserções de
escape/traversal (incluindo `%2e%2e%2f` percent-encoded); `HtmlPreview.test.ts`
assevera `sandbox="allow-scripts"` sem `allow-same-origin`. A postura de
segurança **é** testada. O que de fato falta é o recorte do **R-09** já
registrado — arquivo hostil nos parsers de documento (`documentReader.ts` com
**branches em 66,66%**, medido) e ausência de `npm audit` no CI. R-09 permanece;
a afirmação genérica sai.

---

## Step 5 — Geração de Saídas & Validação

### Modo de execução resolvido: **sequential**

`tea_execution_mode: auto`. A sondagem de capacidade resolve para `sequential`:
este runtime não deve lançar subagentes sem pedido explícito do usuário, e não
houve. Os dois documentos foram gerados e reconciliados por um único executor.

### Documentos produzidos

| Artefato | Caminho | Linhas |
| --- | --- | --- |
| Test design — arquitetura | `_bmad-output/test-artifacts/test-design-architecture.md` | 460 |
| Test design — QA | `_bmad-output/test-artifacts/test-design-qa.md` | 595 |
| Handoff TEA → BMAD | `_bmad-output/test-artifacts/test-design/hive-desktop-handoff.md` | 168 |
| Progresso e evidência | este arquivo | — |

### Validação contra `checklist.md`

**Conformidades verificadas por inspeção:**

- Pré-requisitos System-Level: PRD/ADR/arquitetura equivalentes presentes (Step 1).
- Riscos: 16 IDs únicos, categoria atribuída, P e I em 1–3, score = P×I conferido,
  ≥6 marcados, mitigação com dono e prazo, **risco residual documentado**.
- NFR: 6 categorias em escopo; thresholds ausentes marcados **UNKNOWN** sem
  adivinhação, convertidos em B-3 e R-11; fontes de evidência planejadas; veredito
  PASS/CONCERNS/FAIL **deferido** a `bmad-testarch-nfr`.
- Cobertura: 58 cenários, nível selecionado por `test-levels-framework.md`, guarda
  anti-duplicação aplicada com as duas sobreposições justificadas (caminhos
  destrutivos e fluxos que já regrediram), prioridades P0–P3, ligação a risco.
- Prioridades sem contexto de execução (só "Critério"), com a nota no topo de que
  P0–P3 é prioridade e não momento de execução; execução em seção separada.
- Estimativas em **faixas**, sem falsa precisão; cronograma em semanas.
- Estratégia de execução em três tiers por tipo de ferramenta (PR / Nightly /
  Pre-release), com a filosofia declarada.
- Consistência entre documentos: os 16 IDs de risco aparecem nos três; mesmas
  prioridades; mesmos bloqueadores B-1..B-4; mesma data e autor.
- Doc de arquitetura sem código de teste (verificado: 0 ocorrências de `test(`/
  `expect(`); receita concentrada no doc de QA.
- Sessões de CLI: nenhuma aberta (o `playwright-cli` não está instalado; a
  exploração foi por código e por execução real da suíte). Nada a limpar.
- Artefatos temporários fora de `{test_artifacts}`: os logs de execução ficaram no
  scratchpad da sessão, não no repo. `hive-desktop/coverage/` e
  `hive-desktop/test-results/` foram gerados pelas ferramentas nos caminhos que
  elas mesmas definem.

**Desvios conscientes do checklist, com motivo:**

1. **Sem exemplo de código com `playwright-utils`** (o checklist pede quando
   `tea_use_playwright_utils` é `true`, e é). O pacote não é dependência do projeto
   e não há superfície HTTP — um exemplo com
   `@seontechnologies/playwright-utils/api-request/fixtures` seria código que não
   roda, ensinando um padrão inaplicável. O Apêndice A traz no lugar um exemplo
   **executável no stack real** (`_electron.launch` + asserção em disco), no padrão
   que a suíte já usa.
2. **Doc de arquitetura em 460 linhas, acima do alvo de ~150–200.** Tensão real
   dentro do próprio checklist: ele exige tabela de risco com 9 colunas para **12**
   riscos ≥6 e um plano de mitigação com 5 campos para cada um. Cortei o que era
   bloat de verdade (detalhe de estratégia de níveis, mitigações de QA movidas para
   o doc de QA, prosa redundante do "o que funciona bem"). O restante é conteúdo
   que o próprio checklist torna obrigatório.
3. **Sem seção "Project Team"** — o template a marca como opcional e os papéis não
   estão atribuídos neste projeto (`user_name` segue placeholder do installer).
4. **Sem "Status File Integration"** — não existe arquivo de status de sprint neste
   projeto (`sprint-status.yaml` ausente; o projeto usa `.specs/project/STATE.md`
   do `tlc-spec-driven`). O registro equivalente é este arquivo de progresso.

### Riscos-chave e limiares de portão

- **Decisão de portão hoje: FAIL**, por R-01 (score 9, OPEN).
- P0 100% · P1 ≥95% · `test:coverage` exit 0 e dentro do `verify` · E2E verde em 10
  execuções em infra limpa · contraste ≥4,5:1 nos dois temas.
- Performance permanece **CONCERNS** por regra enquanto os thresholds forem UNKNOWN.

### Premissas abertas

1. **B-1..B-4 são decisões humanas** e são o gargalo real do plano — nada de E2E
   avança sem B-1 e B-2.
2. **Baseline concorrente:** M10, M11 e M12 vivem em branches não mergeadas e o CI
   nunca executou. Definir a baseline é pré-requisito de "regressão" ter
   significado.
3. Os 4 thresholds de performance não foram estimados — e não devem ser, por quem
   não é dono do produto.
