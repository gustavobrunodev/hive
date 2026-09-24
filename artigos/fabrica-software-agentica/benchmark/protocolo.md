# Protocolo do benchmark — resultados ainda não executados

Este diretório prepara o benchmark sem antecipar resultado. A comparação deve ser rodada por etapa, porque penalizar uma ferramenta de implementação por não produzir PRD mistura **cobertura** com **qualidade**.

## Casos congelados

| Etapa | Entrada comum | Saída julgada | Ferramentas elegíveis | Status |
| --- | --- | --- | --- | --- |
| Discovery | Brief ambíguo + baralho de respostas do stakeholder | decisões, questões abertas, riscos e artefato de discovery | A definir antes da execução | Não executado |
| Planejamento | Brief/PRD aprovado + repositório-base | plano/spec/tasks, cobertura de requisitos e decisões irreversíveis | A definir antes da execução | Não executado |
| Implementação | Trabalho decidido + repositório-base | código, testes, escopo e provas | A definir antes da execução | Não executado |
| Verificação | Implementação com falhas conhecidas | detecção por check, evidência e falsos positivos | A definir antes da execução | Não executado |
| Review | Diff com defeitos semeados e dívida pré-existente | blockers/should-fix/nits, evidência e ruído | A definir antes da execução | Não executado |

## Variáveis que precisam ficar fechadas

- Mesmo commit do repositório-base e mesmo fixture por etapa.
- Mesmo input congelado e mesma baseline binária para todos.
- Versão/commit exato de cada framework.
- Mesmo modelo implementador, esforço, ferramentas e permissões.
- Juiz diferente do autor, com modelo fixado e contexto limpo.
- Sessão limpa entre runs: build, caches, dependências, dados e gerados removidos por script versionado.
- Pelo menos três repetições por ferramenta e etapa.
- Score calculado pelo `score.py`; o LLM só marca `true/false` com evidência.

## O que é pontuado

- I-checks: fatos observáveis no artefato/implementação.
- T-checks: testes que realmente provam o comportamento.
- Scope adherence.
- Gates computacionais: build, lint, typecheck e suíte.

## O que é reportado sem entrar no score

- Qualidade da elicitação e questões que o framework trouxe à tona.
- Tokens/custo, tempo de parede e quantidade de intervenções.
- Volume de artefatos e handoffs.
- Robustez adicional além do baseline.
- Variância entre repetições.

## Tabela de resultados

| Etapa | Capacidade | Superpowers | Matt Pocock skills | BMAD Method | TLC |
| --- | --- | --- | --- | --- | --- |
| Discovery | Qualidade / custo / variância | — | — | — | — |
| Planejamento | Qualidade / custo / variância | — | — | — | — |
| Implementação | Qualidade / custo / variância | — | — | — | — |
| Verificação | Recall / precisão / custo | — | — | — | — |
| Review | Recall / precisão / ruído / custo | — | — | — | — |

## Execução com Claude Workflows

O workflow versionado está em `.claude/workflows/benchmark-agentic-frameworks.js`. Ele executa **uma etapa por invocação**, respeitando a limitação de que dynamic workflows não aceitam input humano no meio do run. O preflight rejeita placeholders, inputs não congelados, menos de três repetições e versões não fixadas.

1. Copie `config.example.json` e preencha caminhos absolutos, commits e comandos exatos.
2. Congele input e baseline em git.
3. No Claude Code, use `/reload-skills` se o arquivo acabou de ser criado.
4. Peça: `Run /benchmark-agentic-frameworks com configPath=/caminho/absoluto/config.json`.
5. Revise o relatório da etapa antes de trocar `stage` e iniciar a próxima.

Referência da API e das limitações do runtime: [Claude Code — Dynamic workflows](https://code.claude.com/docs/en/workflows).

