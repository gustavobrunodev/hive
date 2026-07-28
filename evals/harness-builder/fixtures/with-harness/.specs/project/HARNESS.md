# Harness — orders-api

O que **guia** o agente, o que o **mede**, e o que deliberadamente **não
existe**. Produzido pelo `harness-builder` em 2026-05-10.

**Memória viva, não arquivo morto.** Atualize aqui mesmo quando um controle for
adicionado, removido ou reajustado — inclusive como efeito colateral de trabalho
normal de feature.

## 1. Contexto

- **Projeto:** `orders-api` — serviço Node + TypeScript de entrada de pedidos.
- **Stack & harnessability:** TypeScript (sem `strict`), sem fronteiras de módulo
  declaradas, Vitest. Greenfield.
- **Categorias em escopo:** manutenibilidade.
- **Agentes-alvo:** Claude Code.

## 2. O que guia e o que mede o agente

| Controle | Direção | Execução | Categoria | Stage | Gate? | O que impõe |
| --- | --- | --- | --- | --- | --- | --- |
| ESLint (`js.configs.recommended`) | feedback | comput. | manut. | in-session | sim | só o preset padrão — nenhuma regra anti-sprawl |
| `tsc` | feedback | comput. | manut. | in-session | sim | **sem `strict`** — o sensor mais barato está subaproveitado |
| Vitest | feedback | comput. | comportamento | in-session | sim | 1 teste |
| `AGENTS.md` | feedforward | inferencial | cross | in-session | — | comandos + ponteiro de memória |

## 2b. Piso de higiene

| ID | Controle | Status | Evidência |
| --- | --- | --- | --- |
| **CI-04** | Pre-commit instalado | ✗ | nenhum hook runner |
| **HYG-02** | `.gitignore` cobre `.env` e `.env.*` | ✓ | corrigido em 2026-05-10 |
| **HYG-08** | Credenciais MCP via `${ENV_VAR}` | n/a | não há MCP versionado |

## 3. Mapa de cobertura

| Categoria \ Stage | In-session | Pre-commit | CI | Contínuo | Runtime |
| --- | --- | --- | --- | --- | --- |
| Manutenibilidade | ESLint, tsc | — | — | — | — |
| Arquitetura | — | — | — | — | — |
| Comportamento | Vitest | — | — | — | — |

## 4. Achados

- **[Gap] `tsc` sem `strict`** — o sensor mais forte de graça está desligado.
- **[Timing] Nada roda fora da sessão** — sem pre-commit, sem CI.

## 5. Recomendações priorizadas

### P1 — Ligar `strict` no tsconfig
- **Tipo:** sensor · computacional · **Stage:** in-session · gate
- **Esforço:** S

## 5b. Change log

### 2026-05-10 — primeira passada

| # | Mudança | Onde |
| --- | --- | --- |
| — | `.env` / `.env.*` no `.gitignore` (HYG-02) | `.gitignore` |

**Verificação:** `npm run verify` verde.

## 6. Steering loop

- **Observar:** lições do `STATE.md` que reincidem.
- **Adicionar quando:** uma falha reincidir pela 2ª vez.

## 7. O que deliberadamente não existe

| Controle | Por que não | Reavaliar quando |
| --- | --- | --- |
| **Mutation testing (Stryker)** | Avaliado em 2026-05-10 e **recusado**: a suíte tem 1 teste. Mutation score mediria uma fraqueza que já é óbvia, a ~15 min por rodada. Escrever testes primeiro. | A suíte cobrir os caminhos principais e um teste verde esconder um bug |
| **AI code review no CI** | Sem CI para pendurar, e o custo por PR é real num repo de 2 arquivos. | Existir CI e o volume de PR justificar |
| **Secret scanning** | Sem segredos e sem deploy — não há o que vazar. | Primeira credencial, ou primeiro deploy |

**Limites honestos:** 1 teste não diz nada sobre comportamento. Nenhum controle
aqui pega diagnóstico errado ou over-engineering.
