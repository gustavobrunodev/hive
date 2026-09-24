---
framework: "Matt Pocock Skills"
research_type: competitive-technical
status: complete
accessed: 2026-09-23
authorized_corpus: /tmp/agentic-framework-research.z4Te2Y/mattpocock-skills
clone_sha: c55ee46073ed923f86ce59a5eb3b6d895095d1b7
clone_commit_date: 2026-09-18T11:12:29+01:00
package_version: 1.2.3
---

# Matt Pocock Skills — digest técnico para fábrica de software agêntica

## Veredito executivo

Matt Pocock Skills é melhor entendido como uma **biblioteca de práticas operacionais para agentes**, não como uma fábrica de software autônoma. O projeto oferece uma cadeia legível de descoberta, planejamento, implementação, verificação e revisão, mas distribui a coordenação entre conversas humanas, arquivos Markdown, issues, branches e instruções em linguagem natural. Não há um motor de workflow que garanta transições, reconcilie critérios de aceite ou retome execução automaticamente.

Seu diferencial é a combinação de controle humano, módulos pequenos, vocabulário compartilhado, TDD em seams e higiene explícita de contexto. Para uma fábrica agêntica, ele é uma boa **camada de método e interface humana**. Como plataforma de execução, faltam contratos de dependência entre skills, orquestração promovida, gates centralizados, rastreabilidade ponta a ponta, fechamento automático de tickets e independência obrigatória entre autor e verificador.

A lacuna mais material está no fechamento do ciclo: `implement` manda revisar antes de commitar, enquanto `code-review` só enxerga `git diff <fixed-point>...HEAD`; a própria documentação reconhece que mudanças não commitadas ficam invisíveis, que achados da revisão não são corrigidos automaticamente e que o ticket não é fechado nem tem seus critérios reconciliados ([`docs/engineering/implement.md:51-67`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/docs/engineering/implement.md#L51-L67)).

## Snapshot auditado

O clone é um shallow clone limpo de `main`, com profundidade 1. Seu `HEAD` é `c55ee46073ed923f86ce59a5eb3b6d895095d1b7`, de 2026-09-18, e `git ls-remote` retornou o mesmo SHA para `origin/main` em 2026-09-23. A listagem oficial da Anthropic também fixa `mattpocock-skills` exatamente nesse SHA, portanto o corpus local coincide com a versão distribuída no marketplace oficial no momento do acesso ([marketplace oficial, linhas 2301-2312](https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json); [commit oficial](https://github.com/mattpocock/skills/commit/c55ee46073ed923f86ce59a5eb3b6d895095d1b7)).

| Medida | Resultado | Evidência |
|---|---:|---|
| Caminhos rastreados pelo Git | 169 | `git ls-files` no clone |
| `SKILL.md` | 38 | 18 engineering, 7 productivity, 9 in-progress, 4 misc, 0 deprecated |
| Linhas somadas dos `SKILL.md` | 2.633 | `find ... SKILL.md | xargs wc -l` |
| Metadados Codex `agents/openai.yaml` | 38 | um por skill |
| Skills promovidas no plugin | 25 | 18 engineering + 7 productivity; [`plugin.json:21-47`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/.claude-plugin/plugin.json#L21-L47) |
| Skills fora do plugin | 13 | 9 in-progress + 4 misc |
| Invocação no corpus completo | 22 humanas, 16 pelo modelo | frontmatter `disable-model-invocation` |
| Invocação no plugin promovido | 14 humanas, 11 pelo modelo | cruzamento do manifesto com frontmatter |
| Páginas em `docs/` | 25 | uma por skill promovida |
| Arquivos regulares sob `skills/` | 108 | inventário local |
| Scripts executáveis/templates | 6 | 3 scripts de manutenção + 3 scripts empacotados |
| Testes/evals do próprio conjunto | 0 identificados | nenhum script `test`; único path “tests” é documentação `tdd/tests.md` |
| Workflows CI | 1 | release/versionamento; [`release.yml:1-37`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/.github/workflows/release.yml#L1-L37) |
| Changesets pendentes | 12 | `.changeset/*.md`, excluído o README |
| Manifestos MCP | 0 | nenhum `.mcp.json` no clone |

O pacote e o plugin declaram versão `1.2.3`; `npm run check-plugin-version` passou no clone. O SHA oficial, porém, contém 12 changesets ainda presentes. Na prática, **SHA é a identidade mais confiável do conteúdo**; a versão semântica não descreve sozinha o snapshot entregue.

## Filosofia e unidade arquitetural

O README se posiciona contra frameworks que “possuem o processo”: prefere skills pequenas, adaptáveis e combináveis, com o engenheiro ainda no controle ([`README.md:15-19`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/README.md#L15-L19)). A unidade de composição é uma pasta de skill com `SKILL.md`, metadados de interface para Codex e, opcionalmente, referências/scripts/templates.

Há quatro princípios recorrentes:

1. **Fatos são trabalho do agente; decisões são do humano.** `grilling` despacha investigação quando o ambiente pode responder, mas espera o usuário para escolhas ([`grilling/SKILL.md:24-28`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/productivity/grilling/SKILL.md#L24-L28)).
2. **Feedback rápido supera inferência longa.** Debugging exige primeiro um comando red-capable, determinístico, rápido e executável pelo agente ([`diagnosing-bugs/SKILL.md:57-66`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/diagnosing-bugs/SKILL.md#L57-L66)).
3. **Vocabulário comum reduz custo de navegação.** `CONTEXT.md` é estritamente glossário; ADRs são reservadas a decisões difíceis de reverter, surpreendentes e baseadas em trade-off ([`domain-modeling/SKILL.md:60-74`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/domain-modeling/SKILL.md#L60-L74)).
4. **Interfaces profundas e seams governam design e teste.** TDD só deve escrever testes em seams previamente acordadas, através da interface pública ([`tdd/SKILL.md:18-26`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/tdd/SKILL.md#L18-L26)).

Isto é deliberadamente um sistema de **prompts procedurais + artefatos**, não um runtime. O roteador `ask-matt` ensina uma topologia de uso, mas a execução continua dependente da interpretação do modelo e de novas invocações humanas.

## Cadeia discover → plan → implement → verify → review

| Etapa | Skills/capacidades | Artefatos e gates | Avaliação para fábrica |
|---|---|---|---|
| Discover | `grill-me`, `grill-with-docs`, `grilling`, `research`, `prototype`, `triage`, `wayfinder`, `improve-codebase-architecture` | árvore de decisões; rodadas de frontier; `CONTEXT.md`; ADRs; pesquisa citada; protótipo; issues verificadas; mapa de decisão | Forte para elicitação humana e exploração. Não produz um ledger completo das decisões. |
| Plan | `to-spec`, `to-tickets`, `wayfinder` | spec em issue/arquivo; histórias; decisões de teste; tickets verticais; blocking edges; mapa e decision tickets | Boa decomposição e explicitação de dependências. O grafo vive no tracker, sem scheduler promovido. |
| Implement | `implement` + `tdd`; `implement-spec` apenas em beta | código; ciclos red→green; typecheck; suíte; commit; em beta: PR, worktrees e merger subagent | Fluxo promovido é serial, um ticket por sessão, e depende de invocação humana. Orquestração concorrente está fora do plugin. |
| Verify | `tdd`, `diagnosing-bugs`, comandos do repo | teste falhando antes do código; loop reproduzível; testes por seam; suíte completa; limpeza de instrumentação | Gates bons quando o projeto já tem testes/checks. Não há gate engine ou política uniforme no conjunto. |
| Review | `code-review`; `improve-codebase-architecture`; `pr` em beta | dois relatórios paralelos: Standards e Spec; PR body com evidência em beta | Isola dois eixos, mas não cobre por padrão bugs/edge cases e não garante correção dos achados. |

### Discover: `grill-me` e a primitiva `grilling`

`grill-me` é intencionalmente uma casca de uma linha: chama `grilling` e nada persiste ([`grill-me/SKILL.md:1-7`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/productivity/grill-me/SKILL.md#L1-L7)). A inteligência está na primitiva:

- modela o assunto como árvore de decisões;
- pergunta em rodadas o frontier de questões cujos pré-requisitos já foram resolvidos;
- dá uma recomendação para cada pergunta;
- recomputa o frontier após cada rodada;
- busca fatos em paralelo, mas deixa decisões para o usuário;
- termina apenas quando o frontier está vazio e o usuário confirma entendimento compartilhado.

Esse gate é forte como mecanismo HITL, mas não é determinístico: a documentação admite que o frontier é julgamento do modelo, não grafo calculado ([`docs/productivity/grilling.md:21-31`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/docs/productivity/grilling.md#L21-L31)). Também não há teto de perguntas por design ([`.out-of-scope/question-limits.md:1-14`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/.out-of-scope/question-limits.md#L1-L14)).

`grill-with-docs` combina `grilling` e `domain-modeling`: termos resolvidos vão para `CONTEXT.md`, e apenas decisões que passam os três critérios de ADR são persistidas ([`grill-with-docs/SKILL.md:1-7`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/grill-with-docs/SKILL.md#L1-L7); [`domain-modeling/SKILL.md:60-74`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/domain-modeling/SKILL.md#L60-L74)). A consequência é importante: a maioria das respostas fica apenas na conversa. A própria documentação registra como reclamação substantiva a ausência de um ledger ligando respostas a spec, ticket e teste ([`docs/engineering/grill-with-docs.md:31-55`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/docs/engineering/grill-with-docs.md#L31-L55)).

`research` delega a leitura a um background agent e exige um único Markdown citado a partir de fontes primárias ([`research/SKILL.md:1-12`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/research/SKILL.md#L1-L12)). É minimalista demais para pesquisa crítica: não define budget, stopping criterion, verificador independente, política de freshness ou allowlist. A documentação oficial do próprio projeto reconhece ausência de stop rule, ausência de verificação e risco de recursão de subagentes ([`docs/engineering/research.md:23-57`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/docs/engineering/research.md#L23-L57)).

### Plan: specs, tickets e mapas

`to-spec` não entrevista novamente: explora o repo, propõe seams, pede confirmação, escreve problema, solução, histórias, decisões de implementação/teste e out-of-scope, então publica no tracker com `ready-for-agent` ([`to-spec/SKILL.md:7-20`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/to-spec/SKILL.md#L7-L20)).

`to-tickets` transforma o plano em tracer bullets verticais, cada um verificável isoladamente, limitado a uma janela fresca e ligado por blocking edges. A decomposição precisa de aprovação humana; refactors largos recebem expand–contract em vez de slices artificiais ([`to-tickets/SKILL.md:25-56`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/to-tickets/SKILL.md#L25-L56)).

`wayfinder` é a camada para esforços maiores que uma sessão. O artefato canônico é um mapa no issue tracker com destino, decisões já tomadas, fog e out-of-scope; as unidades são decision tickets, e o frontier são filhos abertos, desbloqueados e não reivindicados ([`wayfinder/SKILL.md:19-71`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/wayfinder/SKILL.md#L19-L71)). Há claim por assignee para reduzir colisão, mas nenhuma transação ou lease do próprio framework.

### Implement e verify

O `SKILL.md` de `implement` tem só 15 linhas: implementar spec/tickets, usar TDD onde possível, typecheck e testes, revisar e commitar ([`implement/SKILL.md:1-15`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/implement/SKILL.md#L1-L15)). Sua documentação esclarece o contrato real: um ticket por run, contexto novo entre tickets, suíte completa no fim e commit na branch atual ([`docs/engineering/implement.md:31-47`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/docs/engineering/implement.md#L31-L47)).

O verificador principal durante execução é TDD: teste por interface pública, seam pré-acordada, ciclos verticais de um teste e implementação mínima, red antes de green. Curiosamente, refactoring é adiado para review, não integrado ao ciclo ([`tdd/SKILL.md:28-38`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/tdd/SKILL.md#L28-L38)). Para bugs difíceis, `diagnosing-bugs` oferece o gate determinístico mais rigoroso do conjunto: não permite hipóteses antes de existir um comando red-capable já executado, rápido, determinístico e agent-runnable.

O `implement-spec` é o que mais se aproxima de uma fábrica: task graph, exploration agent, PR draft, worktrees isoladas, implementers concorrentes, merger agent, expansão do frontier e review final ([`implement-spec/SKILL.md:7-35`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/in-progress/implement-spec/SKILL.md#L7-L35)). Mas está em `in-progress`, não aparece no plugin promovido e ainda é instrução em prosa, não um orquestrador executável.

### Review

`code-review` fixa uma referência, valida que ela resolve e que o diff não está vazio, e lança dois subagentes em paralelo:

- **Standards**: padrões do repo + baseline de 12 code smells;
- **Spec**: requisitos ausentes/parciais, scope creep e implementação incorreta.

Os relatórios permanecem separados e não são rerankeados ([`code-review/SKILL.md:15-23`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/code-review/SKILL.md#L15-L23); [`code-review/SKILL.md:58-87`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/code-review/SKILL.md#L58-L87)). Isso reduz contaminação entre eixos, mas não equivale a um verificador independente completo:

- o fluxo padrão chama review dentro da sessão autora;
- não existe regra `author != verifier`;
- o agregador não revalida semanticamente os achados;
- caça a bugs/edge cases não é um terceiro eixo: a própria documentação manda usar a review nativa do Claude para isso;
- subagentes podem reinvocar `code-review` e explodir o fan-out, reconhecido como bug aberto;
- `implement` chama review antes do commit, mas o diff de review exclui mudanças staged/working-tree.

Esses limites são explicitados nas páginas oficiais do projeto ([`docs/engineering/code-review.md:48-76`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/docs/engineering/code-review.md#L48-L76)).

## Artefatos e memória operacional

| Artefato | Responsável | Papel |
|---|---|---|
| `docs/agents/issue-tracker.md` | `setup-matt-pocock-skills` | comandos/adaptação do tracker |
| `docs/agents/domain.md` | setup | ponte para glossário e ADRs |
| `docs/agents/triage-labels.md` | setup | mapeamento de cinco estados canônicos |
| `CONTEXT.md` / `CONTEXT-MAP.md` | `domain-modeling`, `grill-with-docs` | linguagem ubíqua, sem detalhes de implementação |
| `docs/adr/*.md` | `domain-modeling` | decisões duráveis que passam três gates |
| spec em issue ou `.scratch/.../spec.md` | `to-spec` | contrato planejado |
| issues/tickets + blockers | `to-tickets` | grafo de implementação |
| map + decision tickets + comments | `wayfinder` | estado de planejamento multi-sessão |
| Markdown citado | `research` | fato externo de vida curta |
| branch `prototype/<name>` | `prototype` | evidência primária da exploração |
| código/testes/commit | `implement`, `tdd` | produto executável |
| relatório em conversa | `code-review` | Standards e Spec; persistência não exigida |
| handoff temporário | `handoff` | portabilidade entre harness/diretório/pessoa |

O desenho prefere arquivos e trackers existentes a uma base própria. Isso aumenta transparência e portabilidade, mas espalha o estado e deixa lacunas: não há run manifest, decision ledger, matriz requisito→ticket→teste, status agregado, provenance de modelo, custo, retries, checkpoint de execução ou reconciliação automática do aceite.

## Separação autor/verificador

**Existe separação parcial**, não uma garantia de independência:

- Standards e Spec rodam em subagentes distintos, evitando que um eixo contamine o outro.
- `retro` reconhece que o implementador sofre maior pressão de contexto e que padrões devem ser impostos pelo reviewer ([`retro/SKILL.md:29-43`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/in-progress/retro/SKILL.md#L29-L43)).
- A documentação recomenda review em sessão fresca, mas o fluxo promovido `implement` ainda o aciona na sessão autora.
- Não há identidade de autor/verificador, política de modelo diferente, quorum, segunda opinião, veto automático ou exigência de evidência para aceitar cada finding.

Para uma fábrica, o padrão deveria ser promovido a contrato: autor e verificador em contextos diferentes, review após um snapshot commitado, achados triados e corrigidos, reexecução dos gates e só então fechamento do ticket.

## Gates determinísticos: o que existe e o que não existe

Gates realmente verificáveis instruídos pelo conjunto:

- `git rev-parse <fixed-point>` e diff não vazio antes da review;
- red→green por teste antes da implementação;
- typecheck frequente, teste focal frequente e suíte completa ao final;
- diagnóstico com um único comando red-capable e repro minimizada;
- `setup-ts-deep-modules` exige sequência pass→fail→pass para provar a regra de dependência ([`setup-ts-deep-modules/SKILL.md:79-87`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/in-progress/setup-ts-deep-modules/SKILL.md#L79-L87));
- `git-guardrails-claude-code` testa exit code 2 para comando bloqueado ([`git-guardrails-claude-code/SKILL.md:87-95`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/misc/git-guardrails-claude-code/SKILL.md#L87-L95));
- script de versão falha quando `package.json` e `plugin.json` divergem ([`sync-plugin-version.mjs:17-40`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/scripts/sync-plugin-version.mjs#L17-L40)).

Porém, esses gates são **receitas** que o modelo deve executar. O repositório não fornece um controlador que prove que todas rodaram, nem um schema comum de resultados. O workflow CI só faz release/versionamento; não há evals de skills, testes de roteamento/invocação, testes dos templates bash, validação sistemática dos manifests ou teste end-to-end da cadeia.

## Gestão de contexto

Esta é uma das áreas mais maduras do projeto:

- manter `grill-with-docs → to-spec → to-tickets` em uma janela contínua para preservar o raciocínio;
- começar cada `implement` em contexto fresco, pois o ticket deve ser autocontido;
- decidir apenas em phase boundaries entre Continue, `/clear`, `/handoff`, subagent e `/compact`;
- preferir Continue quando a conversa ainda é fonte primária e compactar apenas no limite da smart zone;
- usar context pointers para materiais fora da janela e progressive disclosure para referências;
- tratar handoff como mecanismo de portabilidade, não resumo padrão.

O decision tree completo está em [`PHASE-BOUNDARIES.md:17-55`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/ask-matt/PHASE-BOUNDARIES.md#L17-L55). O `writing-for-agents` formaliza context load, cognitive load, pointers e completion criteria ([`writing-for-agents/SKILL.md:10-52`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/productivity/writing-for-agents/SKILL.md#L10-L52)).

O ponto fraco é que os limites são heurísticos. A referência a ~150k tokens não é medida ou aplicada pelo sistema, e não há compactação ou handoff automatizado baseado em budget.

## Adaptação à capacidade do modelo

Há uma tensão documentada:

- o README afirma que as skills funcionam com qualquer modelo ([`README.md:17-19`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/README.md#L17-L19));
- a página de `grill-me` recomenda o melhor modelo para elicitação e diz que implementação tolera um modelo mais barato ([`docs/productivity/grill-me.md:67-68`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/docs/productivity/grill-me.md#L67-L68));
- a documentação de `grilling` registra que modelos mais fracos/rápidos ou esforço baixo podem quebrar o confirmation gate ([`docs/productivity/grilling.md:60-64`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/docs/productivity/grilling.md#L60-L64));
- `grill-with-docs` relata falha de carregamento das dependências correlacionada com modelo e effort ([`docs/engineering/grill-with-docs.md:48-55`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/docs/engineering/grill-with-docs.md#L48-L55)).

Nenhum dos 38 `SKILL.md` declara um campo `model:`. Portanto, a adaptação é conselho humano, não roteamento operacional. Não há fallback por capacidade, teste de compatibilidade, budgets por etapa ou promoção automática de tarefas de julgamento para modelos mais fortes.

## Extensibilidade e composição

O projeto separa **user-invoked** de **model-invoked** em dois harnesses: `disable-model-invocation: true` para Claude Code e `policy.allow_implicit_invocation: false` no `agents/openai.yaml` para Codex. Skills humanas orquestram; skills do modelo guardam disciplina reutilizável ([`.agents/invocation.md:1-16`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/.agents/invocation.md#L1-L16)). `ask-matt` serve como roteador humano.

A composição é por instrução textual `Call the Skill tool with "name"`, não por manifesto de dependências, import estático ou DAG executável. Isso mantém as peças simples, mas cria uma falha de confiabilidade:

- `grill-me` depende de `grilling` sem declarar isso ao instalador;
- `grill-with-docs` depende de `grilling` e `domain-modeling`;
- instalação seletiva pode criar wrappers incompletos;
- a própria documentação diz que mencionar outra skill não garante carregamento e que o problema segue aberto ([`docs/productivity/grilling.md:69-73`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/docs/productivity/grilling.md#L69-L73));
- um changeset pendente tenta elevar a taxa de acerto ao nomear explicitamente a Skill tool, evidência de que composição é probabilística ([`.changeset/skill-tool-invocation-terminology.md:5-9`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/.changeset/skill-tool-invocation-terminology.md#L5-L9)).

Extensão de tracker é feita por configuração Markdown em `docs/agents/`, inclusive texto livre para “other”. É flexível, mas sem interface tipada, validação ou teste de contrato. A filosofia “arquivos comuns que você pode editar” é excelente para fork/customização; ruim para upgrade seguro e compatibilidade verificável.

## Distribuição e integrações

### Distribuição

- **Claude Code:** plugin gerenciado/read-only, com 25 skills promovidas explicitamente. A listagem oficial da Anthropic fixa o mesmo SHA auditado ([marketplace oficial](https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json)). O marketplace oficial é adicionado automaticamente e tem auto-update ligado por padrão, conforme a [documentação oficial do Claude Code](https://code.claude.com/docs/en/discover-plugins).
- **Codex e outros harnesses:** `npx skills@latest add mattpocock/skills`, copiando arquivos editáveis. Cada skill tem metadados Codex, mas não existe plugin Codex nativo.
- **Razão do adiamento do plugin Codex:** o manifesto aceitaria um único path e a árvore mistura buckets promovidos e não promovidos; symlinks não sobreviveriam à instalação. A decisão está registrada em [`.agents/adr/0002...:7-23`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/.agents/adr/0002-ship-as-a-claude-code-plugin.md#L7-L23).

### Integrações operacionais

- GitHub via `gh`, inclusive issues, PRs, sub-issues, dependencies e assignee claim ([`issue-tracker-github.md:1-45`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/setup-matt-pocock-skills/issue-tracker-github.md#L1-L45));
- GitLab via `glab`, com fallback textual para blockers sem feature premium ([`issue-tracker-gitlab.md:1-46`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/setup-matt-pocock-skills/issue-tracker-gitlab.md#L1-L46));
- tracker local Markdown em `.scratch/` ([`issue-tracker-local.md:1-30`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/setup-matt-pocock-skills/issue-tracker-local.md#L1-L30));
- trackers customizados por prose;
- git, branches, worktrees, shell, navegador, `gh secret`, Mermaid/Tailwind via CDN nos artefatos visuais.

Não há `.mcp.json`, SDK, API, daemon, banco de estado, observabilidade ou integração first-class com CI além do release do próprio repositório. Há ainda drift documental: o README diz que setup pergunta “GitHub, Linear ou local” ([`README.md:74-80`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/README.md#L74-L80)), enquanto a skill oferece GitHub, GitLab, local e “other”, sem template de Linear ([`setup-matt-pocock-skills/SKILL.md:38-49`](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/setup-matt-pocock-skills/SKILL.md#L38-L49)).

## Pontos fortes

1. **Controle humano explícito:** decisões ficam com a pessoa; facts e legwork são delegados.
2. **Boa gramática de engenharia:** seams, deep modules, tracer bullets, red-capable loops, expand–contract e ADRs formam um vocabulário coerente.
3. **Artefatos transparentes e portáveis:** Markdown, issues, branches e commits são inspecionáveis sem banco proprietário.
4. **Higiene de contexto excepcionalmente articulada:** phase boundaries, pointers e fresh-context por ticket atacam degradação de contexto diretamente.
5. **Feedback determinístico onde importa:** TDD, repro de bug, typecheck e suíte completa são preferidos a avaliação puramente linguística.
6. **Peças pequenas e customizáveis:** é fácil copiar, editar e substituir uma skill sem adotar o conjunto inteiro.
7. **Documentação incomumente franca:** as páginas oficiais registram bugs e limites do próprio desenho, úteis para adoção consciente.

## Limites e lacunas para uma fábrica de software agêntica

1. **Não é uma fábrica autônoma:** não há scheduler, workers duráveis, run state, retries, budgets, queue, lease ou recovery.
2. **O ciclo promovido não fecha:** `implement` não fecha ticket, não marca critérios, não corrige findings e pode revisar um diff invisível.
3. **Sem rastreabilidade ponta a ponta:** decisões de grilling podem desaparecer antes de spec/ticket/test; não há matriz de cobertura.
4. **Separação autor/verificador não é obrigatória:** dois subagentes isolam eixos, mas o fluxo padrão mantém a review dentro da sessão autora.
5. **Review parcial:** Standards + Spec não substituem caça a defeitos, segurança, performance, test quality ou acceptance/UAT.
6. **Composição probabilística:** dependências entre skills são chamadas em prosa, sem resolução/instalação/verificação automática.
7. **Orquestração real está em beta:** `implement-spec`, `retro`, `pr` e controles arquiteturais determinísticos não são promovidos.
8. **Poucos gates do próprio framework:** sem suíte de eval, CI de comportamento, testes de trigger ou e2e da cadeia.
9. **Modelo-agnóstico só no formato:** comportamento crítico varia com modelo/effort, sem routing ou fallback embutido.
10. **Pesquisa subespecificada:** falta budget, stopping rule, freshness e verificador independente.
11. **Integrações são CLI/prose:** custom trackers não têm schema; não há MCPs ou adaptadores tipados.
12. **Drift e upgrade:** docs, changesets e manifesto podem representar estados diferentes; conteúdo deve ser pinado por SHA para reprodutibilidade.

## Leitura comparativa: onde ele se encaixa

Para uma fábrica de software agêntica, Matt Pocock Skills deve ser comparado em dois níveis:

- **Como método:** forte. Oferece boas práticas de discovery, decomposição, feedback, arquitetura e contexto em unidades fáceis de adotar.
- **Como sistema de produção:** incompleto. Espera que humano e harness forneçam orquestração, isolamento, persistência, gates, observabilidade e fechamento transacional.

A melhor incorporação não é substituir o orquestrador da fábrica, mas usar suas skills como **políticas de trabalho** dentro de um runtime que acrescente: DAG executável, dependências declaradas, artifact schema, autoria/verificação separadas, gates machine-readable, retry/resume e requisito→teste→review traceability.

## Claims ledger

- `{claim="O snapshot local coincide com origin/main e com o SHA pinado pela listagem oficial da Anthropic em 2026-09-23.", source="clone git ls-remote; https://github.com/mattpocock/skills/commit/c55ee46073ed923f86ce59a5eb3b6d895095d1b7; https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json lines 2301-2312", publisher="Matt Pocock; Anthropic", pub_date="2026-09-18; marketplace snapshot n.d.", accessed="2026-09-23", confidence="high", class="current-state"}`
- `{claim="O corpus contém 38 skills, 25 promovidas no plugin, 13 fora dele, e metadados Codex para todas as 38.", source="clone inventory; .claude-plugin/plugin.json:21-47; skills/**/agents/openai.yaml", publisher="Matt Pocock / mattpocock-skills", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="quantitative-structure"}`
- `{claim="O posicionamento central favorece skills pequenas, adaptáveis e composáveis, preservando controle humano em vez de possuir o processo.", source="README.md:15-19 https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/README.md#L15-L19", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="philosophy"}`
- `{claim="A cadeia principal documentada é grill-with-docs → to-spec → to-tickets → implement → code-review.", source="skills/engineering/ask-matt/SKILL.md:13-30; docs/engineering/implement.md:85-93", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="workflow"}`
- `{claim="grill-me é um wrapper stateless de uma linha sobre grilling; grilling usa árvore de decisões, frontier por rodada e confirmação humana final.", source="skills/productivity/grill-me/SKILL.md:1-7; skills/productivity/grilling/SKILL.md:6-28", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="discovery"}`
- `{claim="O frontier de grilling é heurístico, não um grafo computado, portanto o gate de completude é de julgamento do modelo.", source="docs/productivity/grilling.md:21-31 https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/docs/productivity/grilling.md#L21-L31", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="limit"}`
- `{claim="grill-with-docs persiste termos em CONTEXT.md e apenas decisões que passam três critérios em ADRs, deixando as demais decisões na conversa.", source="skills/engineering/domain-modeling/SKILL.md:60-74; docs/engineering/grill-with-docs.md:31-55", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="artifact"}`
- `{claim="O projeto não mantém um ledger que ligue cada decisão de elicitação a spec, ticket e teste; a própria documentação registra essa ausência.", source="docs/engineering/grill-with-docs.md:48-55 https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/docs/engineering/grill-with-docs.md#L48-L55", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="gap"}`
- `{claim="to-spec sintetiza o contexto sem nova entrevista, confirma seams e publica uma spec no tracker.", source="skills/engineering/to-spec/SKILL.md:7-20", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="planning"}`
- `{claim="to-tickets decompõe em slices verticais autocontidos, explicita blockers e exige aprovação humana; refactors largos usam expand-contract.", source="skills/engineering/to-tickets/SKILL.md:25-56", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="planning"}`
- `{claim="wayfinder representa planejamento multi-sessão como mapa e decision tickets no issue tracker, com frontier e claim por assignee.", source="skills/engineering/wayfinder/SKILL.md:19-80", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="planning-state"}`
- `{claim="implement é um fluxo serial de um ticket por sessão, com TDD, typecheck, suíte, review e commit, mas sem fechamento do work item.", source="skills/engineering/implement/SKILL.md:7-15; docs/engineering/implement.md:31-57", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="execution"}`
- `{claim="A ordem atual implement→review→commit é incompatível com uma review baseada em fixed-point...HEAD quando as mudanças ainda não foram commitadas.", source="skills/engineering/implement/SKILL.md:11-15; skills/engineering/code-review/SKILL.md:17-23; docs/engineering/implement.md:63-67", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="workflow-defect"}`
- `{claim="TDD exige seam previamente acordada, red antes de green e slices verticais; refactoring é postergado para review.", source="skills/engineering/tdd/SKILL.md:18-38", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="verification"}`
- `{claim="diagnosing-bugs contém o gate determinístico mais rígido: nenhuma hipótese antes de existir comando red-capable, determinístico, rápido e agent-runnable.", source="skills/engineering/diagnosing-bugs/SKILL.md:53-66", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="deterministic-gate"}`
- `{claim="code-review separa Standards e Spec em subagentes paralelos e não mistura os resultados.", source="skills/engineering/code-review/SKILL.md:6-11,58-87", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="review"}`
- `{claim="Não há enforcement de author != verifier; a documentação recomenda sessão fresca, mas implement chama review dentro do run autor.", source="docs/engineering/code-review.md:58-68; docs/engineering/implement.md:63-67", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="verifier-independence"}`
- `{claim="A review promovida cobre padrões e aderência à spec, não uma busca geral de bugs e edge cases.", source="docs/engineering/code-review.md:7-18", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="review-scope"}`
- `{claim="implement-spec descreve execução concorrente por task graph, worktrees, implementers e merger agent, mas está em in-progress e fora do plugin oficial.", source="skills/in-progress/implement-spec/SKILL.md:7-35; .claude-plugin/plugin.json:21-47", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="orchestration"}`
- `{claim="A gestão de contexto define uma árvore explícita de phase boundaries e recomenda contexto fresco por ticket.", source="skills/engineering/ask-matt/SKILL.md:28-32,61-71; skills/engineering/ask-matt/PHASE-BOUNDARIES.md:17-55", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="context-management"}`
- `{claim="A composição é textual via Skill tool e não possui manifesto de dependências; selective install pode deixar wrappers sem suas primitivas.", source=".agents/invocation.md:14-22; docs/productivity/grilling.md:69-73; docs/engineering/grill-with-docs.md:23-27", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="composition-gap"}`
- `{claim="Embora o README afirme compatibilidade com qualquer modelo, a própria documentação recomenda modelo mais forte para grilling e relata falhas em modelos/effort mais fracos.", source="README.md:17-19; docs/productivity/grill-me.md:67-68; docs/productivity/grilling.md:60-64", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="model-capability"}`
- `{claim="Nenhuma skill declara model routing por frontmatter, portanto a adaptação de capacidade é manual.", source="clone-wide search '^model:' across skills/**/SKILL.md returned zero", publisher="Matt Pocock / repository snapshot", pub_date="2026-09-18", accessed="2026-09-23", confidence="high", class="absence"}`
- `{claim="A distribuição promovida é plugin Claude Code; Codex recebe metadados, mas depende de skills.sh porque o plugin nativo foi adiado.", source="README.md:25-70; .agents/adr/0002-ship-as-a-claude-code-plugin.md:7-23", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="distribution"}`
- `{claim="O marketplace oficial da Anthropic inclui o plugin e usa SHA pinado; auto-update do marketplace oficial é ligado por padrão.", source="https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json lines 2301-2312; https://code.claude.com/docs/en/discover-plugins lines 528-535", publisher="Anthropic", pub_date="n.d.", accessed="2026-09-23", confidence="high", class="official-distribution"}`
- `{claim="As integrações first-class do setup são GitHub, GitLab e local Markdown; custom trackers são descritos em prose, e não há manifesto MCP.", source="skills/engineering/setup-matt-pocock-skills/SKILL.md:38-49; setup templates; clone inventory", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="integration"}`
- `{claim="Há drift entre README, que cita Linear, e a skill de setup, que oferece GitLab mas não template Linear.", source="README.md:74-80; skills/engineering/setup-matt-pocock-skills/SKILL.md:38-49", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="documentation-drift"}`
- `{claim="O repositório não contém suíte de teste/eval do comportamento das skills; seu único workflow CI é de release.", source="package.json:11-19; .github/workflows/release.yml:1-37; clone inventory", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="verification-gap"}`
- `{claim="research exige fontes primárias e um Markdown citado, mas não especifica stop rule, budget ou verificação independente.", source="skills/engineering/research/SKILL.md:6-12; docs/engineering/research.md:43-57", publisher="Matt Pocock", pub_date="snapshot 2026-09-18", accessed="2026-09-23", confidence="high", class="research-gap"}`
- `{claim="O conteúdo distribuído deve ser identificado por SHA, pois o snapshot package 1.2.3 contém 12 changesets pendentes e o marketplace fixa commit diretamente.", source="package.json:1-4; .changeset/*.md; official marketplace lines 2307-2311", publisher="Matt Pocock; Anthropic", pub_date="2026-09-18; n.d.", accessed="2026-09-23", confidence="high", class="versioning"}`

## Leads e ausências a investigar

### Leads

1. Executar um e2e controlado de `grill-with-docs → to-spec → to-tickets → implement → code-review` em Claude Code e Codex, medindo invocação real de dependências, artefatos omitidos e cobertura de critérios.
2. Testar `code-review` sobre três estados: working tree, staged e commitado, para quantificar o defeito de visibilidade do diff.
3. Avaliar `implement-spec` como futuro núcleo fabril: isolamento de worktrees, conflitos de merge, retries, idempotência e cleanup.
4. Inspecionar e acompanhar os bugs oficiais referenciados pelas próprias docs, especialmente recursão de research/code-review e falha de carregamento de skills compostas.
5. Criar um eval set de triggers positivos/negativos para as 11 skills model-invoked promovidas e comparar modelos/effort.
6. Verificar se os 12 changesets pendentes serão consolidados em nova versão e se o pin do marketplace continuará alinhado ao `main`.

### Ausências confirmadas no snapshot

- nenhum dependency manifest entre skills;
- nenhum schema de run/artifact/result;
- nenhum ledger decisão→spec→ticket→teste→review;
- nenhum scheduler/queue/retry/resume durável;
- nenhum enforcement de author/verifier independence;
- nenhum gate controller ou status agregado;
- nenhuma suíte de eval/test do conjunto;
- nenhum model routing ou budget por etapa;
- nenhum `.mcp.json` ou integração MCP empacotada;
- nenhuma telemetria de custo, tokens, tempo, qualidade ou taxa de sucesso;
- nenhum fechamento/reconciliação automática do ticket no fluxo `implement`;
- nenhum suporte promovido a execução paralela do task graph.

## Fontes oficiais principais

1. [Repositório e commit auditado — Matt Pocock](https://github.com/mattpocock/skills/commit/c55ee46073ed923f86ce59a5eb3b6d895095d1b7), commit de 2026-09-18, acesso em 2026-09-23.
2. [README no commit auditado](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/README.md), Matt Pocock, snapshot de 2026-09-18, acesso em 2026-09-23.
3. [Manifesto do plugin no commit auditado](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/.claude-plugin/plugin.json), Matt Pocock, snapshot de 2026-09-18, acesso em 2026-09-23.
4. [Marketplace oficial da Anthropic](https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json), Anthropic, sem data editorial, acesso em 2026-09-23.
5. [Documentação oficial de discovery e instalação de plugins](https://code.claude.com/docs/en/discover-plugins), Anthropic, sem data editorial, acesso em 2026-09-23.
6. Demais links inline apontam exclusivamente para arquivos do repositório oficial no SHA auditado.

## Nota epistemológica

Conclusões acima derivam apenas do clone autorizado, de comandos read-only executados nesta rodada e das fontes oficiais listadas. Relatos de falhas oriundos das páginas de documentação do próprio projeto foram tratados como **limitações autorrelatadas pelo publisher**, não como validação independente de frequência ou severidade. Não foram usados resultados de busca secundários, forks ou conhecimento de treinamento como evidência.
