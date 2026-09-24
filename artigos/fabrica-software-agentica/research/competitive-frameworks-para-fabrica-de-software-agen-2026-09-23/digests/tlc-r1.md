# Digest — Tech Leads Club Agent Skills

## Corpus inspecionado

- Clone: `/tmp/agentic-framework-research.z4Te2Y/tlc-agent-skills`
- SHA: `120b67676388241b314699fa8fa9af25ada6d1d4`
- Último commit do snapshot: `2026-09-20T09:37:16-03:00`
- Estrutura observada: 1.156 arquivos fora de `.git`, 92 arquivos `SKILL.md`, catálogo `0.17.9`, CLI `1.5.0`, MCP `0.1.7`.
- Núcleo analisado integralmente: `tlc-discover`, `tlc-plan`, `tlc-implement`, `tlc-spec-driven`, `tlc-spec-lean`, `the-judge`; também foram inspecionados o catálogo, README, SECURITY, scripts de validação e referências de verificação/contexto.
- Verificação executada: `tlc-spec-lean/scripts/selftest.py` passou o baseline, matou 46/46 mutantes, passou controles negativos e smoke tests dos scripts.
- Limite do ambiente: o `npm ci --ignore-scripts` do monorepo não concluiu. O snapshot requer Node `>=24` e o ambiente tem Node `22.22.1`; além disso, o `package-lock.json` do snapshot não contém algumas dependências declaradas. Isso impede usar a suíte inteira como evidência nesta execução, mas não afetou o selftest Python isolado.

## Síntese

A TLC não é uma única metodologia. O catálogo oferece dois níveis complementares:

1. Uma linha modular de fábrica: `tlc-discover → tlc-plan → tlc-implement → the-judge`.
2. Fluxos integrados de feature: `tlc-spec-driven` e `tlc-spec-lean`.

O traço mais forte é deslocar rigor de instruções genéricas para obrigações observáveis, provas nomeadas, scripts com exit code e separação estrutural entre autor e verificador. A família é a mais explícita do corpus quanto a perfis de verificação, teste de discriminação/mutação, orçamento de contexto e gates mecânicos. Sua fábrica TO-BE publicada ainda é incompleta como sistema orientado a eventos: o v1 entrega discovery, planejamento, implementação e gate de PR; entry, triage e feedback de produção são estações declaradas como futuras.

## Cobertura do ciclo

| Etapa | Capacidades | Cobertura observada |
| --- | --- | --- |
| Discover / research | `tlc-discover` | Forte: separa situação, problema, veredito e shape; proíbe propor tecnologia antes do veredito; produz design document por fatias verticais. |
| Plan | `tlc-plan`, Plan do `tlc-spec-lean`, Specify/Design/Tasks do `tlc-spec-driven` | Forte: critérios observáveis, valores concretos, superfície e nove dimensões implícitas; variantes granular e lean. |
| Implement | `tlc-implement`, Execute do driven, Build do lean | Forte: testes derivados de checks, commits coerentes/atômicos conforme variante, provas executadas e escopo explícito. |
| Verify | verifier de `tlc-implement`, `tlc-spec-*` | Muito forte: autor ≠ verificador, evidência-ou-zero, perfis, mutação/fault injection, relatórios e gates de conclusão. |
| Review | `the-judge` | Muito forte para PR: checks determinísticos primeiro, seis lentes, pesquisa oficial obrigatória, filtro de evidência e noise budget. |
| Intake / triage / produção | proposta do TLC AI Dev Flow | Parcial/futuro: são estações do modelo publicado, mas a página oficial marca Entry, Triage e Production como ainda em construção no v1. |

## Evidências locais relevantes

- `tlc-discover/SKILL.md:12-24`: discovery termina em design document planejável, não só conversa.
- `tlc-discover/SKILL.md:26-34`: regras de não convergir cedo, não propor tecnologia antes do veredito e escalar alto impacto/baixa clareza para RFC ou spike.
- `tlc-plan/SKILL.md:32-50`: fatias verticais e default de uma task por fonte; separa task de PR e dimensiona por portas irreversíveis.
- `tlc-plan/SKILL.md:66-99`: caminhada das superfícies e sweep fixo das nove dimensões; `tlc-implement` consome os landings em vez de redescobrir.
- `tlc-implement/SKILL.md:14-19`: `EXTRACT → BUILD → VERIFY`, sem prescrever como o modelo constrói.
- `tlc-implement/SKILL.md:32-50`: perfis `light`, `standard`, `ui`, com classes de falha explicitamente cobertas e não cobertas.
- `tlc-implement/SKILL.md:52-60`: prova por check, testes derivados do checklist, checks congelados e Verifier fresco obrigatório.
- `tlc-implement/SKILL.md:93-127`: handoff por fatias inteiras e orçamento de leitura; verificação despachada pelo orquestrador depois do último lote.
- `tlc-spec-driven/SKILL.md:29-46`: gates por task e quatro validadores Python; non-zero interrompe o fluxo.
- `tlc-spec-driven/SKILL.md:48-67`: auto-sizing Small/Medium/Large/Complex.
- `tlc-spec-driven/SKILL.md:69-117`: `.specs/`, `STATE.md`, `LESSONS.md`, carregamento sob demanda e orçamento alvo.
- `tlc-spec-driven/SKILL.md:119-133`: workers por lote, Verifier obrigatório, outcome check e sensor de discriminação, loop limitado a três.
- `tlc-spec-lean/SKILL.md:21-43`: congela obrigações e provas, elimina task breakdown e microcoreografia.
- `tlc-spec-lean/SKILL.md:45-69`: Verifier fresco e gate `validate_verification.py` são invariantes.
- `tlc-spec-lean/SKILL.md:116-170`: `plan.md`, `checks.md`, `verification.md`; preserva apenas shape difícil de reverter, deixa detalhe reversível no diff.
- `tlc-spec-lean/SKILL.md:206-242`: validators e selftest por fault injection.
- `the-judge/SKILL.md:14-25`: evidence-or-silence, pesquisa oficial, noise budget e gate de comentários.
- `the-judge/SKILL.md:63-96`: ladder determinístico, seis passes e verificação dos candidatos.
- `the-judge/SKILL.md:181-196`: contrato de convergência e limite de rounds.

## Pontos fortes sob a lente `dev-ia-avancado`

- **Quem verifica:** separação autor/verificador é explícita e estrutural nas variantes de implementação.
- **Determinismo:** validators, selftests, scanners e review gate convertem regras processuais em exit code.
- **Prova:** cada check liga uma afirmação observável a uma prova concreta; mutação mede discriminação do teste.
- **Contexto:** carregamento progressivo, handoffs por fronteira de superfície e artefato+diff em vez de resumo narrativo.
- **Capacidade do modelo:** oferece caminho granular (`spec-driven`) e caminho sem tasks (`spec-lean`/`tlc-implement`), além de tiers por papel.
- **Composição:** cada estação é uma skill autônoma e o catálogo também traz arquitetura, UX/design, segurança, browser e qualidade.
- **Review:** `the-judge` cobre explicitamente o que a verificação de feature não cobre bem — segurança, estrutura, regressão/AI slop e alegações do PR.

## Limites e riscos

- A linha publicada ainda não fecha intake, triage e produção; portanto, hoje ela é um core de delivery, não uma fábrica end-to-end pronta.
- `light` é conscientemente incompleto: não detecta membro de conjunto sem prova nem teste que passaria sob implementação errada. Times precisam declarar `standard`/`ui` conforme risco.
- O `spec-driven` cobra mais paradas, artefatos e commits; com modelo frontier pode virar babysitting. O `spec-lean` transfere responsabilidade para um modelo capaz de seguir checks.
- A composição deixa a escolha do caminho com o time; sem regra de roteamento, duas squads podem usar skills diferentes para o mesmo tipo de trabalho.
- As alegações de benchmark da própria TLC têm conflito de origem: são úteis e reproduzíveis, mas continuam sendo benchmark do fabricante.
- Algumas heurísticas são configuração, não lei: 150k para lote, três iterações e perfis são defaults do snapshot.
- O snapshot de `main` apresentou requisito Node 24 e lockfile incompatível com `npm ci`; tratar como caveat de operabilidade do snapshot, não como conclusão sobre a metodologia.

## Claims

- `{claim: "O core atual da fábrica TLC é tlc-discover → tlc-plan → tlc-implement → the-judge; Entry, Triage e Production ainda não estão entregues no v1.", source: "https://agent-skills.techleads.club/tlc-ai-dev-flow/", publisher: "Tech Leads Club", pub_date: "2026", accessed: "2026-09-23", confidence: "high", class: "capability"}`
- `{claim: "tlc-spec-driven 3.3.0 oferece quatro fases adaptativas e gates Python para spec, tasks, commits e conclusão.", source: "https://github.com/tech-leads-club/agent-skills/blob/120b67676388241b314699fa8fa9af25ada6d1d4/packages/skills-catalog/skills/%28development%29/tlc-spec-driven/SKILL.md", publisher: "Tech Leads Club", pub_date: "2026-09-20", accessed: "2026-09-23", confidence: "high", class: "capability"}`
- `{claim: "tlc-spec-lean elimina task breakdown e exige plano humano, checks com prova e Verifier independente.", source: "https://github.com/tech-leads-club/agent-skills/blob/120b67676388241b314699fa8fa9af25ada6d1d4/packages/skills-catalog/skills/%28development%29/tlc-spec-lean/SKILL.md", publisher: "Tech Leads Club", pub_date: "2026-09-20", accessed: "2026-09-23", confidence: "high", class: "capability"}`
- `{claim: "the-judge usa seis passes, pesquisa oficial obrigatória, evidence-or-silence e um gate determinístico antes de publicar review.", source: "https://github.com/tech-leads-club/agent-skills/blob/120b67676388241b314699fa8fa9af25ada6d1d4/packages/skills-catalog/skills/%28quality%29/the-judge/SKILL.md", publisher: "Tech Leads Club", pub_date: "2026-09-20", accessed: "2026-09-23", confidence: "high", class: "capability"}`
- `{claim: "O selftest de tlc-spec-lean matou 46 de 46 mutantes no snapshot clonado.", source: "execução local de scripts/selftest.py em 2026-09-23", publisher: "observação desta pesquisa", pub_date: "2026-09-23", accessed: "2026-09-23", confidence: "high", class: "verification"}`

## Ausências e leads

- Não foi encontrado benchmark independente comparando a TLC com os outros três frameworks sob o mesmo caso, modelo e baseline.
- A suíte completa do monorepo não foi executada pela incompatibilidade de engine/lock; repetir em Node 24 com snapshot releaseado seria uma checagem operacional útil.
- O Harness Toolkit é complementar, não parte do core analisado aqui; autonomia de shell/git/arquivos exigiria uma avaliação separada.
