# Product

## Register

brand

## Users

Desenvolvedores e tech leads das squads da Zup. Contexto: querem padronizar e
elevar o "harness" de agentes de código (rules + sensores + skills + MCPs) dos
projetos sem virar especialistas no assunto. Chegam à página para entender o que
é a skill `harness-builder`, como instalar e como ela funciona na prática —
tanto no setup inicial quanto na evolução contínua do projeto.

## Product Purpose

`harness-builder` é uma skill instalável via HIVE CLI em qualquer agente de
código (Cursor, Claude, Copilot, Devin, etc.). Seu `SKILL.md` orquestra quatro
módulos de referência (`harness-engineer`, `agent-rules-architect`,
`stack-presets`, `find-skills`) em `references/` para criar, avaliar e
**evoluir** o harness de qualquer projeto — guiada por harness engineering e
avessa a overengineering.

A skill **não é evento único**. Ela vive com o projeto:

- **Setup inicial** — playbook completo em seis fases: inventário, priorização
  com gate humano, rules, baselines, sensores, steering loop.
- **Evolução contínua** — pedidos scoped no dia a dia: nova biblioteca entrou,
  MCP candidato, falha recorrente do agente, rules desatualizadas, stack mudou,
  sensor virou ruído. A skill avalia se faz sentido incluir no harness — como
  rule, skill, MCP, sensor ou nada — e propõe só o que merece.

Sucesso = qualquer dev instala uma vez e usa a mesma skill tanto para montar o
harness quanto para mantê-lo preciso conforme o projeto evolui.

## Product Lifecycle

```text
Instala (HIVE CLI)
  └─ Setup inicial     → playbook completo (6 fases)
  └─ Evolução contínua → modos scoped (Harness / Rules / Find / Presets)
       └─ a cada mudança relevante no projeto
       └─ avalia → propõe → implementa só com aval
       └─ refina ou remove controles que viraram ruído
```

## Use Cases

### Playbook completo (setup ou overhaul)

| Situação | O que a skill faz |
| --- | --- |
| Projeto novo sem harness | Inventário + assessment + implementação priorizada |
| Harness nunca foi revisado | Audit completo; corta ruído acumulado |
| Squad quer padronizar de uma vez | Rules + baselines + sensores no mesmo método |

### Evolução contínua (scoped)

| Situação | Modo | O que a skill faz |
| --- | --- | --- |
| Nova biblioteca ou API integrada | Harness | Avalia rule, skill, MCP ou sensor — ou nada |
| MCP candidato (Linear, Datadog…) | Harness | Julga gap real vs. duplicação; custo de manutenção |
| Agente repete o mesmo erro | Harness | Propõe guide, sensor ou ambos — mínimo necessário |
| AGENTS.md inchado ou desatualizado | Rules | Revisa, aplica inference test, enxuga |
| Buscar capacidade especializada | Find | Pesquisa, valida, instala com aval |
| Novo módulo/stack no monorepo | Presets | Presets de ai-tools (skills + MCPs) idempotentes + lacunas restantes |
| Sensor/linter dispara demais | Harness | Refinar, reposicionar ou remover |
| Reviews de PR do agente pioraram | Harness / Full | Assessment focado nas falhas observadas |

Exemplo de pedido (evolução):

> Integrei o TanStack Query — faz sentido incluir no harness? Como rule, skill
> ou MCP?

## Brand Personality

Confiante, técnica, precisa. Voz institucional Zup: períodos curtos, linguagem
inclusiva, sem emojis. Sensação alvo: excelência de engenharia e clareza — "menos
retrabalho, mais precisão". O produto **acompanha** o projeto; não vende setup
como fim em si.

## Anti-references

- Landing de SaaS genérica: hero-metric template, grids de cards idênticos,
  eyebrows minúsculos em maiúsculas acima de cada seção.
- Estética "AI slop": gradientes lineares/radiais simples, cantos super
  arredondados, texto com gradiente, glassmorphism decorativo.
- Dump de documentação. A página comunica e convida, não substitui o README.
- Posicionar a skill como "instala e esquece". O harness evolui; a página deve
  mostrar os dois momentos (setup + evolução).

## Design Principles

1. **Pratique o que prega** — a própria página é um harness preciso: nada
   supérfluo, cada seção ganha seu lugar.
2. **Mostre os dois fluxos** — playbook completo *e* evolução contínua com casos
   de uso concretos (prompt de exemplo > adjetivo).
3. **Identidade Zup inegociável** — paleta, tipografia e formas próprias da marca
   conduzem cada decisão visual.
4. **Clareza acima de ornamento** — contraste alto, hierarquia óbvia, movimento
   só onde esclarece.

## Accessibility & Inclusion

WCAG AA: corpo ≥ 4.5:1, alvos de toque ≥ 44px, foco visível, `prefers-reduced-motion`
respeitado, zoom até 200% sem quebra, navegação por teclado.
