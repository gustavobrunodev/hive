---
title: 'Pesquisa competitiva: frameworks para fábrica de software agêntica'
type: competitive
topic: frameworks para fábrica de software agêntica
decision: esclarecer encaixe, composição e escolha contextual
source: repositórios locais e fontes oficiais
status: complete
preset: deep
validation: high
created: '2026-09-23'
updated: '2026-09-23'
---

# Pesquisa competitiva: frameworks para fábrica de software agêntica

**Decisão atendida:** onde Superpowers, Matt Pocock Skills, BMAD Method e TLC entram no fluxo, como combiná-los e qual conjunto se ajusta a diferentes squads.

## Recomendação executiva

Não selecionar um vencedor universal. Tratar os quatro projetos como componentes em camadas:

1. **Superpowers:** método portátil e opinionado para execução disciplinada dentro de plano/branch.
2. **Matt Pocock Skills:** capacidades pequenas para elicitação, domínio, tickets, TDD e diagnóstico.
3. **BMAD:** governança artifact-first para produto, UX, arquitetura, handoffs e memória entre sessões.
4. **TLC:** núcleo de delivery com checks, provas, verificador separado e review de PR.

Para uma squad comum, a composição de maior cobertura é BMAD no upstream e TLC no delivery, usando Matt para capacidades pontuais e Superpowers como política local de coding agents. Para modelos de implementação menos capazes, preferir TLC spec-driven ou planos detalhados do Superpowers; para modelos frontier, preferir TLC spec-lean/implement com checks rigorosos. A capacidade relevante é a do **implementador**, não apenas a do agente que planejou.

## Método e corpus

Foram feitos clones rasos dos quatro repositórios em diretório temporário, inventário estrutural, leitura das skills centrais, scripts, testes, documentação e confirmação em páginas oficiais. Os digests completos estão em `digests/`.

| Projeto | SHA analisado | Superfície observada |
| --- | --- | --- |
| Superpowers | `5bf4e78011075bcfc0dc295f0724994cd123ee71` | 231 arquivos, 15 skills; v6.4.1 |
| Matt Pocock Skills | `c55ee46073ed923f86ce59a5eb3b6d895095d1b7` | 38 skills no corpus; 25 promovidas; v1.2.3 |
| BMAD Method | `1b59caa7f96459fda6750c225a9330283e108fd6` | main 6.13.0-next, 32 pacotes de skill; stable v6.12.0 |
| TLC Agent Skills | `120b67676388241b314699fa8fa9af25ada6d1d4` | 1.156 arquivos, 92 skills; catálogo 0.17.9 |

Validação local: seis conjuntos de helpers do Superpowers passaram; o selftest de TLC spec-lean matou 46/46 mutantes. A suíte completa TLC não pôde ser executada porque o snapshot exige Node 24, o ambiente possui Node 22.22.1 e o lockfile não contém algumas dependências declaradas. Testes BMAD não foram executados porque `uv`, prescrito pelo projeto, não estava disponível. Matt não apresentou suíte de avaliação comportamental no corpus.

## Achados centrais

### 1. Não são produtos equivalentes

Superpowers governa comportamento do coding agent; Matt fornece peças combináveis; BMAD organiza produto e entrega por artefatos; TLC enfatiza verificação e evidência. A comparação deve separar **cobertura do ciclo** de **qualidade dentro da capacidade coberta**.

### 2. O gargalo migrou de geração para prova

Os quatro métodos tentam corrigir falhas de sessões longas, implementação prematura e conclusão sem evidência. A família TLC faz isso de modo mais explícito com checks, validators, verificador e mutação. Superpowers traz TDD e helpers mecânicos. BMAD usa test matrix e lenses. Matt exige feedback determinístico em TDD e diagnóstico. A degradação de recuperação em contexto longo é coerente com evidência acadêmica existente [5].

### 3. Separação autor/verificador varia

- Superpowers: forte no SDD, mas degrada no Native/fallback.
- Matt: reviewers distintos por eixo, sem invariável `autor != verificador`.
- BMAD: bom isolamento de contexto, sem identidade/modelo diferente obrigatório.
- TLC: separação estrutural mais explícita no core analisado.

Logo, “subagente” não deve ser confundido automaticamente com independência. É necessário registrar contexto, identidade, evidência e autoridade de veto.

### 4. Nenhum dos quatro é uma fábrica autônoma completa

Não foi observado, nos cores analisados, um control plane completo com intake, scheduler de dependências, filas, retries distribuídos, observabilidade de frota, deploy e feedback de produção. BMAD chega mais longe na governança e integrações; TLC publica a direção event-driven, mas marca Entry, Triage e Production como futuras no v1 [4].

### 5. Composição funciona nas fronteiras de artefatos

Combinações recomendadas:

- `grill-me` → artefato durável → TLC plan/implement/judge;
- BMAD brief/PRD/UX/arquitetura → spec/slice → TLC delivery;
- tracker/BMAD organizacional → Superpowers dentro da branch;
- modelo barato → spec-driven/plano granular → verificador forte;
- modelo frontier → spec-lean → checks e review independente.

Anti-padrão: dois frameworks governando simultaneamente discovery, spec ou política de commit sem uma fonte de verdade definida.

## Síntese comparativa

| Dimensão | Superpowers | Matt Pocock Skills | BMAD | TLC |
| --- | --- | --- | --- | --- |
| Posição | método de execução | toolbox humana | sistema artifact-first | core de delivery/prova |
| Discovery | forte | forte | muito amplo | forte e focado |
| Produto/UX | limitado | parcial | mais completo | complementar |
| Planejamento | detalhado | vertical/componível | adaptativo | checks/superfícies |
| Implementação | SDD/Native | um ticket/sessão | Build/unidade | driven/lean |
| Verificação | TDD + helpers | loops do repo | matrix + lenses | verifier + validators + mutação |
| Estado | arquivos/Git, parte efêmera | tracker/Markdown distribuído | artefatos e logs duráveis | specs/state/lessons/reports |
| Orquestração fabril | externa | externa | parcial/externa | core parcial; bordas futuras |
| Customização | adaptadores/skills | máxima granularidade | overlays/módulos/hooks | skills/perfis/variantes |

## Recomendação por squad

- **PM + TL + UX + QA + Dev:** BMAD upstream, TLC delivery; Matt como toolbox; Superpowers opcional como política local.
- **PM + TL + UX:** BMAD proporcional + TLC; reservar verifier independente e prova visual porque QA/Dev não estão dedicados.
- **PM + TL:** brief/PRD enxuto, UX obrigatória para interface, arquitetura só para decisões irreversíveis, TLC driven/lean conforme modelo.
- **TL + Devs:** Matt/TLC para não aceitar demanda sem discovery; Superpowers ou TLC na execução; BMAD apenas em iniciativas ambíguas/multistakeholder.
- **Solo/frontier:** Matt + TLC lean + verifier fresco; BMAD somente quando a memória e os handoffs justificarem.
- **Regulado/legado crítico:** BMAD para rastreabilidade + TLC driven/standard + gates CI + identidade verificadora separada.

## Riscos e condições de adoção

1. Fixar versões por SHA: todos os projetos evoluem rapidamente; BMAD main estava em migração.
2. Não confundir instrução forte com enforcement: transformar regras críticas em scripts/gates.
3. Reter evidências exigidas por auditoria; alguns fluxos apagam workspaces temporários.
4. Definir rota por capacidade/risco, evitando que cada squad escolha driven/lean arbitrariamente.
5. Medir custo, latência, intervenções e variância além da taxa de acerto.
6. Não repetir claims de produtividade do publisher como fato independente.

## Benchmark

Nenhum resultado foi produzido. O protocolo, a tabela vazia e o workflow ficam em `../../benchmark/` e `.claude/workflows/benchmark-agentic-frameworks.js`. O desenho fixa input, baseline, commit, modelo, esforço e permissões; exige N≥3, sessões limpas, juiz diferente do autor, checks binários com evidência e score determinístico.

## Fontes

1. [Superpowers — repositório e snapshot analisado](https://github.com/obra/superpowers/tree/5bf4e78011075bcfc0dc295f0724994cd123ee71), acesso em 2026-09-23.
2. [Matt Pocock Skills — snapshot analisado](https://github.com/mattpocock/skills/tree/c55ee46073ed923f86ce59a5eb3b6d895095d1b7), acesso em 2026-09-23.
3. [BMAD Method — snapshot analisado](https://github.com/bmad-code-org/BMAD-METHOD/tree/1b59caa7f96459fda6750c225a9330283e108fd6) e [documentação oficial](https://docs.bmad-method.org/), acesso em 2026-09-23.
4. [TLC Agent Skills — snapshot analisado](https://github.com/tech-leads-club/agent-skills/tree/120b67676388241b314699fa8fa9af25ada6d1d4) e [TLC AI Dev Flow](https://agent-skills.techleads.club/tlc-ai-dev-flow/), acesso em 2026-09-23.
5. Liu et al., [Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172), 2023.
6. [Claude Code — Dynamic workflows](https://code.claude.com/docs/en/workflows), acesso em 2026-09-23.

## Mapa de staleness

- **Muito volátil (revalidar mensalmente):** versões, catálogo de skills, status preview/stable, instalação e compatibilidade de runtimes.
- **Volátil (revalidar trimestralmente):** workflows promovidos, gaps de integração, suporte a trackers e políticas de modelos.
- **Mais durável (revalidar anualmente):** filosofia dos métodos, princípios de contexto, separação autor/verificador e desenho do benchmark.

Documento editorial derivado: `../../artigo.md`.
