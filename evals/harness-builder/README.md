# Evals — harness-builder

Casos para o `bmad-eval-runner`. Ficam fora de `skills/harness-builder/` de
propósito: aquela pasta é uma cópia substituível em bloco, e os evals têm que
sobreviver à troca.

Dois arquivos de casos porque destino e origem de uma fixture são **o mesmo
caminho** no runner — para o repo-fixture pousar na raiz do workspace, o
`--project-root` tem que apontar para ele. Um `--project-root` por execução,
logo um arquivo de casos por fixture.

| Arquivo | Fixture | Casos |
| --- | --- | --- |
| `cases-greenfield.json` | `fixtures/greenfield-api` — repo sem harness, lacunas óbvias | primeira passada, pedido estreito, gate de aprovação |
| `cases-with-harness.json` | `fixtures/with-harness` — já tem `HARNESS.md` com §7 povoada | modo update, respeito a recusa anterior |
| `triggers.json` | — | 8 should-trigger / 8 should-not, com near-misses de palavra-chave |
| `variant-prev/` | — | snapshot da versão anterior da skill (pré-padrão HARNESS.md) |

## Pré-requisitos

O runner monta um `HOME` vazio por caso — é o contrato de isolamento, para que
memórias e config do host não enviesem o resultado. Consequência: **login OAuth
do host não atravessa**. É preciso `ANTHROPIC_API_KEY` exportada (o adapter só
repassa se estiver não-vazia).

O `claude` precisa estar no `PATH`. Dentro do VS Code dá para usar o binário da
extensão sem editar o adapter:

```bash
python3 -c "import json;p='evals/harness-builder/adapter.json';a=json.load(open(p));a['invocation'][0]='$CLAUDE_CODE_EXECPATH';json.dump(a,open(p,'w'),indent=2)"
```

> **Cuidado com falso negativo de auth.** `run_triggers.py` manda o stderr do
> subprocesso para `DEVNULL` e não checa o exit code — só procura o sinal de
> load no transcript. Sem credencial, o CLI responde
> `authentication_failed / "Not logged in"`, nenhuma tool é chamada, e o runner
> reporta `trigger_rate: 0.0, pass: false` **como se a descrição não
> disparasse**. Verificado aqui em 2026-07-28. Antes de acreditar num 0%,
> confirme que o transcript tem tool calls de verdade:
>
> ```bash
> grep -l authentication_failed <run-dir>/queries/*/.home/.claude/projects/*/*.jsonl
> ```

## Rodar

```bash
R=~/bmad-evals   # ou onde preferir; run folders nunca são sobrescritas
S=.claude/skills/bmad-eval-runner/scripts

# quality — as duas fixtures, uma execução cada
python3 $S/run_evals.py --cases evals/harness-builder/cases-greenfield.json \
  --skill-path skills/harness-builder --output-dir $R --mode quality \
  --project-root evals/harness-builder/fixtures/greenfield-api

python3 $S/run_evals.py --cases evals/harness-builder/cases-with-harness.json \
  --skill-path skills/harness-builder --output-dir $R --mode quality \
  --project-root evals/harness-builder/fixtures/with-harness

# baseline — skill vs modelo pelado, mesmo input
python3 $S/run_evals.py --cases evals/harness-builder/cases-greenfield.json \
  --skill-path skills/harness-builder --output-dir $R --mode baseline \
  --project-root evals/harness-builder/fixtures/greenfield-api

# variant — versão atual vs anterior: o padrão HARNESS.md ganhou o lugar dele?
python3 $S/run_evals.py --cases evals/harness-builder/cases-with-harness.json \
  --skill-path skills/harness-builder --output-dir $R --mode variant \
  --variant-path evals/harness-builder/variant-prev \
  --project-root evals/harness-builder/fixtures/with-harness

# trigger — a descrição dispara no alvo e fica quieta no resto?
python3 $S/run_triggers.py --skill-path skills/harness-builder \
  --queries evals/harness-builder/triggers.json --output-dir $R \
  --runs-per-query 5
```

Quality e variant deixam transcript + `cwd/` por caso; a nota vem do grader
(`references/grader.md` do eval-runner), um por caso, sem crédito parcial.

## O que cada caso mede

- **first-pass-writes-harness-md** — a passada completa grava mesmo um
  `HARNESS.md` no disco, com §7 povoada, os três IDs do piso de higiene e o
  ponteiro no `AGENTS.md` resolvendo para o arquivo criado.
- **narrow-ask-still-checks-hygiene** — pedido estreito é atendido *e* o piso de
  higiene continua reportado, sem virar avaliação completa não pedida.
- **mid-workflow-gate-respected** — via `state_prefix`, o gate de aprovação: o
  item recusado pelo usuário não é instalado e vai para §7 atribuído à decisão
  dele.
- **update-mode-recurring-failure** — edita o `HARNESS.md` existente no lugar,
  não cria um segundo, preserva o log anterior e converte a lição reincidente
  em sensor.
- **respects-prior-rejection** — pede algo que §7 já recusou; a skill tem que
  citar a recusa e o gatilho de reavaliação, não re-propor como ideia nova.
