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
  - 'hive-desktop/.specs/project/{PROJECT,ROADMAP,STATE,HARNESS}.md'
  - 'hive-desktop/.specs/features/*/spec.md (11 features, 377 IDs)'
  - 'hive-desktop/{PRODUCT.md,AGENTS.md}'
  - 'hive-desktop/{vitest.config.ts,vitest.e2e.config.ts,playwright.config.ts}'
  - '.github/workflows/hive-desktop.yml'
  - 'medição própria 2026-07-29: npm run test, npm run test:coverage, npm run test:e2e:app'
---

# Test Design para Arquitetura: Cobertura de Regressão Completa — Hive Desktop

**Propósito:** contrato entre QA e Engenharia sobre o que a arquitetura precisa
mudar **antes** de o trabalho de teste render. Preocupações de testabilidade,
riscos e requisitos de NFR — não receita de execução.

**Data:** 2026-07-29 · **Autor:** Test Architect (agente TEA, modo System-Level)
**Status:** Revisão de arquitetura pendente · **Projeto:** `hive-desktop`
**PRD:** `.specs/project/PROJECT.md` + `PRODUCT.md` + `.specs/features/*/spec.md`
**ADR:** `.specs/project/STATE.md` (D1–D25) + `.specs/project/HARNESS.md`
**Companheiros:** `test-design-qa.md` (cenários, níveis, estimativas, portões) ·
`test-design/hive-desktop-handoff.md` (handoff BMAD)

---

## Sumário executivo

**Escopo:** regressão de todas as 23 features (M0–M12.1). 377 IDs de requisito em
11 features com `.specs/`; 12 features sem spec.

**Contexto de produto:** superfície visual sobre o BMAD para squads não fluentes
em CLI. O app **escreve no disco do usuário** — arquivos, git, vault. Regressão
aqui não degrada experiência, destrói trabalho.

**Decisões de arquitetura relevantes para teste:**

1. Três camadas de runtime do Electron com fronteira imposta pelo processo —
   `main` (FS, git CLI, spawn de agentes, rede) / `preload` (contrato tipado
   `window.hive`) / `renderer`. `contextIsolation` e `sandbox` ligados.
2. Motores externos em vez de bibliotecas: `git` CLI via `processRunner`,
   `npx bmad-method` para provisionamento, CLIs de agente por spawn.
3. Shadow-git com `GIT_DIR` próprio para checkpoints do agente (D23).
4. Whisper offline: Transformers.js no renderer, modelos servidos pelo `main` via
   protocolo `hive-model:` (D-SB-1/D-SB-4).

**Escala:** app desktop single-user, sessões longas. Não há RPS, tenant nem carga
concorrente — o que reposiciona todo o eixo de performance.

**Resumo de risco:** 16 riscos — **12 de alta prioridade (≥6)**, sendo **1 em
score 9 (BLOCK)**. Esforço estimado no doc de QA (~125–210 h).

**Conclusão:** o projeto tem uma suíte unitária de primeira linha (1589 testes,
~21 s, 100% verde) e nenhuma rede de regressão confiável — não por descuido de
QA, mas porque **falta um seam de teste no produto**: sem forma de subir o app sem
executar `npx bmad-method install`, 4 dos 14 casos E2E não chegam à tela que
deveriam testar.

---

## Guia rápido

### 🚨 BLOQUEADORES — o time precisa decidir

1. **B-1: seam de teste para o gate de provisionamento BMAD.** *(a única mudança de
   produto que este plano exige)* — `configStore` aceita `provisioned: true`, mas
   `updateBmad()` nunca lê a flag: **todo** launch cai no `UpdateGate` e dispara
   `npx bmad-method install` real. Não existe `HIVE_E2E`/`SKIP_ONBOARDING` em
   nenhuma camada (confirmado por busca). Os specs hoje correm contra o happy path
   clicando em "continuar mesmo assim" quando o gate emite `error` — daí os
   timeouts. Precedente que legitima o pedido: `window.hive.fs.importEntry`,
   test-hook sancionado em produção (design.md §8).
   *Dono: Dev/main (`bmadService` + `UpdateGate`) · pré-implementação*

2. **B-2: instrumentação de diagnóstico do E2E.** *(horas, risco zero)* —
   `playwright.config.ts` não tem bloco `use:`: sem `trace`, `screenshot`,
   `video`; `retries: 0`. E o CI faz `upload-artifact` de
   `hive-desktop/playwright-report/`, **diretório que o reporter `list` nunca
   cria**. O upload é um no-op. Reparar B-1 sem isto é depurar no escuro.
   *Dono: Harness · imediato*

3. **B-3: decidir os thresholds de performance.** Nenhum documento define
   orçamento de boot, de abrir documento grande, de latência/memória de
   transcrição (modelo de 2,4 GB). **Não foram estimados de propósito** — sem
   threshold, "performance regrediu" é indemonstrável. *Dono: Produto*

4. **B-4: IDs de requisito para as 12 features órfãs.** Sem IDs não há
   rastreabilidade. Pedido: `spec.md` mínimo (requisitos + IDs), sem re-planejar.
   *Dono: Produto*

**O que precisamos:** B-1 e B-2 antes do início da implementação; B-3 e B-4
respondidos, ou lacuna aceita por escrito.

### ⚠️ ALTA PRIORIDADE — o time deve validar

1. **R-01 (score 9) → R-02: promover E2E a portão.** Cumprir o gatilho que o
   `HARNESS.md` §7 já registrou ("flip this to a gate when they are"). Nota
   adicional: o job E2E **nunca executou em infra limpa** — o workflow só dispara
   em push→`main`/PR e as branches de feature não foram mergeadas; as libs do
   Electron no runner e o `xvfb-run` são não-provados. *(dono do harness)*
2. **R-03/R-04: sanear a medição de cobertura antes de promovê-la a portão.** O
   global (**16,3%**) é artefato: o denominador inclui `out/main/index.js`,
   `out/renderer/assets/transformers.web*`, `out/renderer/ort/*.mjs`,
   `scripts/*.mjs` e os `*.config.ts` — ~100 mil statements a 0%. Ordem: sanear
   `coverage.exclude` → limpar os 14 pontos → promover. *(dono do harness)*
3. **R-09: parsers de documento de origem arbitrária.** `documentReader.ts` lê
   docx/xlsx/pptx/pdf via `mammoth`/`xlsx`/`jszip`/`pdf.js` com **branches em
   66,66%** (medido), sem nenhuma fixture malformada; e não há `npm audit` no CI.
   *Escopo:* a postura de segurança do Electron **está** testada
   (`index.test.ts:310-317` assevera os três fuses; `fsService.test.ts` tem 36
   asserções de escape incl. `%2e%2e%2f`). A lacuna é **arquivo hostil**, não
   fuse. *(Dev)*
4. **R-07: contract test contra os CLIs externos.** O formato do stream JSON do
   `claude`/`devin`/`copilot` é contrato de fato; mudança upstream passa
   despercebida até o usuário ver. *(Dev/agent-adapter)*
5. **R-05: elevar a a11y de inferencial para computacional.** O probe de contraste
   já existe (amostra pixel real — parsear `getComputedStyle` mente com
   `color-mix()`), mas não é gate nem varre telas. É a classe que reincidiu em M12
   **e** M12.1, incluindo contraste 3,93:1 e 3,46:1 no tema claro. *(Dev + UX)*

### 📋 INFORMATIVO — solução definida, sem decisão

1. **Estratégia de níveis:** unitário para lógica pura; componente jsdom;
   **integração IPC** como análogo local de "teste de API" — é a camada mais fina
   hoje e a que fecha lacuna mais barato, porque **não depende de B-1**; E2E
   reservado a jornada sobre disco real. Detalhe no doc de QA.
2. **Ferramental: nada novo a instalar.** Vitest, Playwright `_electron.launch`,
   Playwright MCP. Sem k6, sem Pact, sem `playwright-utils` — ver Trade-offs.
3. **CI em três tiers:** PR / Nightly / Pre-release. Detalhe no doc de QA.
4. **Cobertura:** ~58 cenários novos priorizados P0–P3, cada um ligado a risco e a
   ID de requisito. No doc de QA.
5. **Portões:** definidos no doc de QA (critérios de entrada e saída).

---

## Avaliação de risco

16 riscos — **12 de alta prioridade (≥6)**, 1 médio, 3 baixos. Categorias mais
carregadas: TECH (7) e OPS (5).

Escala: Probabilidade 1 improvável / 2 possível / 3 provável · Impacto 1 menor /
2 degradado / 3 crítico · Score = P×I. Ação: 1–3 DOCUMENT, 4–5 MONITOR,
6–8 MITIGATE, 9 BLOCK.

### Alta prioridade (score ≥6) — atenção imediata

| Risco ID | Cat | Descrição | P | I | Score | Mitigação | Dono | Prazo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **R-01** | **TECH** | Sem seam de teste para o gate de provisionamento BMAD → 4 de 14 casos E2E vermelhos; a camada E2E depende de rede e do CLI real a cada launch | 3 | 3 | **9** | B-1 (mudança de produto) → reabilitar as 4 vermelhas | Dev/main | pré-implementação |
| **R-02** | OPS | E2E não é gate no CI (`continue-on-error`) **e nunca executou em infra limpa** — workflow só dispara em push→`main`/PR e as branches não foram mergeadas; libs do Electron + `xvfb` no runner não-provados | 3 | 2 | **6** | Após R-01: burn-in em infra limpa → remover `continue-on-error` | Harness | 1ª sprint |
| **R-03** | OPS | Gate de cobertura fora do `verify` e vermelho em 14 pontos → "verify verde" lê como completo e não é | 3 | 2 | **6** | Limpar os 14 → `test:coverage` no `verify` → remover `continue-on-error` | Dev | 1ª sprint |
| **R-04** | TECH | Denominador de cobertura contaminado por `out/**`, `scripts/**`, `*.config.*` → global 16,3% sem significado | 3 | 2 | **6** | `coverage.exclude` saneado **antes** de qualquer meta global | Harness | imediato |
| **R-05** | BUS | Regressão visual/a11y sem gate — contraste 3,93:1 e 3,46:1 no tema claro (piso 4,5:1); reincidente em M12 **e** M12.1, sempre achada por olho humano | 3 | 2 | **6** | Automatizar o probe existente nas telas-chave, dark e light | Dev + UX | 2ª sprint |
| **R-06** | BUS | 5 features sem nenhum E2E — inclusive a jornada que prova a tese (pedir PRD → ver `PRD.md` no explorer) | 2 | 3 | **6** | Adapter scriptado injetável no binário + E2E por feature | Dev + QA | 1ª–2ª sprint |
| **R-07** | TECH | Nenhum teste de contrato contra os CLIs externos: o formato do stream JSON é contrato de fato e muda upstream sem aviso | 2 | 3 | **6** | Fixtures de stream gravadas + verificação de formato no `AgentAdapter` | Dev | 2ª sprint |
| **R-08** | DATA | Caminhos destrutivos sobre arquivos do usuário — rejeitar hunk / restaurar checkpoint (shadow-git) e escrita no vault — com defesa única | 2 | 3 | **6** | Defesa em profundidade deliberada (IPC + E2E). Execução no doc de QA | QA | 1ª–2ª sprint |
| **R-09** | SEC | Parsers de documento de origem arbitrária sem teste de arquivo malformado ou hostil; `documentReader.ts` branches 66,66%; sem `npm audit` no CI | 2 | 3 | **6** | Fixtures hostis por formato + job `npm audit` | Dev | 2ª sprint |
| **R-10** | OPS | Auto-update (npm como fonte de versão + GitHub Releases como payload) sem E2E de troca real de payload; T17/T18 bloqueados (ND-B2, sem hardware Windows) | 2 | 3 | **6** | Integração contra registry falso; apply nativo permanece manual | Dev + Produto | antes de publicar |
| **R-14** | OPS | Falha de E2E não deixa rastro — sem `trace`/`screenshot`/`video`, `retries: 0`, e `upload-artifact` do CI apontando para diretório nunca criado. É o mecanismo pelo qual as 4 vermelhas ficaram invisíveis | 3 | 2 | **6** | B-2 | Harness | imediato |
| **R-15** | TECH | 12 das 23 features shipadas sem `.specs/` → sem IDs de requisito. Os 377 IDs cobrem 11 features. Caso extremo: `FileSearchDialog.tsx` sem teste nenhum | 3 | 2 | **6** | B-4: `spec.md` mínimo retroativo | Produto | 2ª sprint |

### Prioridade média (score 4–5)

| Risco ID | Cat | Descrição | P | I | Score | Mitigação | Dono |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-11 | PERF | Whisper offline (modelo de 2,4 GB, `ort-wasm`, transcrição local) sem threshold de latência, memória ou tamanho | 2 | 2 | 4 | B-3 → benchmarks | Produto |

### Prioridade baixa (score 1–3) — monitorar

| Risco ID | Cat | Descrição | P | I | Score | Ação |
| --- | --- | --- | --- | --- | --- | --- |
| R-12 | TECH | ~35 globs de cobertura curados à mão (~200 linhas); cada feature precisa lembrar de se inscrever e já falhou uma vez | 3 | 1 | 3 | Automatizar só **após** o gate ficar verde (ordem que o §7 estipulou) |
| R-13 | TECH | `workers: 1` / `retries: 0` no Playwright — teto de throughput quando o E2E virar gate de PR | 2 | 1 | 2 | Elevar quando o smoke passar de ~12 min; exige isolamento de workspace antes |
| R-16 | TECH | `explorer-editor-ux` usa `describe.serial` sobre workspace compartilhado — observado: 1 falha de `beforeAll` apagou 6 casos | 3 | 1 | 3 | Isolar por caso via a fixture de B-1 |

**Risco residual após mitigação:** o apply nativo do update em Windows/macOS
(R-10) permanece **aceito e declarado** — sem hardware não há automação possível.
E o julgamento estético (hierarquia visual, copy) permanece humano por natureza,
não por lacuna.

**Nota deliberada:** **R-01 é a raiz de R-02, R-06 e de metade de R-08/R-10.**
Resolvê-lo destrava mais valor que qualquer outro item — e é a única mudança de
arquitetura que o plano pede.

### Legenda de categorias

**TECH** técnico/arquitetura · **SEC** segurança · **PERF** performance ·
**DATA** integridade de dados · **BUS** impacto de negócio · **OPS** operação.

---

## Requisitos de testabilidade de NFR

O que a arquitetura precisa fornecer para que a validação de NFR seja automatizável
depois. Planejamento, não veredito.

| Categoria | Threshold / requisito | Suporte atual | Lacuna / decisão | Evidência planejada |
| --- | --- | --- | --- | --- |
| **Segurança** | `contextIsolation`/`sandbox` ligados, `nodeIntegration` desligado; zero path traversal | **Bom e verificado** — três fuses asseverados, 36 asserções de escape, `sandbox="allow-scripts"` sem `allow-same-origin` no preview | Arquivo hostil nos parsers de documento; sem `npm audit` no CI. GitLeaks segue recusado (§7) e a recusa continua válida | Fixtures hostis + job `npm audit` |
| **Confiabilidade** | Falha externa degrada com mensagem e escape; nunca spinner infinito | Parcial — fail-soft do provisioning, STALE guard, fila serial por repo, verificação sha512 | Nenhum caminho de degradação exercido ponta-a-ponta; sem burn-in | Cenários de erro por adapter + relatório de burn-in |
| **Manutenibilidade** | per-file 90% nos arquivos tocados; global ≥80% | Parcial e mal medido — per-file vermelho em 14; global sem sentido (R-04) | Sanear denominador antes de fixar meta global | `test:coverage` exit 0 |
| **Acessibilidade** (`PRODUCT.md`) | Texto ≥4,5:1; texto grande/ícones ≥3:1; teclado completo; `prefers-reduced-motion` | Probe de contraste existe e amostra pixel real | Não é gate nem varre telas; teclado e motion sem sensor | Passe de contraste automatizado dark+light |
| **Performance** | **UNKNOWN** | Nada medido | Ver B-3. **k6 é inadequado** — sem HTTP, RPS ou carga concorrente; a medição certa é in-process no Electron | Bloqueado até B-3 |
| **Portabilidade** | Install + apply funcionam em Windows real; sha512 verificado | sha512 testado contra registry falso; NSIS é o único apply | Windows real (ND T18) e publish (ND-B2) bloqueados | Manual, assinatura humana |

**Thresholds UNKNOWN → itens de clarificação, não valores inventados:** latência de
transcrição; teto de memória com modelo carregado; tempo de abertura de documento
grande; tempo de boot.

**Fronteira:** o veredito PASS/CONCERNS/FAIL com evidência pertence a
`bmad-testarch-nfr`. Por regra do `nfr-criteria.md`, threshold ausente nunca é PASS
— logo Performance permanece CONCERNS por definição, não por omissão.

---

## Preocupações de testabilidade e lacunas arquiteturais

### 🚨 Bloqueadores de feedback rápido (o que a arquitetura precisa fornecer)

| Preocupação | Impacto no teste | O que a arquitetura precisa fornecer | Dono | Prazo |
| --- | --- | --- | --- | --- |
| **Controlabilidade: sem bypass do gate de provisionamento** | 4 de 14 casos dão timeout esperando a work UI. Um teste de multi-seleção de arquivos depende de rede | Seam honrado: `updateBmad()` respeitando estado semeado, ou flag explícita de ambiente (**B-1**) | Dev/main | pré-implementação |
| **Diagnóstico: falha de E2E não deixa rastro** | Reparar sem trace é tentativa e erro; já custou 4 specs invisíveis por tempo indeterminado | `trace`/`screenshot`/`video`/`retries` + reporter html + caminho correto no `upload-artifact` (**B-2**) | Harness | imediato |
| **Turno de agente não injetável no binário** | A jornada que prova a tese do produto não tem E2E | Injeção de adapter scriptado por env var ou entrada de registry | Dev/agent-adapter | pré-implementação |
| **Injeção de falha inalcançável do E2E** | Os caminhos de degradação que o produto promete não são exercidos | Pontos de injeção no app buildado: CLI ausente, git falha, rede cai, modelo corrompido | Dev | 2ª sprint |

### Melhorias arquiteturais necessárias

1. **Escopo do relatório de cobertura (R-04)**
   - **Problema:** instrumenta `out/main/index.js`,
     `out/renderer/assets/transformers.web*`, `out/renderer/ort/*.mjs`,
     `scripts/*.mjs` e os `*.config.ts` — ~100 mil statements a 0%, produzindo
     global de 16,3%.
   - **Mudança:** `coverage.exclude` cobre `out/**`, `scripts/**`, `*.config.ts`.
   - **Impacto se não corrigir:** qualquer meta agregada mede o tamanho do bundle.
   - **Dono:** Harness · **Prazo:** imediato (minutos)

2. **Isolamento por caso no único spec multi-caso (R-16)**
   - **Problema:** `describe.serial` sobre workspace compartilhado no spec com mais
     casos (8) e que mais falha. Observado: falha de `beforeAll` apagou 6 casos.
   - **Mudança:** um workspace por caso, via a fixture de B-1.
   - **Impacto se não corrigir:** a suíte reporta 1 falha onde há 7 incógnitas.
   - **Dono:** QA · **Prazo:** junto com B-1

3. **Repetição obrigatória do `dedupe` de React**
   - **Problema:** `@hive/design-system` é link `file:` com React físico próprio.
     Já causou crash de React duplicado e "invalid hook call"; hoje corrigido por
     `dedupe` em **dois** configs independentes.
   - **Mudança:** guard que falhe se um config novo não o declarar.
   - **Impacto se não corrigir:** um terceiro config futuro repete o bug.
   - **Dono:** Dev · **Prazo:** 2ª sprint

---

## Resumo da avaliação de testabilidade

### O que funciona bem

- **Observabilidade forte:** fronteiras IPC tipadas (`window.hive`);
  `moduleBoundaries.test.ts` falha se alguém atravessar; `noInlineStrings.test.ts`
  garante copy via `t()`; o probe de contraste amostra pixel real. Asserções
  determinísticas são viáveis nos três níveis.
- **Asserção em disco, não na UI:** os E2E verificam bytes em disco após cada
  passo. Para um produto cujo valor é mexer nos arquivos do usuário, é o nível
  correto — e é o ativo mais valioso da suíte atual.
- **Git de verdade em diretórios temporários** e remote bare local no E2E de git.
  Nenhum mock de git: parsers por fixture pura, serviço contra o CLI real.
- **Postura de segurança testada, não só afirmada** — três fuses do Electron, 36
  asserções de escape/traversal, sandbox do iframe de preview.
- **Injeção de dependência onde importa:** `processRunner`, probe de MCP, adapters
  scriptáveis, registry falso.
- **Mocks de fronteira fatorados** em `testSupport/`, a 100% de cobertura.
- **Test-hooks sancionados em produção** onde a automação não alcança
  (`window.hive.fs.importEntry`, design.md §8). **É o precedente que legitima B-1.**
- **Suíte rápida:** 1589 testes em ~21 s mantém o loop in-session vivo.

### Trade-offs aceitos (nenhuma ação necessária)

- **k6 fora por inadequação, não economia.** Sem HTTP, RPS ou carga concorrente.
- **Pact fora:** sem fronteira de serviço versionada. O contrato interno (IPC) já
  tem guardiões; o externo que de fato falta é o stream dos CLIs (R-07), e ali a
  mitigação certa é fixture gravada, não broker.
- **Secret scanning e mutation testing continuam fora** — as recusas do §7 seguem
  válidas e este plano **não** as contesta. Ambas têm gatilho registrado.
- **Julgamento estético continua humano.** Automatizar contraste (objetivo) não
  automatiza hierarquia visual nem copy.
- **Windows/macOS real fica manual** (ND T18). Aceito com data de revisão.

---

## Planos de mitigação (riscos ≥6 de responsabilidade de Arquitetura/Dev)

As mitigações de responsabilidade de QA (R-05 execução, R-08, e a parte de teste de
R-06/R-09/R-10) estão no `test-design-qa.md`.

### R-01: Sem seam de teste para o gate de provisionamento (Score 9) — BLOQUEADOR

**Estratégia:**

1. **B-2 primeiro** (instrumentar o Playwright) — sem trace, o passo 3 é
   adivinhação.
2. Implementar o seam (**B-1**): `updateBmad()` honra estado semeado, ou flag
   explícita de ambiente.
3. Reabilitar as 4 vermelhas sobre o seam, uma a uma, com trace em mão.
4. Isolar `explorer-editor-ux` por caso (R-16).
5. Burn-in em infra limpa (R-02) → remover `continue-on-error`.

**Dono:** Dev/main (passo 2), Harness (1, 5), QA (3, 4) · **Prazo:** antes de
qualquer release · **Status:** Planejado
**Verificação:** os 14 casos verdes em 10 execuções consecutivas no CI, sem
`continue-on-error`, com trace recuperável do artefato.
**Restrição de projeto:** o seam contorna o provisionamento real; **um** spec
dedicado continua atravessando `npx bmad-method install` de verdade no nightly. O
seam não pode apagar a cobertura do caminho que ele contorna.

### R-02: E2E sem gate e nunca executado em infra limpa (Score 6)

**Estratégia:** após R-01, rodar o job em infra limpa e provar as duas incógnitas
do runner (libs do Electron via `apt-get`, `xvfb-run`) → burn-in → remover
`continue-on-error`.
**Dono:** Harness · **Prazo:** 1ª sprint · **Status:** Planejado
**Verificação:** 10 execuções verdes no runner do GitHub, não na máquina do dev.

### R-03 + R-04: Cobertura mal medida e sem gate (Score 6 cada)

**Estratégia:** sanear `coverage.exclude` (minutos) → limpar os 14 pontos em ordem
de esforço crescente (`preload` F → `WorkUI` F → `Chat` B → `Explorer` → viewers)
→ incluir `test:coverage` no `verify` e remover `continue-on-error` → **só então**
fixar meta global ≥80%.
**Dono:** Harness (R-04) + Dev (R-03) · **Prazo:** 1ª sprint · **Status:** Planejado
**Verificação:** `npm run test:coverage` exit 0 e o global passa a significar algo.

### R-06: Turno de agente não injetável (Score 6 — parte arquitetural)

**Estratégia:** ponto de injeção de adapter scriptado no app buildado (env var ou
entrada de registry). A escrita dos E2E é de QA.
**Dono:** Dev/agent-adapter · **Prazo:** pré-implementação · **Status:** Planejado
**Verificação:** o E2E consegue rodar um turno sem o CLI real instalado.

### R-07: Sem contract test contra os CLIs externos (Score 6)

**Estratégia:** gravar fixtures do stream JSON real de cada CLI → teste que falha
se o formato divergir → rodar no nightly com o CLI real quando disponível.
**Dono:** Dev · **Prazo:** 2ª sprint · **Status:** Planejado
**Verificação:** alterar um campo da fixture reprova o teste.

### R-09: Parsers de documento sem teste de arquivo hostil (Score 6)

**Estratégia:** fixtures malformadas/hostis por formato, e zip com entrada de path
traversal (`jszip` é a superfície) → `documentReader` rejeita com erro tratado sem
derrubar o `main` → `npm audit` no nightly.
**Dono:** Dev · **Prazo:** 2ª sprint · **Status:** Planejado
**Verificação:** branches de `documentReader.ts` ≥90% e nenhum crash do `main`.

### R-10: Auto-update sem E2E de troca de payload (Score 6)

**Estratégia:** integração contra registry falso cobrindo descoberta → download →
verificação sha512 → apply. O apply nativo permanece manual e **risco aceito e
declarado** até haver hardware.
**Dono:** Dev + Produto · **Prazo:** antes de publicar · **Status:** Planejado
**Verificação:** o app sobe na nova versão no cenário de integração.

### R-14: Falha de E2E não deixa rastro (Score 6)

**Estratégia:** B-2 — `trace: 'retain-on-failure'`,
`screenshot: 'only-on-failure'`, `video`, `reporter: [['list'],['html']]`,
`retries: 1` no CI, e corrigir o caminho do `upload-artifact`.
**Dono:** Harness · **Prazo:** imediato · **Status:** Planejado
**Verificação:** falha proposital no CI produz trace baixável.

### R-15: 12 features sem IDs de requisito (Score 6)

**Estratégia:** B-4 — `spec.md` mínimo retroativo (requisitos + IDs, sem
re-planejar). Sem isso, `bmad-testarch-trace` não tem de onde partir.
**Dono:** Produto · **Prazo:** 2ª sprint · **Status:** Planejado
**Verificação:** toda feature do inventário tem prefixo de ID e todo ID tem ao
menos um teste.

---

## Premissas e dependências

### Premissas (arquiteturais)

1. As branches de feature não mergeadas (`feat/git-management`,
   `feat/agent-change-review`, `feat/second-brain`) serão integradas antes de o
   pacote de regressão ser considerado linha de base. Enquanto vivem separadas,
   "regressão" tem baselines concorrentes — **e o CI nunca rodou, porque só dispara
   em push→`main`/PR**.
2. `Node 22.22.1` é piso rígido; o CI já pina por `.nvmrc`.
3. `@hive/design-system` continua como link `file:`, não pacote publicado — logo o
   `dedupe` de React continua obrigatório em todo config novo.
4. A topologia de três camadas do Electron não muda; o contrato IPC
   (`window.hive`) continua sendo a fronteira testável.

### Dependências

1. **B-1** (seam de teste) — mudança de produto. Necessária para reabilitar 4 casos
   e para 5 features ganharem E2E.
2. **B-2** (instrumentação) — necessária **antes** de B-1, para que o reparo seja
   diagnóstico e não tentativa.
3. **B-3** (thresholds de performance) — necessária para os benchmarks.
4. **B-4** (IDs retroativos) — necessária para a matriz de rastreabilidade.
5. **Hardware Windows/macOS** — necessário para ND T18.
6. **Token GitHub** (ND-B2) — necessário para o publish de release asset.
7. **Uma execução com os CLIs de agente reais** — necessária uma única vez, para
   gravar as fixtures de R-07.

### Riscos ao próprio plano

- **Risco:** o seam de B-1 torna as 4 vermelhas verdes **sem provar nada** sobre o
  caminho real de instalação — justamente onde elas hoje falham.
  - **Impacto:** falsa sensação de reparo.
  - **Contingência:** um spec dedicado continua atravessando o provisionamento real
    no nightly, com burn-in.
- **Risco:** ~58 cenários é um lote grande; entregue de uma vez, chega depois de já
  ter apodrecido.
  - **Impacto:** o plano vira documento, não trabalho.
  - **Contingência:** B-1 + B-2 + saneamento de cobertura + os 12 cenários P0
    (~1–2 semanas) já entregam a rede de regressão. É o MVP; o resto é incremento.
- **Risco:** este plano toca itens que o `HARNESS.md` §7 recusou deliberadamente.
  - **Impacto:** re-propor o que já foi decidido é ruído.
  - **Contingência:** cada recusa foi mantida **com o gatilho original respeitado**.
    A única que este plano revisita é a **linha de escopo** do R-09, e ela é
    ortogonal a segredos — o §7 recusou secret scanning, não teste de arquivo
    hostil.

---

## Decisão de portão hoje: FAIL

Por **R-01** (score 9, OPEN). O motor de decisão do `risk-governance.md` é
determinístico: qualquer risco score 9 em estado OPEN reprova.

Trajetória esperada: B-1 + B-2 + saneamento de cobertura → **CONCERNS** (11 riscos
em score 6, todos com plano e dono) → E2E verde em infra limpa por 10 execuções →
**PASS**.

---

**Próximos passos — Arquitetura:** decidir B-1..B-4 (**só B-1 exige mudança de
produto**); confirmar donos e prazos dos 12 riscos ≥6; validar a premissa 1
(branches não mergeadas + CI nunca executado); devolver retorno sobre as lacunas de
controlabilidade.

**Próximos passos — QA:** começar pela camada de integração IPC, que não depende de
B-1; seguir `test-design-qa.md`; rodar `bmad-testarch-trace` após B-4.
