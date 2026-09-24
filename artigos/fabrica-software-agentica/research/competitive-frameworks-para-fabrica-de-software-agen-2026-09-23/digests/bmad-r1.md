# BMAD Method — digest técnico para comparação de fábricas de software agênticas

Data da pesquisa: 2026-09-23  
Corpus autorizado: clone local oficial em /tmp/agentic-framework-research.z4Te2Y/bmad-method  
Escopo externo: somente páginas oficiais do projeto BMad/GitHub, consultadas nesta execução  
Método: inspeção estática de código, documentação, skills, templates, configuração, testes, CI e metadados Git; nenhuma conclusão depende apenas de conhecimento prévio.

## Síntese executiva

BMAD é melhor entendido como um método artifact-first e human-governed para organizar trabalho de software com agentes, e não como um runtime autônomo de “fábrica” completo. Sua unidade básica é uma skill instalada no ambiente do agente; os documentos produzidos — brief, PRD, SPEC, arquitetura, UX, épicos ou tickets, sprint status, logs de implementação, reviews e retrospectiva — carregam intenção, decisões, estado e handoffs entre sessões. A promessa central é aplicar o menor processo que ainda seja seguro: mudança trivial pode ir direto para implementação, uma unidade de trabalho usa Build, e iniciativas maiores recebem especificação, decomposição e coordenação proporcionais ao tamanho e ao risco. Evidência: README.md:8-14,55-64; skills/bmod-method/help/help.md:5-14,37-53.

O fluxo discover → plan → implement → verify → review existe, mas não como pipeline rígido. Discovery é um conjunto opcional de ferramentas independentes; bmad-spec funciona como hub de normalização; Build trabalha uma unidade por vez; verificação acontece dentro da implementação antes do review; e review usa lentes independentes com triagem explícita e loops de correção. Coordenação de múltiplas unidades fica fora de Build: um humano, um orquestrador ou o bmad-loop deve escolher o próximo trabalho. Evidência: docs/plan/choose-a-planning-path.md:48-65; docs/build/build-a-change.md:8-12,80-104; docs/build/autonomous-development-loops.md:8-16.

Há engenharia determinística real, mas ela envolve ilhas mecânicas ao redor de decisões semânticas feitas pelo modelo ou pelo humano: renderização content-addressed, gravação atômica, linters, parsers de status, validação de referências, testes, Git como fonte de evidência e matrizes teste-requisito. Não há um policy engine central que prove correção semântica. A separação autor/verificador é forte no isolamento de contexto — reviewers context-free, fresh chat e artefatos gravados antes de trocar de lente — porém não é uma separação forte de identidade: o Build exige reviewers de capacidade equivalente e recomenda, mas não obriga, outro modelo/provedor. Evidência: skills/bmad-build/step-03-implement.md:39-47; skills/bmad-build/step-04-review.md:11-12,27-84; skills/bmad-architecture/references/reviewer-gate.md:3-13; docs/build/review-a-change.md:122-140.

Para comparação de mercado, é essencial fixar canal e SHA. O clone analisado é o main não lançado, declara 6.13.0-next e inclui a migração v6→v7, enquanto o release estável oficial mais recente encontrado é v6.12.0. Parte importante do novo fluxo de ticketing ainda está explicitamente desacoplada de Build Auto e bmad-loop. Logo, “BMAD atual” não é uma superfície única: stable, main e funcionalidades preview têm graus diferentes de maturidade. Evidência: skills/bmod-method/bmod.toml:1-4; skills/bmod-core-tools/bmod.toml:1-4; skills/bmod-method/v6-v7-migration.toml:1-15,57-81; docs/build/autonomous-development-loops.md:64-100; [release oficial v6.12.0](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.12.0); [commit oficial analisado](https://github.com/bmad-code-org/BMAD-METHOD/commit/1b59caa7f96459fda6750c225a9330283e108fd6).

## Snapshot reprodutível do clone

| Item | Resultado |
|---|---|
| Repositório oficial | https://github.com/bmad-code-org/BMAD-METHOD |
| Branch / upstream | main / origin/main |
| SHA | 1b59caa7f96459fda6750c225a9330283e108fd6 |
| Data de autor e commit | 2026-09-22T18:05:22+08:00 |
| Commit | feat(bmad): module migrations, with the method module's v6 to v7 migration (#2935) |
| Forma do clone | shallow clone; 1 commit visível localmente; nenhum tag ref local |
| Estado de trabalho | limpo no início e ao final da inspeção |
| Versão declarada nos módulos | 6.13.0-next |
| Último release estável confirmado | v6.12.0, GitHub publicado em 2026-09-04; CHANGELOG local data o release em 2026-09-03 |
| Entradas rastreadas | 654: 653 arquivos regulares e 1 symlink |
| Prefixos de diretório rastreados | 168 |
| Distribuição principal | skills 316; docs 196; docs-site 64; tools 21; web-bundles 18; .github 14 |
| Extensões mais frequentes | Markdown 427; TOML 71; Python 58; JSON 16; MJS 15; YAML 14 |
| Skills | 32 pacotes no diretório skills: 30 capacidades operacionais e 2 agregadores de módulo |
| Workflows explícitos | 5 workflow.md e 21 arquivos step-*.md |
| Templates e schemas por nome | 24 arquivos com template no nome; 3 com schema no nome |
| Scripts Python de produção sob skills/*/scripts | 22, excluídos testes |
| Testes | 33 módulos: 28 test_*.py e 5 test-*.mjs |
| Casos de teste por contagem lexical | 248 funções Python def test_/async def test_; 50 chamadas test(/it( em MJS |
| CI | 5 workflows em .github/workflows |

Notas de interpretação:

- O clone shallow impede usar a ausência de tags locais como evidência sobre tags upstream. A confirmação de release foi feita na página oficial do GitHub.
- A contagem de testes é estrutural/lexical, não um resultado de execução. uv não está disponível no ambiente desta pesquisa; como o próprio repositório prescreve uv para renderização e qualidade, os testes não foram executados por um caminho alternativo não documentado.
- O único symlink rastreado é docs-site/src/content/docs.

## Filosofia e escala adaptativa

### Princípio central

O método se apresenta como “smallest safe path”. O tamanho do trabalho determina o número de sessões de build, enquanto stakes e risco determinam o peso de planejamento. As quatro fases — análise, planejamento, solução e implementação — são mapa conceitual, não sequência obrigatória. Evidência: skills/bmod-method/help/help.md:5-14.

Isso produz três escalas práticas:

1. Trivial: correção óbvia e segura pode dispensar skill formal.
2. Unidade única: Build investiga, planeja, implementa, verifica, revisa e corrige uma mudança.
3. Multiunidade: bmad-spec ou documentos de produto/arquitetura estabelecem a intenção; épicos/tickets ou sprint status fatiam; Build executa cada unidade; retrospectiva avalia o conjunto.

Evidência: skills/bmod-method/help/help.md:37-53; docs/plan/choose-a-planning-path.md:19-37,94-107; docs/build/build-a-change.md:14-25,149-170.

Dentro de Build há uma segunda adaptação: o default de customização propõe one-shot até 100 LOC e fluxo completo acima disso, com mais de cinco arquivos não triviais como sinal para considerar a rota completa. Esses limiares são configuração, não garantia universal. A documentação descreve uma unidade típica como cerca de 500 LOC fora testes e poucos arquivos, mas o critério decisivo é coesão e capacidade de caber numa sessão. Evidência: skills/bmad-build/customize.toml:29-44; docs/build/build-a-change.md:14-25.

Em artefatos de produto a profundidade também escala: o PRD deve ser curto para hobby/solo, intermediário para ferramenta interna e tão longo quanto as preocupações exigirem em launch/chain-top. Seções são adicionadas por risco real, não por checklist fixo. Evidência: skills/bmad-prd/SKILL.md:40-71.

### Leitura crítica

“Adaptativo” aqui significa roteamento heurístico guiado por escopo, risco e stakes, apoiado por defaults configuráveis. Não foi localizado um classificador quantitativo, benchmark de complexidade ou telemetria que aprenda automaticamente o tier adequado. A adaptação é uma política textual executada pelo modelo, com alguns thresholds determinísticos auxiliares.

## Fluxo ponta a ponta

### 1. Discover

Discovery não é uma fase obrigatória antes de toda implementação. Brainstorming, deep recon, product brief, PRFAQ, PRD e UX são ferramentas independentes acionadas conforme as lacunas de intenção. O guia diz explicitamente que podem ser usadas em qualquer ordem e que PRD só é necessário quando a coordenação exige mais definição. Evidência: docs/plan/choose-a-planning-path.md:48-65.

No PRD, Discovery começa por brain dump, calibra stakes, escolhe Fast ou Coaching path, levanta preocupações próprias do produto e pode delegar pesquisa a subagentes. O método tenta extrair a visão do usuário em vez de inventá-la. Evidência: skills/bmad-prd/SKILL.md:40-63.

Saídas possíveis:

- product brief para intenção e direção;
- PRFAQ para working backwards;
- PRD para requisitos coordenados;
- DESIGN.md e EXPERIENCE.md para visão visual e comportamental;
- relatório de pesquisa;
- ou nenhum artefato formal quando a mudança já está clara.

### 2. Plan

bmad-spec é o hub de normalização para uma intenção definida. Ele cria SPEC.md e, quando necessário, companions; mantém .memlog.md append-only como memória canônica da conversa; e modela um kernel mínimo de goal, scope, requirements, success e constraints. Evidência: skills/bmad-spec/SKILL.md:7-15,32-80,117-125.

Para trabalho maior, há duas famílias de decomposição:

- rota legada/estável: epics + stories + sprint-status.yaml;
- rota preview: árvore initiative → epic → story/bug/spike em tickets.toml e, opcionalmente, trackers externos.

O help proíbe misturar as duas rotas na mesma iniciativa. Evidência: skills/bmod-method/help/help.md:110-119; skills/bmad-preview-ticketing/SKILL.md:8-26,60-99.

Antes de Build implementar, step-02 investiga o repositório, completa Code Map e plano, faz self-review e exige checkpoint humano no fluxo completo. Após aprovação, relê o documento em disco e congela a seção de intenção. Evidência: skills/bmad-build/step-02-plan.md:10-43,45-67.

### 3. Implement

Build opera uma unidade coesa, não o projeto inteiro. O fluxo captura baseline Git, marca estado in-progress, executa tarefas sequencialmente e trata a SPEC como fonte de verdade. A implementação pode ser entregue a um subagente context-free; se isso não existir, ocorre inline. Não faz push automático. Evidência: skills/bmad-build/step-03-implement.md:9-35; skills/bmad-build/step-05-present.md:13-37.

O estado fica no frontmatter e nas seções append-only de Implementation Log, Change Log e Triage Log. O template separa intenção congelada de evidência operacional acumulada. Evidência: skills/bmad-build/spec-template.md:1-13,20-49,51-109.

### 4. Verify

Verificação é anterior ao review e está embutida no step de implementação:

- cada linha da Test Coverage Matrix deve corresponder a um teste executado e aprovado;
- falha corrigível volta à implementação;
- ambiguidade na intenção causa HALT;
- Git diff/staging produz a superfície concreta a revisar.

Evidência: skills/bmad-build/step-03-implement.md:39-47.

Há também verificações especializadas:

- readiness gate semântico em sprint planning, com PASS/CONCERNS/FAIL;
- parsing, ordenação, merge, escrita atômica e pós-validação determinísticos do sprint status;
- linter determinístico da arquitetura antes do reviewer gate;
- validações de referências, skills, manifests, Markdown/YAML/JSON e testes no pre-commit/CI.

Evidência: skills/bmad-sprint-planning/references/readiness-gate.md:3-20; skills/bmad-sprint-planning/references/generate-tracking.md:3-21; skills/bmad-architecture/references/reviewer-gate.md:3-13; .pre-commit-config.yaml:1-58; tools/quality.py:1-38; .github/workflows/quality.yaml:15-79.

### 5. Review

Build gera claims sobre o diff e dispara simultaneamente todas as lentes configuradas. O default combina quick review, blind hunter, edge-case hunter, verification-gap hunter e intent alignment. Cada finding precisa ser verificado e classificado high/medium/low/false/maybe-false; depois é roteado como intent_gap, bad_spec, patch ou defer. Correções são retestadas e o loop tem limite padrão de cinco iterações. Evidência: skills/bmad-build/customize.toml:93-186; skills/bmad-build/step-04-review.md:27-103.

O review é root-cause aware: um erro de intenção retorna ao humano, um erro da SPEC volta ao planejamento, um defeito de código é patch, e uma melhoria fora de escopo pode ser deferida. A documentação recomenda regenerar a partir da camada causal em vez de remendar o artefato downstream. Evidência: docs/build/build-a-change.md:80-104.

Para artefatos de planejamento, gates de reviewers paralelos também aparecem em PRD e arquitetura. Reviewers escrevem arquivos completos e retornam apenas resumos compactos ao contexto pai, reduzindo contaminação. Sem subagentes, o procedimento é sequencial, gravando o resultado antes de “limpar” contexto. Evidência: skills/bmad-prd/SKILL.md:73-83; skills/bmad-architecture/references/reviewer-gate.md:3-13.

### 6. Coordenação e aprendizagem após a unidade

Build Auto automatiza exatamente uma unidade por sessão: clarifica, planeja, implementa, revisa e atualiza status. Ele não escolhe a próxima story, não resolve dependências do projeto e não coordena o épico. Essas responsabilidades pertencem ao operador/orquestrador. bmad-loop é descrito como scheduler linear externo, sem grafo de dependências ou coordenação de projeto. Evidência: docs/build/autonomous-development-loops.md:8-33,107-136,226-289.

Ao fim de um épico, Retrospective coleta spec, stories, diffs, commits, sprint status e comportamento de execução; produz findings rastreados, ações e uma decisão de aceitação. Trabalho incompleto pode impedir aceitação. Evidência: skills/bmad-retrospective/workflow.md:1-5,43-104.

## Artefatos, contratos e estado

| Artefato | Função | Estado/contrato relevante | Evidência |
|---|---|---|---|
| Product brief | intenção inicial e direção | entrada opcional para planejamento | skills/bmod-method/help/help.md:81-108 |
| PRFAQ | testar conceito por working backwards | press release + perguntas duras | skills/bmod-method/help/help.md:81-108 |
| PRD | requisitos coordenados | frontmatter draft/final; memlog canônico; addendum para profundidade | skills/bmad-prd/SKILL.md:9-38,85-95 |
| DESIGN.md / EXPERIENCE.md | aparência e comportamento | visão UX separada em dois documentos | skills/bmod-method/help/help.md:81-108 |
| SPEC.md | contrato de uma unidade ou hub de intenção | kernel mínimo; companions; .memlog append-only | skills/bmad-spec/SKILL.md:7-15,32-80 |
| Architecture spine | invariantes e decisões difíceis de mudar | escala de minimal a platform; linter + reviewer gate | skills/bmad-architecture/SKILL.md:7-17,66-80 |
| Epics/stories | decomposição tradicional | uma rota de slicing, não deve coexistir com preview ticketing na mesma iniciativa | skills/bmod-method/help/help.md:110-119 |
| sprint-status.yaml | fila/estado da rota tradicional | estados e validação determinística; review em novo contexto recomendado | skills/bmad-sprint-planning/sprint-status-template.yaml:11-40 |
| tickets.toml | árvore preview | initiative/epic/story/bug/spike; sincronização com store externo | skills/bmad-preview-ticketing/SKILL.md:8-26,60-99 |
| Build SPEC | unidade executável | frontmatter de estado, intenção congelada, matrix, logs append-only | skills/bmad-build/spec-template.md:1-109 |
| claims/reviews | evidência do diff e lenses | findings classificados, verificados e roteados | skills/bmad-build/step-04-review.md:27-84 |
| Retrospective | gate do épico | decisão de aceitação + ações | skills/bmad-retrospective/workflow.md:73-104 |
| AGENTS.md project context | contexto barato de rederivar | pequeno, verificado, aprovado antes de escrever | skills/bmad-project-context/SKILL.md:6-12,31-76 |

O desenho de memória tem quatro mecanismos distintos:

1. memória conversacional durável: .memlog.md append-only, gravado atomicamente por script;
2. estado de workflow: frontmatter da SPEC, sprint-status.yaml ou tickets.toml;
3. contexto operacional: Code Map, Implementation Log, Change Log e Triage Log;
4. contexto permanente do repositório: bloco compacto em AGENTS.md, apenas com fatos caros de redescobrir.

Evidência: skills/bmad-spec/SKILL.md:32-64; skills/bmad-build/workflow.md:59-83; docs/existing-codebases/theory-of-project-context.md:13-29,70-108; docs/existing-codebases/set-and-maintain-project-context.md:8-11,77-119.

A estratégia reduz dependência de uma janela de chat contínua e favorece fresh chats entre fases. Entretanto, cria estado distribuído: frontmatter, memlogs, sprint status, tickets, arquivos de review e Git precisam permanecer coerentes. O repositório oferece parsers e scripts em pontos críticos, mas não uma transação única entre todos esses stores.

## Papéis e personas

| Persona | Especialidade e comportamento declarado | Entrega principal |
|---|---|---|
| Mary, Business Analyst | evidência, precisão, stakeholders, descoberta | pesquisa, brief, análise |
| John, Product Manager | converte visão em PRD/épicos/stories; busca menor coisa que valide | PRD e decomposição |
| Sally, UX Designer | necessidades humanas, experiência e interface | DESIGN.md / EXPERIENCE.md |
| Winston, Architect | trade-offs, estabilidade e produtividade do time | architecture spine |
| Amelia, Developer | implementa stories aprovadas, test-first, produção | código, testes e build record |

Evidência primária: skills/bmad-agent-analyst/customize.toml:3-49; skills/bmad-agent-pm/customize.toml:3-49; skills/bmad-agent-ux-designer/customize.toml:3-49; skills/bmad-agent-architect/customize.toml:3-49; skills/bmad-agent-dev/customize.toml:3-52.

Essas personas são fachadas/menu para as mesmas skills que também podem ser chamadas diretamente. A documentação distingue skill de agent menu e diz que as personas “podem” reter memória ou trabalhar autonomamente no futuro; isso não deve ser lido como autonomia persistente já entregue. Evidência: docs/reference/skills-and-agents.md:10-25,46-64; skills/bmod-method/help/help.md:130-142.

## Separação autor/verificador

O padrão mais forte observado é separação por contexto:

- reviewers recebem artefato/diff e não a cadeia de raciocínio do autor;
- PRD e arquitetura mandam escrever o review em arquivo antes de trocar de lente;
- Build abre reviewers context-free e em paralelo;
- review de sprint recomenda fresh context e, idealmente, modelo diferente.

Evidência: skills/bmad-build/customize.toml:107-186; skills/bmad-architecture/references/reviewer-gate.md:3-13; skills/bmad-sprint-planning/sprint-status-template.yaml:32-40.

O que não existe como gate rígido:

- prova de que autor e verificador são identidades, vendors ou famílias de modelo diferentes;
- quorum independente obrigatório;
- assinatura criptográfica ou provenance formal do reviewer;
- bloqueio técnico que impeça o mesmo modelo de executar autor e reviewer.

Ao contrário, Build declara que todos os review subagents devem usar a mesma capacidade de modelo. A documentação geral apenas recomenda modelos diferentes e descreve degradação quando o runtime não oferece subagentes. Portanto, para um comparativo, a formulação correta é “independência de contexto configurável”, não “verificação independente forte”. Evidência: skills/bmad-build/step-04-review.md:11-12; docs/build/review-a-change.md:122-140.

## Gates determinísticos e semânticos

| Gate | Parte determinística | Parte dependente de julgamento |
|---|---|---|
| Roteamento Build | thresholds configurados de LOC/arquivos | coesão, risco, reversibilidade, clareza de intenção |
| Planejamento Build | estado, arquivos e checkpoint persistidos | suficiência do plano e aprovação humana |
| Matrix Test Audit | teste existe, foi executado e passou | cobertura representa corretamente o requisito |
| Review loop | diff, claims, classes, limite de iteração, logs | validade e severidade de findings |
| Architecture gate | lint de placeholders, duplicatas e estrutura | qualidade da decisão arquitetural |
| Sprint planning | parser, ordem, merge, atomic write, pós-validação | readiness semântico PASS/CONCERNS/FAIL |
| Renderer | StrictUndefined, hashes de fonte/saída, staging e rename atômico | qualidade do conteúdo renderizado |
| Repositório | pre-commit, linters, testes e CI multiplataforma | adequação do prompt e do processo |
| Retrospectiva | inputs e formato estável/headless | decisão de aceitar ou rejeitar o épico |

O renderer é particularmente sólido como mecanismo de supply/build reproducibility: calcula identidade a partir de projeto, skill, renderer, Jinja, valores resolvidos e hashes das fontes; verifica hashes existentes; usa staging e rename atômico. Evidência: skills/bmad/scripts/render_skill.py:1-37,461-541,544-616.

Mas o próprio AGENTS.md limita testes automatizados a código determinístico e veta testes LLM/static prompt. A busca por nomes eval ou benchmark não encontrou harness de avaliação de qualidade do comportamento agêntico no clone. Assim, há boa verificação da infraestrutura, mas não evidência reproduzível no corpus para taxa de sucesso, redução de defeitos, custo, latência ou comparação com outros métodos. Evidência: AGENTS.md:18-25; ausência verificada por busca nominal no clone.

## Adaptação à capacidade e ao runtime do modelo

Capacidades presentes:

- fallback inline quando subagentes não estão disponíveis em Build e em gates documentais;
- Party Mode oferece modo de contextos independentes mais caro e fallback sem paralelismo;
- escolha entre fast/coaching e attended/headless em vários workflows;
- extração por subagentes para documentos grandes, preservando o contexto pai;
- requisito de mesma capacidade para reviewers de Build, evitando comparar lenses com modelos muito desiguais.

Evidência: skills/bmad-build/step-01-clarify-and-route.md:50-81; skills/bmad-prd/SKILL.md:69-83; docs/customize/run-multi-agent-discussions.md:41-76,112-151.

Limites:

- Build Auto requer subagentes; sem eles, deve bloquear em vez de degradar;
- não há detector geral de capacidade, roteador por benchmark, budget controller ou seleção automática de modelo por dificuldade;
- different model é recomendação, não enforcement;
- qualidade de gates semânticos depende do modelo hospedeiro e das ferramentas que ele expõe.

Evidência: docs/build/autonomous-development-loops.md:18-33; docs/build/review-a-change.md:122-140.

## Extensibilidade e customização

BMAD tem duas camadas claras de extensão.

### Customização de uma skill

Customizações podem vir do default da skill, override central do projeto, override local e override por invocação. O merge é estrutural; persona, fatos persistentes, hooks, menus, reviewers, templates, fontes externas, handoffs e padrões documentais são configuráveis. Alguns campos de identidade permanecem hardcoded, e o mecanismo documenta limites de remoção. Evidência: docs/customize/customize-bmad.md:8-49,57-99,194-270,272-397.

Isso permite:

- anexar fontes internas como Context7 ou Linear MCP;
- publicar resultados em Confluence/Jira via on_complete/external_handoffs;
- trocar templates e checklists;
- definir roster e personas do time;
- impor padrões de documentação por organização.

Evidência: docs/customize/adopt-bmad-across-a-team.md:34-53,83-110,130-151,153-229,259-345.

### Módulos

Módulos oficiais, comunitários ou privados agrupam agents, workflows e tasks. A instalação aceita qualquer repositório Git ou diretório local, em modo discovery via .claude-plugin/marketplace.json ou direct scan de diretórios com SKILL.md. O manifest instalado guarda versão e origem para atualização. Fontes não verificadas exibem warning de confiança. BMad Builder é o caminho oficial para criar módulos. Evidência: docs/customize/add-modules.md:8-34,89-178,203-252.

Esta é uma extensibilidade pragmática baseada em arquivos e convenções, não um SDK tipado com isolamento de plugins. O boundary de segurança depende da confiança na fonte e do ambiente host.

## Instalação e integrações

A documentação de início exige Node.js 20.12+, um host suportado e uv para skills renderizadas; Git é necessário para módulos externos. O instalador configura skills no IDE/agente. Evidência: docs/start/install-bmad.md:6-25,29-60; [documentação oficial de instalação](https://docs.bmad-method.org/start/install-bmad/).

Ambientes documentados incluem Claude Code, Cursor/Windsurf, Codex, Auggie, Amp, Cline, IBM Bob, Antigravity e AdaL, cada um com seu diretório de instalação. README também oferece marketplaces/plugins para Claude e Codex e web bundles para uso sem instalação local. Evidência: docs/reference/skills-and-agents.md:27-40; README.md:16-53,68-83.

O preview ticketing fornece stores configurados para:

- repo local Git-backed;
- GitHub via gh CLI 2.94+;
- Jira via acli oficial, com Rovo MCP opcional;
- Linear via MCP oficial;
- Notion via MCP oficial;
- Trello via MCP oficial, documentado como o encaixe mais fraco.

Evidência: skills/bmad-preview-ticketing/config/gh-ticketing.toml:1-23; jira-ticketing.toml:1-23; linear-ticketing.toml:1-27; repo-ticketing.toml:1-24; trello-ticketing.toml:1-28; references/store-setup.md:1-9.

Essas integrações são receitas/configurações sobre CLIs e MCPs oferecidos pelo host. O core não contém, no corpus inspecionado, um barramento próprio de eventos, scheduler distribuído, gestão de credenciais ou adapters compilados para esses SaaS.

## Pontos fortes

1. Proporcionalidade de processo. O mesmo método cobre correção pequena, feature em uma sessão e iniciativa multiépico sem exigir sempre o pacote completo.
2. Intenção e evidência explícitas. Goal, scope, requirements, success, constraints, frozen intent, test matrix e logs tornam handoffs auditáveis.
3. Brownfield-first. Build investiga o repositório, exige baseline Git e usa Code Map/JIT context antes de editar.
4. Review com triagem causal. Findings não viram patches cegos; voltam para humano, SPEC, código ou backlog conforme a origem.
5. Persistência entre sessões. Frontmatter, memlogs append-only, IDs estáveis e arquivos de status reduzem a dependência da memória do chat.
6. Infraestrutura reprodutível. Renderização content-addressed, escrita atômica, validação de manifests/referências e CI Linux/Windows são mais maduros que a média de coleções de prompts.
7. Extensão organizacional. Overlays, hooks, external sources/handoffs, stores de ticketing e módulos permitem adaptação sem fork integral.
8. Fronteira explícita da autonomia. Build Auto diz claramente o que não decide; isso reduz a falsa impressão de um agente geral autônomo.

## Limites, lacunas e riscos

1. Não é uma fábrica autônoma completa. Não há control plane central, scheduler de dependências, alocação dinâmica, filas, observabilidade de agentes, retry distribuído ou coordenação de portfólio no core.
2. Interoperabilidade ainda incompleta. bmad-spec não escreve mais stories.yaml; preview tickets.toml ainda não é lido por Build Auto ou bmad-loop. O workaround oficial é puxar um ticket por vez para arquivo. Evidência: docs/build/autonomous-development-loops.md:64-100.
3. Migração em curso. O SHA analisado adiciona a migração v6→v7, preserva caminhos v6 durante a transição e combina stable, next e preview. Comparações sem fixar SHA podem misturar gerações. Evidência: skills/bmod-method/v6-v7-migration.toml:1-15,57-81.
4. Independência de review limitada. Isolamento de contexto é bom, mas autor e verifier podem continuar sendo o mesmo modelo e provedor.
5. Gates semânticos não são determinísticos. “Ready”, “correct”, “coherent” e “intent aligned” continuam dependendo do julgamento do LLM/humano.
6. Dependência do runtime. Alguns fluxos degradam sem subagentes; Build Auto bloqueia. MCPs, CLIs, permissões e autenticação ficam fora do método.
7. Estado fragmentado. SPEC, memlog, sprint status, ticket store, Git e arquivos de review precisam ser sincronizados por disciplina e scripts específicos.
8. Ausência de eval público no clone. Não foi localizado benchmark reproduzível de qualidade, custo, latência, regressão de prompts ou comparação contra baseline. Claims de performance no CHANGELOG são claims do publisher, não evidência independente.
9. Overhead potencial. Fresh chats, múltiplas lenses, artefatos e gates melhoram rastreabilidade, mas podem elevar tokens e tempo. Não há medição de custo no corpus para quantificar a troca.
10. Extensões não verificadas são supply-chain risk. O instalador alerta sobre módulo não revisado, mas a confiança continua sendo responsabilidade do usuário.
11. Requisitos operacionais adicionais. Node, uv, Git e ferramentas/MCPs externos aumentam superfície de setup.
12. Persona não equivale a ator autônomo persistente. A própria ajuda posiciona memória/autonomia de personas como possibilidade futura.

## Posição comparativa para “fábrica de software agêntica”

| Dimensão | Avaliação baseada em evidência |
|---|---|
| Forma do produto | método + catálogo de skills + artefatos + instalador; não runtime único |
| Unidade de execução | uma mudança/story coesa por sessão de Build |
| Orquestração multiunidade | externa/humana; bmad-loop linear e limitado |
| Planejamento adaptativo | forte e explícito, porém majoritariamente semântico |
| Rastreabilidade | forte: IDs, SPEC, memlogs, matrices, logs, Git |
| Verificação determinística | boa para estrutura/estado/testes; parcial para significado |
| Independência de review | forte por contexto, fraca por identidade/model diversity obrigatória |
| Memória | artifact-first e durável, porém distribuída |
| Extensibilidade | alta via TOML, skills, módulos, hooks e MCP/CLI |
| Portabilidade de host | ampla na documentação; capacidades variam por runtime |
| Evidência empírica | insuficiente no clone para claims quantitativos de produtividade/qualidade |
| Maturidade do canal analisado | main 6.13.0-next em migração; stable oficial 6.12.0 |

## Ledger de claims

- {claim: "BMAD busca o menor caminho seguro e dimensiona o processo ao trabalho e aos stakes.", source: "README.md:8-14,55-64; skills/bmod-method/help/help.md:5-14", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "filosofia-documentada"}
- {claim: "As fases não são uma sequência obrigatória; discovery é um conjunto de ferramentas opcionais e independentes.", source: "skills/bmod-method/help/help.md:5-14; docs/plan/choose-a-planning-path.md:48-65", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "workflow-documentado"}
- {claim: "Build cobre investigar, planejar, implementar, verificar, revisar e corrigir uma unidade coesa.", source: "docs/build/build-a-change.md:8-25,80-104", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "workflow-documentado"}
- {claim: "O default de Build usa até 100 LOC como rota one-shot e acima disso como fluxo completo, com mais de cinco arquivos como sinal de escalada.", source: "skills/bmad-build/customize.toml:29-44", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "configuração-default"}
- {claim: "bmad-spec é o hub artifact-first e usa .memlog.md append-only como memória canônica do trabalho.", source: "skills/bmad-spec/SKILL.md:7-15,32-80", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "contrato-de-artefato"}
- {claim: "A implementação só deve seguir após o checkpoint do plano e congela a intenção aprovada.", source: "skills/bmad-build/step-02-plan.md:34-67", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "gate-de-processo"}
- {claim: "A verificação exige que cada linha da Test Coverage Matrix tenha teste executado e aprovado antes do review.", source: "skills/bmad-build/step-03-implement.md:39-47", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "gate-de-verificação"}
- {claim: "Reviewers de Build são context-free, executam em paralelo e cada finding é verificado, classificado e roteado; o loop padrão limita-se a cinco.", source: "skills/bmad-build/step-04-review.md:27-103; skills/bmad-build/customize.toml:93-186", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "review-documentado"}
- {claim: "BMAD separa autor e verifier por contexto, mas não obriga modelos ou provedores diferentes.", source: "skills/bmad-build/step-04-review.md:11-12; docs/build/review-a-change.md:122-140; skills/bmad-architecture/references/reviewer-gate.md:3-13", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "inferência-direta-do-design"}
- {claim: "Sprint planning combina readiness semântico com parsing, merge, escrita atômica e pós-validação determinísticos.", source: "skills/bmad-sprint-planning/references/readiness-gate.md:3-20; skills/bmad-sprint-planning/references/generate-tracking.md:3-21", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "arquitetura-de-gate"}
- {claim: "O renderer usa identidade content-addressed, StrictUndefined, hashes, staging e rename atômico.", source: "skills/bmad/scripts/render_skill.py:1-37,461-541,544-616", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "evidência-de-código"}
- {claim: "Build Auto executa uma unidade por sessão e deixa escolha do próximo item, dependências e coordenação do épico ao orquestrador.", source: "docs/build/autonomous-development-loops.md:8-33,107-136,226-289", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "limite-documentado"}
- {claim: "Preview tickets.toml ainda não é consumido por Build Auto ou bmad-loop; o workaround é executar um ticket extraído por vez.", source: "docs/build/autonomous-development-loops.md:64-100", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "lacuna-documentada"}
- {claim: "As rotas epics/sprint status e preview ticketing não devem ser usadas simultaneamente para o mesmo trabalho.", source: "skills/bmod-method/help/help.md:110-119", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "restrição-de-processo"}
- {claim: "A customização permite overlays, hooks, fatos persistentes, reviewers, templates, fontes externas e handoffs.", source: "docs/customize/customize-bmad.md:57-99,194-270; docs/customize/adopt-bmad-across-a-team.md:34-53,83-110,259-345", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "extensibilidade-documentada"}
- {claim: "Módulos podem vir de Git ou diretório local e são descobertos por marketplace.json ou scan de SKILL.md.", source: "docs/customize/add-modules.md:89-178,203-252", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "extensibilidade-documentada"}
- {claim: "O preview ticketing oferece stores para repo, GitHub, Jira, Linear, Notion e Trello, dependentes de CLIs ou MCPs do host.", source: "skills/bmad-preview-ticketing/config/*.toml; skills/bmad-preview-ticketing/references/store-setup.md:1-9", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "alta", class: "integração-configurada"}
- {claim: "O clone contém 654 entradas rastreadas, 32 pacotes de skill, 33 módulos de teste e 5 workflows de CI.", source: "contagem local via git ls-files e find no SHA 1b59caa7f96459fda6750c225a9330283e108fd6", publisher: "BMad Code", pub_date: "2026-09-22", accessed: "2026-09-23", confidence: "alta", class: "medição-do-corpus"}
- {claim: "Não foi localizado no clone um harness público de eval/benchmark do comportamento agêntico; os testes automatizados são orientados a código determinístico.", source: "AGENTS.md:18-25; busca local por nomes eval e benchmark sem resultados", publisher: "BMad Code", pub_date: "2026-09-22 (snapshot do commit)", accessed: "2026-09-23", confidence: "média-alta", class: "ausência-no-corpus"}
- {claim: "O release estável oficial mais recente consultado é v6.12.0.", source: "https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.12.0", publisher: "BMad Code / GitHub", pub_date: "2026-09-04", accessed: "2026-09-23", confidence: "alta", class: "metadata-oficial-de-release"}
- {claim: "O main analisado declara 6.13.0-next e o commit adiciona a migração v6→v7.", source: "skills/bmod-method/bmod.toml:1-4; skills/bmod-core-tools/bmod.toml:1-4; https://github.com/bmad-code-org/BMAD-METHOD/commit/1b59caa7f96459fda6750c225a9330283e108fd6", publisher: "BMad Code / GitHub", pub_date: "2026-09-22", accessed: "2026-09-23", confidence: "alta", class: "metadata-oficial-do-main"}
- {claim: "A instalação documentada exige Node.js 20.12+ e uv para skills renderizadas, com Git adicional para módulos externos.", source: "docs/start/install-bmad.md:6-25; https://docs.bmad-method.org/start/install-bmad/", publisher: "BMad Code", pub_date: "sem data visível; snapshot consultado em 2026-09-23", accessed: "2026-09-23", confidence: "alta", class: "requisito-oficial"}

## Leads para aprofundamento e ausências

### Leads prioritários

1. Repetir a análise no tag v6.12.0 para separar claramente stable de capacidades 6.13-next/v7.
2. Acompanhar quando tickets.toml passar a ser consumido diretamente por Build Auto e bmad-loop.
3. Inspecionar o repositório oficial bmad-loop para medir retry, isolamento, concorrência, scheduling e observabilidade; ele não faz parte deste corpus autorizado.
4. Inspecionar BMad Builder e Test Architect como módulos separados; este digest só confirma sua interface documentada a partir do repositório principal.
5. Executar a suite com uv em ambiente compatível e registrar duração, flakiness e cobertura real.
6. Criar benchmark comparativo controlado: mesma feature, mesmo modelo, mesmos testes; medir taxa de conclusão, findings verdadeiros/falsos, tokens, latência e retrabalho.
7. Rastrear as fontes acadêmicas originais citadas pela teoria de project context antes de repetir claims quantitativos; elas não foram importadas nesta execução.

### Ausências que não devem ser preenchidas por inferência

- Nenhum dado verificado de adoção, usuários ativos, stars ou downloads foi coletado.
- Nenhum preço, SLA comercial ou política de suporte foi encontrado/avaliado.
- Nenhuma evidência independente de produtividade ou redução de defeitos foi importada.
- Nenhum threat model ou auditoria de segurança dos módulos comunitários foi analisado.
- Nenhum teste de compatibilidade real foi executado nos hosts/IDEs listados.
- Nenhum claim de “20%”, “2x” ou semelhante deve entrar no artigo sem fonte primária e desenho experimental.
- Não foi provado que todos os templates ou configurações estão cobertos por testes; as contagens mostram volume, não cobertura.
- Não se deve tratar persona, Party Mode ou subagent como processo isolado/independente sem verificar o runtime específico.

## Links oficiais consultados

- [Repositório oficial BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)
- [Release oficial v6.12.0](https://github.com/bmad-code-org/BMAD-METHOD/releases/tag/v6.12.0)
- [Commit oficial do snapshot analisado](https://github.com/bmad-code-org/BMAD-METHOD/commit/1b59caa7f96459fda6750c225a9330283e108fd6)
- [Documentação oficial de instalação](https://docs.bmad-method.org/start/install-bmad/)

## Conclusão editorial

No espectro de fábricas agênticas, BMAD se destaca menos por “autonomia total” e mais por governança da produção: reduzir ambiguidade, preservar intenção, fatiar trabalho, construir com evidência e revisar em contextos separados. Seu diferencial técnico é a combinação de artefatos duráveis com gates mecânicos suficientes para tornar sessões de LLM auditáveis. Seu principal limite é exatamente o complemento dessa escolha: a fábrica — scheduler, coordenação multiagente, estado global, observabilidade e métricas de eficácia — continua majoritariamente a cargo do host e do operador. A comparação justa deve pontuar BMAD alto em método, rastreabilidade e customização; moderado em automação de uma unidade; e baixo, no core analisado, em orquestração autônoma multiunidade e evidência empírica reproduzível.
