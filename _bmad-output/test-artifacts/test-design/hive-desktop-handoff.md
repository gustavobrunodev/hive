---
title: 'TEA Test Design → BMAD Handoff Document'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments:
  - '_bmad-output/test-artifacts/test-design-architecture.md'
  - '_bmad-output/test-artifacts/test-design-qa.md'
  - '_bmad-output/test-artifacts/test-design-progress.md'
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-07-29'
projectName: 'hive-desktop'
---

# TEA → BMAD Integration Handoff

## Propósito

Este documento faz a ponte entre as saídas do test design e a decomposição em
épicos/histórias do BMAD (`bmad-create-epics-and-stories`). Ele carrega os
requisitos de qualidade, a avaliação de risco e a estratégia de teste para dentro
do planejamento de implementação.

**Nota de contexto deste projeto:** o `hive-desktop` não usa artefatos BMM
(`planning-artifacts/`); usa o padrão `tlc-spec-driven` em `.specs/`. Portanto o
consumidor natural deste handoff **não** é `create-epics-and-stories`, mas
`tlc-spec-driven` — os "épicos" abaixo devem virar features em
`.specs/features/<nome>/` com `spec.md`/`design.md`/`tasks.md`, e as histórias
viram tarefas atômicas com critério de verificação. A estrutura de guidance é a
mesma; só o destino muda.

## Inventário de artefatos TEA

| Artefato | Caminho | Ponto de integração BMAD |
| --- | --- | --- |
| Test design — arquitetura | `_bmad-output/test-artifacts/test-design-architecture.md` | Bloqueadores e riscos ≥6 como quality gates de épico |
| Test design — QA | `_bmad-output/test-artifacts/test-design-qa.md` | Cenários P0/P1 como critérios de aceite de história |
| Registro de progresso e evidência | `_bmad-output/test-artifacts/test-design-progress.md` | Medições próprias (linha de base) e decisões do workflow |
| Avaliação de risco | embutida no doc de arquitetura | Classificação de risco de épico e prioridade de história |
| Estratégia de cobertura | embutida no doc de QA | Requisitos de teste por história |

## Guidance de integração em nível de épico

### Referências de risco

Riscos que devem aparecer como **quality gates de épico**:

| Risco | Score | Gate de épico que ele impõe |
| --- | --- | --- |
| **R-01** — sem seam de teste para o gate de provisionamento BMAD | **9** | **Nenhum épico que toque E2E pode ser aceito antes deste.** É a raiz de R-02, R-06 e de metade de R-08/R-10 |
| R-02 — E2E sem gate e nunca executado em infra limpa | 6 | Épico de harness só fecha com 10 execuções verdes no runner, não na máquina do dev |
| R-03/R-04 — cobertura mal medida e fora do `verify` | 6 | `test:coverage` exit 0 e dentro do `verify` |
| R-05 — regressão visual/a11y sem gate | 6 | Contraste ≥4,5:1 nos dois temas, automatizado |
| R-06 — 5 features sem nenhum E2E | 6 | Todo épico de feature entrega ao menos um caminho E2E |
| R-07 — sem contract test contra CLIs externos | 6 | Épico de adapter fecha com fixtures de stream gravadas |
| R-08 — caminhos destrutivos com defesa única | 6 | Toda operação destrutiva com defesa em profundidade (IPC + E2E) |
| R-09 — parsers de documento sem arquivo hostil | 6 | `documentReader` branches ≥90% e zero crash do `main` |
| R-10 — auto-update sem E2E de troca de payload | 6 | Épico de distribuição não fecha sem o cenário de integração |
| R-14 — falha de E2E não deixa rastro | 6 | Trace recuperável do artefato do CI |
| R-15 — 12 features sem IDs de requisito | 6 | Toda feature no roadmap com prefixo de ID rastreável |

### Quality gates recomendados por épico

| Épico proposto | Gate de entrada | Gate de saída |
| --- | --- | --- |
| **E1 — Rede de regressão** (B-1, B-2, saneamento de cobertura) | Nenhum — é o primeiro | E2E verde 10×, `test:coverage` exit 0, trace recuperável |
| **E2 — Caminhos destrutivos** | E1 fechado | Toda operação destrutiva com IPC + E2E asseverando disco |
| **E3 — Features sem E2E** (chat-controls, agent-selection, npm-distribution, role-personalization, jornada da tese) | E1 fechado | Um caminho E2E por feature, `@p0` no smoke de PR |
| **E4 — Superfície de arquivo hostil** | — (independente) | `documentReader` branches ≥90%, zip traversal coberto, `npm audit` no nightly |
| **E5 — a11y computacional** | — (independente) | Contraste gateado nos dois temas; teclado e reduced-motion cobertos |
| **E6 — Rastreabilidade retroativa** | — (independente) | 12 `spec.md` mínimos escritos; `bmad-testarch-trace` roda |
| **E7 — Performance** | B-3 respondido | Benchmarks com threshold definido |

## Guidance de integração em nível de história

### Cenários P0/P1 que **precisam** ser critérios de aceite

| Cenário | Critério de aceite que ele se torna |
| --- | --- |
| P0-001 | "O app sobe até a work UI sem executar `npx bmad-method install`" |
| P0-002 | "Uma falha de E2E produz trace, screenshot e vídeo recuperáveis do artefato do CI" |
| P0-003 | "Pedir um PRD ao agente faz `PRD.md` aparecer no explorer e abrir" |
| P0-004 | "Os 14 casos E2E passam, com um workspace por caso" |
| P0-005 | "Rejeitar um hunk do agente não perde alteração vizinha aceita" |
| P0-006 | "Restaurar um checkpoint não apaga arquivo criado pelo usuário fora do escopo do agente" |
| P0-007 | "Falha no meio da escrita do vault não deixa nota corrompida" |
| P0-008 | "Documento malformado é rejeitado com erro tratado, sem crash do processo main" |
| P0-009 | "Zip com entrada `../` não escreve fora do destino" |
| P0-010 | "Toda tela-chave tem contraste ≥4,5:1 nos temas dark e light" |
| P0-011 | "`npm run test:coverage` sai com código 0 e está dentro do `verify`" |
| P0-012 | "Aplicar o update baixado troca o payload e o app sobe na nova versão" |
| P1-004 | "Cada passo do onboarding tem teste de componente próprio" |
| P1-021 | "Uma mudança no formato do stream do CLI reprova o build" |
| P1-022 | "Toda falha externa mostra mensagem pt-BR com escape — nunca spinner infinito" |

### Requisitos de `data-testid` para testabilidade

O projeto já tem âncoras estáveis (`id="rail"`, atributos `data-tour`). O que
falta para os cenários novos:

| Superfície | Âncora recomendada | Cenário que precisa |
| --- | --- | --- |
| Pills de intenção do hero | `data-testid="intent-<slug>"` | P0-003 |
| Ações de hunk (✓/✗) | `data-testid="hunk-accept\|reject"` | P0-005 |
| Barra de revisão | `data-testid="review-bar"` | P1-018 |
| Passos do onboarding | `data-testid="onboarding-step-<nome>"` | P0-015, P1-004 |
| Diálogo de busca `Ctrl+P` | `data-testid="file-search"` | P1-024 |
| Estados do update (dot/notice/center) | `data-testid="update-<tier>"` | P1-016 |
| Card de health do vault | `data-testid="vault-health"` | P2-010 |

**Convenção a manter:** preferir papel acessível (`getByRole`) quando existir — é
mais resiliente e valida a11y de graça (`selector-resilience.md`). `data-testid`
só onde papel não distingue.

## Mapa risco → história

| Risco ID | Cat | P×I | Épico/feature recomendado | Nível de teste |
| --- | --- | --- | --- | --- |
| R-01 | TECH | 3×3=**9** | E1 — Rede de regressão (**mudança de produto**) | E2E infra |
| R-02 | OPS | 3×2=6 | E1 — Rede de regressão | CI |
| R-03 | OPS | 3×2=6 | E1 — Rede de regressão | Unit + CI |
| R-04 | TECH | 3×2=6 | E1 — Rede de regressão | Infra |
| R-05 | BUS | 3×2=6 | E5 — a11y computacional | Visual autom. |
| R-06 | BUS | 2×3=6 | E3 — Features sem E2E | E2E |
| R-07 | TECH | 2×3=6 | E3 — Features sem E2E (adapter) | Unit |
| R-08 | DATA | 2×3=6 | E2 — Caminhos destrutivos | IPC + E2E |
| R-09 | SEC | 2×3=6 | E4 — Arquivo hostil | Unit |
| R-10 | OPS | 2×3=6 | E3 — Features sem E2E (distribuição) | Integração |
| R-11 | PERF | 2×2=4 | E7 — Performance | Bench |
| R-12 | TECH | 3×1=3 | E1 (backlog, após gate verde) | Infra |
| R-13 | TECH | 2×1=2 | E1 (backlog) | CI |
| R-14 | OPS | 3×2=6 | E1 — Rede de regressão | Infra |
| R-15 | TECH | 3×2=6 | E6 — Rastreabilidade retroativa | Doc + Comp |
| R-16 | TECH | 3×1=3 | E1 — Rede de regressão | E2E |

## Sequência recomendada BMAD ↔ TEA

1. **TEA Test Design** (`bmad-testarch-test-design`) → produz este handoff ✅ **feito**
2. **Decisão dos bloqueadores B-1..B-4** — humana, e é o gargalo real
3. **`tlc-spec-driven`** (no lugar de `create-epics-and-stories`, ver nota de
   contexto) → E1..E7 como features com `spec.md`/`design.md`/`tasks.md`
4. **TEA ATDD** (`bmad-testarch-atdd`) → scaffolds red-phase para os cenários P0
5. **Implementação** — B-1 é a única que mexe em produto; o resto é teste
6. **TEA Automate** (`bmad-testarch-automate`) → expandir para P1/P2
7. **TEA Trace** (`bmad-testarch-trace`) → matriz de rastreabilidade (**exige B-4
   antes**, senão 12 features não têm ID de onde partir)
8. **TEA NFR** (`bmad-testarch-nfr`) → veredito PASS/CONCERNS/FAIL, quando houver
   evidência

## Quality gates de transição de fase

| De | Para | Critério de gate |
| --- | --- | --- |
| Test Design | Decisão de bloqueadores | ✅ 16 riscos com score, dono sugerido e mitigação |
| Decisão de bloqueadores | Criação de features | B-1 e B-2 decididos; B-3/B-4 respondidos ou lacuna aceita por escrito |
| Criação de features | ATDD | Features com critério de aceite derivado dos cenários P0 |
| ATDD | Implementação | Testes de aceite falhando existem para todos os cenários P0 |
| Implementação | Automação de teste | Todos os testes de aceite passam; **R-01 deixou de ser score 9** |
| Automação de teste | Release | Matriz de trace ≥80% dos requisitos P0/P1; `test:coverage` exit 0; E2E verde 10× em infra limpa |

## Decisão de portão hoje: **FAIL**

Por **R-01** (score 9, OPEN). O motor de decisão do `risk-governance.md` é
determinístico: qualquer risco score 9 em estado OPEN reprova o gate.

Trajetória esperada: B-1 + B-2 + saneamento de cobertura → **CONCERNS** (11 riscos
em score 6, todos com plano e dono) → E2E verde em infra limpa por 10 execuções →
**PASS**.
