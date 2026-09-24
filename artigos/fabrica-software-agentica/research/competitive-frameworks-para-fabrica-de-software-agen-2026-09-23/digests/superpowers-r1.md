---
title: "Superpowers v6.4.1 — digest técnico para fábricas de software agênticas"
project: "obra/superpowers"
research_type: "technical + competitive teardown"
status: complete
corpus: "/tmp/agentic-framework-research.z4Te2Y/superpowers"
commit: "5bf4e78011075bcfc0dc295f0724994cd123ee71"
release: "v6.4.1"
accessed: "2026-09-23"
---

# Superpowers v6.4.1 — digest técnico

## Veredito para o artigo

Superpowers é melhor descrito como um **kernel portátil de método de desenvolvimento para agentes de código**, não como uma fábrica de software completa nem como um control plane multi-equipe. O produto central é uma coleção de 15 skills em Markdown, acionadas por um bootstrap ou pela descoberta nativa do harness, que encadeiam descoberta, design, planejamento, isolamento em worktree, implementação TDD, revisão e integração. O próprio projeto o define como “complete software development methodology” construída sobre skills componíveis (`README.md:3`; `README.md:307-323`).

Seu diferencial competitivo é a combinação de:

- disciplina comportamental explícita, com TDD, investigação de causa raiz e “evidência antes de afirmações” (`README.md:366-371`; `skills/test-driven-development/SKILL.md:31-45`; `skills/verification-before-completion/SKILL.md:14-35`);
- dois perfis de execução: SDD, com agente implementador e revisor frescos por tarefa; e Native/inline, mais barato, com uma única revisão fresca ao final (`skills/writing-plans/SKILL.md:167-192`);
- engenharia de contexto baseada em arquivos: brief por tarefa, report do implementador, pacote de diff, log de testes e ledger por plano (`skills/subagent-driven-development/SKILL.md:131-160,231-282,308-352`);
- uma camada fina de adaptação por harness, preservando o mesmo corpo de skills (`docs/porting-to-a-new-harness.md:31-55`).

Para uma comparação de “fábricas”, a ressalva decisiva é: **Superpowers governa como um agente deve trabalhar dentro de uma sessão/branch, mas não evidencia um serviço de orquestração organizacional, fila de trabalho, backlog, policy engine central, observabilidade de frota ou coordenação entre repositórios.** Seus gates mais fortes são locais. Alguns são realmente executáveis — `task-done` não registra uma tarefa se o comando falhar e `review-package` rejeita ranges vazios ou não descendentes —, mas aprovações, ordem do TDD, aderência ao plano e severidade de review continuam dependendo de o modelo seguir as instruções em Markdown.

## Snapshot reprodutível do corpus

| Item | Resultado em 2026-09-23 | Evidência |
|---|---:|---|
| Remote | `https://github.com/obra/superpowers.git` | `git remote -v` no clone |
| Commit | `5bf4e78011075bcfc0dc295f0724994cd123ee71` | `git rev-parse HEAD` |
| Data do commit | `2026-09-18T17:31:35-07:00` | `git show -s --format=%cI HEAD` |
| Tag/release | `v6.4.1`; tag anotada `b92c4fa…` aponta para `5bf4e78…` | `git tag`; `git ls-remote` oficial |
| Estado remoto atual | `refs/heads/main` também aponta para `5bf4e78…` | `git ls-remote` em 2026-09-23 |
| Profundidade do clone | 1 commit disponível | `git rev-list --count HEAD` |
| Arquivos rastreados | 231 | `git ls-files \| wc -l` |
| Estrutura por extensão | 119 `.md`, 45 `.sh`, 16 `.json`, 11 `.js`, 6 `.py`, 4 `.mjs`, 2 `.ts`, 2 `.yml`, 2 `.yaml`; demais formatos minoritários | inventário `find`, excluindo `.git/` |
| Skills | 15 diretórios; 3.876 linhas somadas nos `SKILL.md` | `skills/*/SKILL.md` |
| Testes no clone | 66 arquivos; 54 fontes `.sh/.js/.mjs/.py`; 9.540 linhas | `tests/` |
| Documentação | 45 arquivos em `docs/`, dos quais 20 planos e 20 specs históricas | `docs/` |
| Manifests versionados | 11 caminhos no registro de bump | `.version-bump.json:2-13` |
| Release metadata | `RELEASE-NOTES.md` cobre v2.0.0 até v6.4.1; v6.4.0 não foi publicado | `RELEASE-NOTES.md:3-7,1229-1459` |

O clone é raso; portanto, não suporta análise de cadência por commit nem evolução de autoria. A cronologia abaixo usa o `RELEASE-NOTES.md` do próprio release, não inferências sobre um histórico Git ausente.

### Validação local executada

Foram executados seis conjuntos determinísticos, todos com exit code 0:

- `tests/claude-code/test-sdd-workspace.sh`: 24 checks passaram, incluindo colisão de planos, isolamento por worktree e rejeição de ranges inválidos;
- `tests/claude-code/test-executing-plans-scripts.sh`: 10 checks passaram, incluindo “falha não registra conclusão”;
- `tests/hooks/test-session-start.sh`: 6 checks passaram;
- `tests/diagnosing-superpowers/test-skill-structure.sh`: 46 checks passaram;
- `tests/shell-lint/test-lint-shell.sh`: 18 checks passaram;
- `tests/systematic-debugging/test-find-polluter.sh`: 5 checks passaram.

Esses resultados validam os helpers no ambiente da pesquisa; não equivalem a rodar todos os testes de plugin, nem os evals de comportamento de LLM.

## Arquitetura conceitual

```text
bootstrap / descoberta nativa de skills
        ↓
using-superpowers (seleção obrigatória de skill)
        ↓
brainstorming ── spike → probe/recomendação
        │       └ bounded → design curto em chat → implementação
        └ architectural → spec escrita + aprovação humana
                                ↓
                         writing-plans
                                ↓
                  plano + constraints + interfaces
                         + review focus
                                ↓
                  worktree + baseline de testes
                                ↓
              ┌─────────────────┴─────────────────┐
              │                                   │
      SDD: subagente/tarefa                Native: autor inline
      + review por tarefa                  + TDD por tarefa
      + review final                       + review final
              └─────────────────┬─────────────────┘
                                ↓
               suíte → merge / PR / manter branch
```

Não há um runtime monolítico. A arquitetura é **conteúdo comportamental + adaptadores de harness + pequenos helpers determinísticos**:

1. `skills/` é a fonte de verdade agnóstica de harness (`docs/porting-to-a-new-harness.md:31-41`).
2. Referências ou manifestos traduzem ações como “dispatch a subagent” para ferramentas concretas (`docs/porting-to-a-new-harness.md:43-47`).
3. Hooks/plugins/instructions files colocam `using-superpowers` no contexto, exceto no caso Codex moderno, que deliberadamente usa descoberta/trigger nativos e declara `hooks: {}` (`.codex-plugin/plugin.json:23-24`; `RELEASE-NOTES.md:136-157`).
4. Scripts shell materializam apenas partes críticas do fluxo: workspace, task brief, review package e conclusão testada.

Essa forma reduz acoplamento ao vendor, mas também significa que o “orquestrador” principal é o próprio modelo seguindo texto.

## Fluxo discover → plan → implement → verify → review

| Etapa | Como funciona | Artefatos | Gate | Natureza do gate |
|---|---|---|---|---|
| Discover/design | `brainstorming` primeiro descobre intenção e classifica em spike, bounded ou architectural (`skills/brainstorming/SKILL.md:14-36,58-88`). | Spike: probe; bounded: design em chat; architectural: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` (`:129-138,237-265`). | Aprovação humana específica por estágio (`:38-56`). | Humano + instrução ao modelo. |
| Plan | `writing-plans` decompõe em tarefas com passos de 2–5 min, código concreto, `Global Constraints`, `Review Focus`, `Interfaces` e comandos/saídas esperadas (`skills/writing-plans/SKILL.md:36-52,54-141`). | `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` (`:18-19`). | Self-review do plano e review humano do arquivo salvo antes de executar (`:153-192`). | Modelo + humano; não há parser/validator do plano. |
| Implement | Worktree isolada, setup e baseline (`skills/using-git-worktrees/SKILL.md:16-45,102-139`). O usuário escolhe SDD ou Native. | Commits por tarefa; workspace `.superpowers/sdd/<plan>/`; ledger, briefs, reports, diffs e logs. | SDD: review por tarefa; Native: TDD + `task-done`; quatro classes de stop explícitas. | Híbrido. |
| Verify | TDD RED→GREEN→REFACTOR, suíte do projeto e verificação fresca antes de claims (`skills/test-driven-development/SKILL.md:31-69,113-193`; `skills/verification-before-completion/SKILL.md:14-35`). | Testes, saída/log de testes, linha de conclusão no ledger. | `task-done` grava apenas após exit 0; finalização roda suíte completa. | Parte determinística, parte comportamental. |
| Review | SDD usa reviewer fresco por tarefa com veredictos de spec e qualidade, fix-loop e review de branch; Native compra apenas o review de branch (`skills/subagent-driven-development/SKILL.md:308-443,445-469`; `skills/executing-plans/SKILL.md:234-289`). | Review package (`git log`, stat, diff), findings, fix reports, rulings. | Critical/Important entram no loop; Minor é deferido; loop SDD limita a 5 rounds. | Modelo-revisor + regras de severidade; range do diff é validado por script. |
| Finish | Suíte completa, detecção do ambiente e decisão humana entre merge local, PR ou manter (`skills/finishing-a-development-branch/SKILL.md:14-82`). | Branch/PR/merge; worktree eventualmente removida. | Suíte verde antes do menu; descarte exige pedido e confirmação literal `discard` (`:132-157`). | Comando real + decisão humana. |

### Adaptação de cerimônia

O design evita um único ritual para tudo:

- **spike** termina em recomendação e considera o código descartável;
- **bounded** exige um design curto aprovado, mas não cria spec/plano;
- **architectural** exige spec escrita, review do usuário e plano detalhado;
- complexidade oculta só pode promover o caminho para um mais pesado, nunca rebaixá-lo (`skills/brainstorming/SKILL.md:58-108`).

Essa adaptação reduz overhead em mudanças pequenas, mas introduz uma bifurcação relevante: o fluxo completo de artefatos e revisões não cobre todos os trabalhos.

## Artefatos e memória operacional

### Artefatos duráveis ou potencialmente duráveis

- spec arquitetural em `docs/superpowers/specs/…`, explicitamente commitada (`skills/brainstorming/SKILL.md:237-245`);
- plano em `docs/superpowers/plans/…`, salvo para review humano (`skills/writing-plans/SKILL.md:18-19,167-192`);
- código, testes e commits por tarefa;
- branch, PR ou merge no encerramento.

### Artefatos efêmeros do plano

`sdd-workspace` cria `.superpowers/sdd/<slug-do-plano>/`, autoignorado, e guarda:

- `plan-path`, para impedir contaminação entre planos com mesmo basename;
- `progress.md`, o ledger de tarefas, rulings, fix rounds e findings deferidos;
- `task-N-brief.md`;
- `task-N-report.md` no SDD;
- `review-<base>..<head>.diff`;
- `task-N-tests.log` no Native.

Fontes: `skills/subagent-driven-development/scripts/sdd-workspace:1-29,41-82`; `task-brief:1-43`; `review-package:1-53`; `skills/executing-plans/scripts/task-done:1-52`.

O ledger é a memória de recuperação pós-compaction: tarefas com linha `complete` não devem ser reenviadas, e Git/ledger prevalecem sobre a lembrança do agente (`skills/subagent-driven-development/SKILL.md:131-160`). O custo é auditabilidade: após review final limpo, a skill manda apagar o workspace; “git history is the record now” (`:471-487`). Assim, reports detalhados, pacotes de diff, ledger e logs deixam de existir por padrão. Apenas commits e rulings copiados à mensagem final sobrevivem necessariamente.

## Separação entre autor e verificador

### Onde ela é forte

- No modo SDD, cada tarefa recebe um implementador fresco e depois um task reviewer distinto; o implementador é explicitamente proibido de criar seu próprio reviewer (`skills/subagent-driven-development/SKILL.md:8-12,246-284`; `implementer-prompt.md:50-60`).
- O reviewer recebe brief, report e diff package, trata o report como claims não verificadas e devolve dois veredictos: spec compliance e qualidade (`task-reviewer-prompt.md:21-71,94-188`).
- O review final de branch deve usar o modelo mais capaz disponível (`skills/subagent-driven-development/SKILL.md:445-456`).

### Onde ela degrada

- No Native, não há reviewer por tarefa; há um reviewer fresco apenas no fim (`skills/executing-plans/SKILL.md:6-18,234-252`).
- Sem ferramenta de subagente, o próprio autor faz o review final e deve declarar que isso é mais fraco (`skills/executing-plans/SKILL.md:253-258`). Portanto, “autor ≠ verificador” não é uma invariável do framework.
- O reviewer de tarefa não reexecuta a suíte por padrão; ele verifica report e diff e só roda teste focado se surgir uma dúvida concreta (`task-reviewer-prompt.md:73-92`). A independência é sobretudo de **julgamento de código**, não uma reprodução independente do runtime.
- Spec e plano ativos têm self-review + aprovação humana. Existem `spec-document-reviewer-prompt.md` e `plan-document-reviewer-prompt.md`, mas nenhuma skill ativa referencia esses arquivos no release; a busca de referências encontrou apenas os próprios templates e documentação histórica. `brainstorming` ainda fala em “spec review loop” depois de descrever apenas self-review (`skills/brainstorming/SKILL.md:246-261`). Isto parece artefato órfão ou drift documental, não um gate independente ativo.

## Gates determinísticos versus gates de prompt

### Determinísticos, observados no código

1. `sdd-workspace` valida plano, cria namespace por plano, resolve colisões e autoignora o diretório (`sdd-workspace:30-82`).
2. `task-brief` falha se não encontrar a tarefa (`task-brief:30-43`).
3. `review-package` valida SHAs, ancestralidade e range não vazio antes de gerar commit list, stat e diff (`review-package:20-53`).
4. `task-done` executa exatamente o comando recebido; se exit != 0, não grava `Task N: complete`; se passar, preserva o log e grava range + último resultado (`task-done:23-52`).
5. O branch finisher exige a suíte completa verde antes de oferecer integração (`skills/finishing-a-development-branch/SKILL.md:14-27`).
6. O empacotador Codex recusa árvore suja, exige metadata para todas as skills e produz arquivo determinístico (`scripts/package-codex-plugin.sh:133-180,233-282,292-351`).

### Semânticos/instrucionais

- invocar a skill certa antes de qualquer ação (`skills/using-superpowers/SKILL.md:10-28`);
- não implementar antes da aprovação do design;
- comprovar que o teste falhou pelo motivo certo antes de escrever produção;
- comparar cada `Expected:` do plano com saída real;
- classificar findings corretamente e não ignorar Critical/Important;
- fazer a pre-flight table completa;
- copiar todos os rulings para a mensagem final.

Esses gates têm linguagem forte e tabelas de racionalização, mas não há uma máquina de estados central que bloqueie a próxima transição. Mesmo `task-done` só sabe se **o comando que o agente forneceu** retornou 0; ele não prova que foi a suíte correta, que houve RED antes do GREEN, nem que requisitos foram cobertos.

## Gestão de contexto

É uma das áreas mais maduras do projeto:

- subagentes devem começar com contexto isolado construído pelo controller, não herdar o transcript (`skills/subagent-driven-development/SKILL.md:8-12`);
- tarefa completa é extraída para arquivo; valores exatos aparecem só no brief, não duplicados no prompt (`:246-282`);
- report detalhado vai a arquivo e o retorno do agente fica abaixo de 15 linhas (`implementer-prompt.md:128-153`);
- diff entra em arquivo para não ocupar o contexto do controller (`task-reviewer-prompt.md:32-50`);
- o ledger sobrevive a compaction e evita reexecutar tarefas (`skills/subagent-driven-development/SKILL.md:131-160`);
- logs longos são redirecionados e lidos pelo tail no Native (`skills/executing-plans/SKILL.md:164-181`; `task-done:39-52`);
- hooks reintroduzem o bootstrap em startup/clear/compact para harnesses compatíveis (`hooks/hooks.json:3-14`), enquanto Pi rearma a injeção em `session_start` e `session_compact` (`.pi/extensions/superpowers.ts:16-56`).

Limites: não há memória semântica, banco de decisões, RAG ou ledger de longo prazo. A memória é filesystem local + Git; o workspace efêmero é apagado no final. Em OpenCode, há código específico para não injetar o bootstrap de controller em sessões-filhas e evitar que workers reiniciem o ciclo de design, um bom exemplo de contexto delimitado estruturalmente (`.opencode/plugins/superpowers.js:143-209,337-369`).

## Adaptação à capacidade e ao custo do modelo

O SDD contém um policy manual de roteamento:

- tarefa mecânica de 1–2 arquivos → modelo barato;
- integração/debugging → modelo padrão;
- arquitetura e review final → modelo mais capaz;
- rounds 4–5 do fix-loop → modelo ao menos um tier acima;
- model deve ser especificado explicitamente em todo dispatch (`skills/subagent-driven-development/SKILL.md:184-220`).

O Native é posicionado para modelo intermediário porque o plano carrega o raciocínio; o review final concentra o uso do modelo forte (`skills/executing-plans/SKILL.md:46-64`). No Claude Code, há opção de executar o controller um nível abaixo em modelo intermediário (`skills/using-superpowers/references/claude-code-tools.md:9-29`). No Codex, a referência pede model e reasoning effort explícitos e alerta para validar a allowlist atual (`skills/using-superpowers/references/codex-tools.md:17-37,62-79`).

Isso é adaptação consciente, porém **não automática**: os tiers são julgados pelo controller, templates têm placeholders e não há benchmark/cost model embutido. Release notes alegam que controller aninhado mediu cerca de metade de custo e wall clock (`RELEASE-NOTES.md:38-42`), mas o dataset dessa medição não está no clone; trate como claim do publisher, não resultado independentemente verificável.

## Extensibilidade e composição

### Composição

As skills se compõem por frontmatter de trigger e referências explícitas `REQUIRED SUB-SKILL`; `using-superpowers` obriga a seleção antes da ação (`skills/using-superpowers/SKILL.md:18-31`). O grafo principal é legível e substituível: `brainstorming → writing-plans → {SDD|Native} → finishing`, com TDD/debugging/verificação/review como cross-cutting skills.

A composição é textual e dinâmica, não uma DAG declarativa validada por engine. Isso favorece portabilidade e edição, mas reduz garantias de execução.

### Extensão de skills

`writing-skills` trata instruções como código comportamental e prescreve RED/GREEN/REFACTOR com pressure tests (`skills/writing-skills/SKILL.md:6-18,30-45,376-395,554-589`). O core, contudo, é deliberadamente curado: dependências externas e skills específicas de domínio devem virar plugins separados (`AGENTS.md:34-58`).

### Extensão para harnesses

O porting guide define três formas:

- A: shell hook;
- B: plugin/extension in-process;
- C: instructions file empacotado com a extensão (`docs/porting-to-a-new-harness.md:167-280`).

O README documenta 16 alvos de instalação: Claude Code, Antigravity, Codex App, Codex CLI, Cursor, Devin CLI, Factory Droid, Gemini CLI, GitHub Copilot CLI, Grok Build CLI, Kimi Code, OpenCode, Pi, Qwen Code, Hermes Agent e Muse (`README.md:52-305`). Há manifests/entrypoints locais para Claude, Codex, Cursor, Devin, Gemini, Hermes, Kimi, Muse, OpenCode e Pi; outros reutilizam marketplaces ou formatos compatíveis.

Capacidades ausentes degradam de forma explícita: sem subagente, executar inline; sem todo tool, usar Markdown; sem skill tool, ler `SKILL.md` (`docs/porting-to-a-new-harness.md:108-122`). A dependência real é o harness fornecer leitura/escrita, shell e alguma descoberta de skills.

## Integrações e superfície operacional

| Superfície | Implementação |
|---|---|
| Git | worktrees, branches, commits, merge-base, diff packages e branch finishing |
| Forge | push + criação genérica de PR; sem acoplamento obrigatório a GitHub no fluxo principal |
| Claude/Cursor/Copilot/Muse | hook shell compartilhado com formatos JSON distintos (`hooks/session-start`) |
| OpenCode V1/V2 | plugin JS registra skills e injeta contexto; detecta sessões-filhas |
| Pi | extensão TS descobre skills e reinjeta após compaction |
| Hermes | plugin Python registra skills e injeta no primeiro `pre_llm_call` |
| Kimi | manifest aponta skills, carrega `using-superpowers` e inclui tool mapping |
| Gemini | manifest + `GEMINI.md` por instructions-file |
| Codex | plugin marketplace com skills nativas e `hooks: {}` deliberadamente vazio |
| Diagnóstico | lê transcripts locais; pode preparar issue GitHub após aprovação |

Não encontrei no corpus conectores para Jira/Linear, catálogo de serviços, CI/CD como serviço, filas de tickets, ambientes de deploy, feature flags, incident management, métricas DORA ou governança multi-repo. Isso é uma ausência observada no release analisado, não prova que plugins externos não existam.

## Testes, releases e maturidade

O projeto separa:

- testes determinísticos de plugin em `tests/`;
- evals de comportamento de LLM no laboratório externo `prime-radiant-inc/superpowers-evals`, esperado localmente como `evals/` (`docs/testing.md:1-37`; `AGENTS.md:93-104`).

No clone autorizado, `evals/`, `.gitmodules` e `.github/workflows/` estão ausentes, e o `package.json` raiz não define `scripts`. A documentação manda executar runners por diretório ou `npm test` onde aplicável (`docs/testing.md:23`). Portanto:

- existe volume expressivo de testes locais e os helpers críticos auditados passaram;
- não há evidência no clone de um gate CI raiz executando todos eles;
- os resultados de eval que motivam várias decisões aparecem resumidos em release notes, mas os runs e datasets não estão disponíveis no corpus.

Sinais de evolução recente no changelog oficial:

- v6.4.1 reconstrói Native execution, adiciona `diagnosing-superpowers`, OpenCode 2.0, Muse e Qwen (`RELEASE-NOTES.md:3-60`);
- v6.3.0 adiciona paths spike/bounded/architectural, rulings em vez de stalls e batching de microtarefas (`:62-99`);
- v6.2.0 torna workspace plan-scoped e introduz fix-loop com resume + circuit breaker (`:101-117`);
- v6.1.0/6.1.1 remove o SessionStart do Codex por confiar no trigger nativo e endurece packaging (`:134-161`).

O release oficial `v6.4.1` aparece como “Latest” e aponta para o mesmo commit do clone na página oficial de releases, consultada em 2026-09-23.

## Pontos fortes

1. **Workflow ponta a ponta e opinionado.** Cobre da intenção à integração, com bifurcação de cerimônia e handoffs claros.
2. **Higiene de contexto incomumente explícita.** Briefs, reports e diffs por arquivo, fresh contexts e ledger pós-compaction atacam falhas reais de sessões longas.
3. **Separação de papéis no modo premium.** SDD mantém controller, implementador e reviewer com responsabilidades diferentes, mais review de branch.
4. **TDD e evidência como invariantes de linguagem.** A skill é agressiva contra racionalizações e exige suíte completa, não só teste focado.
5. **Alguns gates são executáveis.** Range guard e “não registra se teste falhar” reduzem falsos positivos estruturais.
6. **Portabilidade realista.** Ações agnósticas + tool mapping e três shapes de integração evitam fork das skills por vendor.
7. **Adaptação de custo.** Native versus SDD e roteamento manual de modelo tornam o trade-off explícito.
8. **Segurança operacional no finish.** Merge/push/discard ficam sob decisão humana; descarte tem confirmação literal e worktree com arquivos não rastreados não é forçada.

## Limites e lacunas

1. **Não é um control plane de fábrica.** Não há scheduler, board, dependências cross-team, capacidade, SLA, portfolio, deployments ou observabilidade de agentes no core evidenciado.
2. **Enforcement majoritariamente por prompt.** O modelo pode pular gates; não há engine validando o estado global do fluxo.
3. **Autor/verificador não é universal.** Native sem subagentes cai em self-review; spec e plano também não têm reviewer independente ativo.
4. **Runtime verification não é independente no SDD.** O reviewer normalmente não reexecuta testes; a evidência vem do implementador.
5. **Implementação de tarefas é serial.** SDD proíbe múltiplos implementadores simultâneos no mesmo plano (`skills/subagent-driven-development/SKILL.md:282`); paralelismo existe para problemas realmente independentes via `dispatching-parallel-agents`, não como scheduler amplo.
6. **Auditoria efêmera.** Ledger, reports, diffs e logs são apagados após review final; Git não preserva toda a cadeia de evidência.
7. **Evals não auditáveis neste corpus.** O laboratório está fora do clone, e alguns registros ficam apenas com o mantenedor (`docs/testing.md:21,25-37`).
8. **Sem CI raiz visível.** Não há `.github/workflows/` no clone nem runner agregado em `package.json`.
9. **Drift documental.** O README ainda diz que o menu final inclui discard, enquanto a skill só permite discard após pedido explícito; também chama o review SDD de “two-stage”, embora o release atual use um reviewer com dois veredictos (`README.md:321,360`; `skills/finishing-a-development-branch/SKILL.md:53-82,132-157`; `RELEASE-NOTES.md:203-214`).
10. **Templates órfãos.** Os reviewers de spec e plano existem como arquivos, mas não estão conectados às skills ativas; a expressão “spec review loop” ficou sem mecanismo correspondente.
11. **Sem rastreabilidade formal requisito→teste.** `Spec`, `Global Constraints`, `Interfaces` e `Review Focus` são bons scaffolds, mas não há IDs de requisito, matriz calculada ou checker de cobertura.
12. **Roteamento de modelo é política manual.** Não há seleção automática baseada em telemetria, benchmark ou budget.

## Posicionamento comparativo sugerido

Use estes eixos no artigo:

| Eixo | Avaliação de Superpowers v6.4.1 |
|---|---|
| Unidade de operação | sessão/branch/plano |
| Forma do produto | biblioteca de skills + adaptadores + scripts locais |
| Orquestração | controller LLM, sequencial por tarefa no SDD |
| Planejamento | forte e detalhado; artifacts Markdown |
| Verificação | TDD forte; runtime proof do autor; review independente de código no SDD |
| Determinismo | parcial, concentrado nos helpers shell |
| Memória | ledger/filesystem + Git; sem memória semântica |
| Escala organizacional | não evidenciada no core |
| Portabilidade de harness | muito alta |
| Extensibilidade | skills/plugins separados; core deliberadamente estreito |
| Custo | escolha explícita Native vs SDD + model tiers manuais |
| Auditabilidade | boa durante execução, reduzida após apagar workspace |

Frase-síntese: **Superpowers transforma um coding agent em um executor disciplinado de um método, mas não transforma sozinho uma organização em uma fábrica autônoma.** É um excelente “sistema operacional de trabalho” dentro do agente; precisa de camadas externas para intake, portfolio, filas, CI/CD, políticas organizacionais, métricas e operação multi-repo.

## Claims ledger

1. `{claim="Superpowers v6.4.1 é uma metodologia componível baseada em 15 skills, não um runtime monolítico", source="clone README.md:3,307-364; inventário skills/*/SKILL.md", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="arquitetura"}`
2. `{claim="O fluxo principal encadeia brainstorming, worktree, writing-plans, SDD ou Native, TDD, review e finish", source="clone README.md:307-323", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="workflow"}`
3. `{claim="Brainstorming adapta cerimônia em spike, bounded e architectural, sempre com aprovação humana antes de implementar", source="clone skills/brainstorming/SKILL.md:38-96", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="workflow"}`
4. `{claim="Planos carregam constraints globais, review focus e interfaces por tarefa, além de passos TDD concretos", source="clone skills/writing-plans/SKILL.md:54-141", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="artefatos"}`
5. `{claim="SDD separa implementador e reviewer por tarefa e acrescenta review final de branch", source="clone skills/subagent-driven-development/SKILL.md:6-12,308-352,445-469", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="author-verifier"}`
6. `{claim="Native elimina reviewers por tarefa e pode degradar a self-review do próprio autor se não houver subagentes", source="clone skills/executing-plans/SKILL.md:6-18,234-258", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="author-verifier"}`
7. `{claim="Task reviewers não reexecutam a suíte por padrão; verificam diff e evidência reportada, rodando teste apenas para uma dúvida concreta", source="clone skills/subagent-driven-development/task-reviewer-prompt.md:64-92", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="verification"}`
8. `{claim="O ledger e arquivos por tarefa são a estratégia explícita para sobreviver a compaction e preservar o contexto do controller", source="clone skills/subagent-driven-development/SKILL.md:131-160,231-282", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="context"}`
9. `{claim="O workspace de evidências é apagado depois do review final limpo, reduzindo a auditabilidade pós-execução", source="clone skills/subagent-driven-development/SKILL.md:471-487; skills/executing-plans/SKILL.md:291-304", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="auditability"}`
10. `{claim="review-package rejeita ranges vazios ou cujo HEAD não descende do BASE", source="clone skills/subagent-driven-development/scripts/review-package:20-29; execução local tests/claude-code/test-sdd-workspace.sh", publisher="obra/superpowers + reprodução local", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="deterministic-gate"}`
11. `{claim="task-done não registra conclusão quando o comando de testes falha", source="clone skills/executing-plans/scripts/task-done:39-52; execução local tests/claude-code/test-executing-plans-scripts.sh", publisher="obra/superpowers + reprodução local", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="deterministic-gate"}`
12. `{claim="TDD exige RED observado, GREEN, suíte do projeto e evidência fresca antes de claims", source="clone skills/test-driven-development/SKILL.md:31-69,113-193; skills/verification-before-completion/SKILL.md:14-35", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="verification-policy"}`
13. `{claim="A adaptação de modelo recomenda tier barato para tarefas mecânicas, padrão para integração, mais capaz para arquitetura/review final e escalation nos rounds 4-5", source="clone skills/subagent-driven-development/SKILL.md:184-220,375-386", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="model-adaptation"}`
14. `{claim="A adaptação multi-harness separa skills agnósticas, tool mappings e mecanismos de bootstrap/descoberta", source="clone docs/porting-to-a-new-harness.md:31-77,167-280", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="integration"}`
15. `{claim="O README documenta 16 alvos de instalação", source="clone README.md:52-305", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="compatibility"}`
16. `{claim="O core é zero-dependency por design e encaminha integrações/domínios específicos para plugins separados", source="clone AGENTS.md:34-58", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="extensibility"}`
17. `{claim="Os evals comportamentais ficam num laboratório externo e não estão presentes no clone autorizado", source="clone docs/testing.md:1-37; AGENTS.md:93-104; ausência verificada de evals/ e .gitmodules", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta para a ausência no clone; média para cobertura externa", class="test-evidence"}`
18. `{claim="Não há workflow de CI em .github/workflows nem script raiz agregado no package.json do clone", source="ausência verificada no clone; package.json:1-23", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="ci"}`
19. `{claim="v6.4.1 é o release oficial mais recente e o main oficial aponta para o SHA do clone em 2026-09-23", source="GitHub Releases oficial + git ls-remote https://github.com/obra/superpowers.git", publisher="GitHub/obra", pub_date="2026-09-19", accessed=2026-09-23, confidence="alta", class="release-state"}`
20. `{claim="A alegação de que controller aninhado reduziu aproximadamente à metade custo e wall clock não é auditável a partir do clone", source="clone RELEASE-NOTES.md:38-42; datasets ausentes", publisher="obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="média; claim do publisher não reproduzido", class="performance"}`
21. `{claim="Os templates de reviewer de spec e plano não são chamados por nenhuma skill ativa neste release", source="clone rg de spec-document-reviewer|plan-document-reviewer; skills/brainstorming/SKILL.md:246-261; skills/writing-plans/SKILL.md:153-192", publisher="análise estática do clone obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="alta", class="workflow-gap"}`
22. `{claim="Superpowers não evidencia no core um control plane organizacional de fábrica", source="inventário integral do clone autorizado; nenhuma implementação encontrada para scheduler, backlog, multi-repo, deployment ou fleet observability", publisher="análise estática do clone obra/superpowers", pub_date="2026-09-18", accessed=2026-09-23, confidence="média-alta; ausência no corpus, não no ecossistema", class="competitive-positioning"}`

## Fontes oficiais e permalinks

- [Repositório oficial obra/superpowers](https://github.com/obra/superpowers) — README, código, skills, testes e documentação; acesso em 2026-09-23.
- [Release oficial v6.4.1](https://github.com/obra/superpowers/releases/tag/v6.4.1) — publicado em 2026-09-19 UTC, commit `5bf4e78`.
- [Commit analisado](https://github.com/obra/superpowers/tree/5bf4e78011075bcfc0dc295f0724994cd123ee71) — permalink do corpus.
- [README no commit](https://github.com/obra/superpowers/blob/5bf4e78011075bcfc0dc295f0724994cd123ee71/README.md).
- [Brainstorming no commit](https://github.com/obra/superpowers/blob/5bf4e78011075bcfc0dc295f0724994cd123ee71/skills/brainstorming/SKILL.md).
- [Writing plans no commit](https://github.com/obra/superpowers/blob/5bf4e78011075bcfc0dc295f0724994cd123ee71/skills/writing-plans/SKILL.md).
- [Subagent-driven development no commit](https://github.com/obra/superpowers/blob/5bf4e78011075bcfc0dc295f0724994cd123ee71/skills/subagent-driven-development/SKILL.md).
- [Executing plans no commit](https://github.com/obra/superpowers/blob/5bf4e78011075bcfc0dc295f0724994cd123ee71/skills/executing-plans/SKILL.md).
- [Porting guide no commit](https://github.com/obra/superpowers/blob/5bf4e78011075bcfc0dc295f0724994cd123ee71/docs/porting-to-a-new-harness.md).
- [Release notes oficiais](https://github.com/obra/superpowers/blob/5bf4e78011075bcfc0dc295f0724994cd123ee71/RELEASE-NOTES.md).
- [Laboratório oficial de evals referenciado pelo projeto](https://github.com/prime-radiant-inc/superpowers-evals) — não importado nem usado como evidência nesta rodada.

## Leads e ausências a investigar

1. **Evals reais:** importar uma revisão pinada de `prime-radiant-inc/superpowers-evals` e os runs que sustentam claims de comportamento, custo e wall clock.
2. **Templates órfãos:** verificar em issues/PRs oficiais se a desconexão de spec/plan reviewers é regressão, remoção deliberada ou dívida documental.
3. **Aderência por modelo:** medir taxa de cumprimento dos gates puramente instrucionais em pelo menos um modelo forte, intermediário e barato, por harness.
4. **Reprodução independente:** comparar taxa de defeitos quando reviewer apenas lê evidência versus quando reexecuta testes em ambiente limpo.
5. **Retenção de auditoria:** avaliar opção de arquivar ledger/reports/logs com hash em vez de apagá-los.
6. **Escala de fábrica:** testar acoplamento com intake/backlog, CI, deploy e observabilidade; nada disso está especificado no core.
7. **Matriz de integração:** executar o acceptance prompt oficial em todos os 16 alvos, porque documentação de instalação não prova comportamento equivalente.
8. **CI:** confirmar fora do clone se o mantenedor usa CI privado; o release analisado não contém workflows públicos.
9. **Traceability:** verificar se plugins externos adicionam IDs de requisito/matriz requisito→teste ou se a rastreabilidade permanece só textual.
10. **Segurança e isolamento:** aprofundar o brainstorm visual companion e os plugins in-process; esta rodada só os inspecionou na medida necessária ao fluxo principal.

## Notas epistemológicas

- Toda conclusão acima deriva do clone autorizado no SHA registrado, de comandos executados contra ele ou de páginas oficiais do mesmo projeto consultadas nesta rodada.
- Claims de ausência são limitados ao corpus analisado; não são claims universais sobre o ecossistema de plugins.
- Claims de performance/custo presentes em release notes são atribuídos ao publisher e marcados como não reproduzidos quando o material de medição não está no clone.
- A página web oficial e `git ls-remote` confirmaram que `main`, em 2026-09-23, ainda aponta para o mesmo commit do release; não houve mistura de conteúdo pós-release.
