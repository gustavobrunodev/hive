# harness-builder

Skill para **criar ou melhorar o _harness_ completo** de qualquer
projeto de squad — de forma padronizada, guiada por boas práticas e **sem
overengineering**.

> _Harness_ = o sistema de controles que faz um agente de código acertar mais na
> primeira tentativa e se autocorrigir no resto: **guides** (rules/skills que
> orientam *antes* do agente agir) + **sensors** (checagens que dão feedback
> *depois* dele agir).

O objetivo é que **qualquer dev da organização** instale esta skill e consiga,
em um único fluxo, conduzir o setup do harness de um projeto seguindo sempre o
mesmo método.

## O que é (e o que mudou)

Antes isto era um **plugin** com quatro skills e o comando `/build-harness`.
Agora é **uma única skill**:

- O **`SKILL.md` é o núcleo** — o playbook que antes vivia em `build-harness.md`.
- Os conhecimentos específicos de cada skill antiga viram **módulos de
  referência** em `references/`, cada um **preservado na íntegra** para continuar
  **independente e fácil de manter/atualizar**.

| Módulo (`references/<nome>/`) | O que é |
| --- | --- |
| **`harness-engineer`** | A **espinha** do processo: avalia o harness, cobra o piso de higiene, define sensores e fecha o steering loop. |
| **`agent-rules-architect`** | Camada de **guides**: escreve/enxuga as rules (`AGENTS.md` + `docs/`), incluindo os três blocos obrigatórios. |
| **`stack-presets`** | **Presets da org** por stack: garante que as ai-tools obrigatórias (skills + MCPs) estejam instaladas, e conduz a decisão de SDD (progressivo e idempotente). |

Cada módulo mantém sua própria estrutura (`SKILL.md`, `references/`, `assets/`,
`scripts/`). O playbook carrega o `SKILL.md` de um módulo só quando chega na fase
correspondente.

> **Removido:** o módulo `find-skills`. Descoberta avulsa de skills no
> ecossistema não é papel desta skill — o piso de tooling é o `stack-presets`, e
> qualquer lacuna fora dele vira **uma linha de "deferido"** para o usuário
> decidir, não uma instalação silenciosa.

## Como funciona a orquestração

O `harness-engineer` **não é mais uma etapa** — ele é o maestro. Ele avalia o
projeto e só então *chama* os outros módulos para preencher lacunas que ele
realmente identificou:

```
SKILL.md (playbook)
  └─ Fase 0  Orientar      → harness-engineer (modelo mental)
  └─ Fase 1  Avaliar       → harness-engineer (inventário + piso de higiene
                             + HARNESS.md gravado no projeto)
                             ↳ [gate] aprova prioridades antes de mudar nada
  └─ Fase 2  Guides/Rules  → agent-rules-architect (AGENTS.md + docs/ granulares
                             + 3 blocos obrigatórios)
  └─ Fase 3  Presets       → stack-presets (skills + MCPs por stack + decisão de SDD)
  └─ Fase 4  Sensors       → harness-engineer (sensores + timing, "keep left")
  └─ Fase 5  Steering loop → harness-engineer (re-inventário + limites honestos
                             + contrato de memória viva do HARNESS.md)
```

### Piso de higiene (Fase 1 — checado sempre)

Três controles são verificados em **toda** avaliação, independente do stack ou do
escopo pedido — a ausência deles já é a evidência, e o custo de corrigir é de
minutos. O `harness_inventory.py` reporta cada um por ID:

| ID | Controle | Por que é incondicional |
| --- | --- | --- |
| **CI-04** | Tooling de pre-commit instalado (husky + lint-staged, pre-commit, lefthook) | É o loop de feedback mais cedo que existe — checagens rápidas **antes de o commit existir**. |
| **HYG-02** | `.gitignore` cobre `.env` **e** `.env.*` | Impede o agente de "stagear" credenciais sem querer; o estrago vai para o histórico, que é imutável. |
| **HYG-08** | Config de MCP referencia credenciais via `${ENV_VAR}`, nunca literais | Mantém segredo fora do repo e torna o acesso a ferramentas uma escolha deliberada e revisável. |

### Três blocos obrigatórios nas rules (Fase 2)

Todo o resto do `agent-rules-architect` é subtrativo (regra que o agente
consegue inferir é cortada). Estes três entram sempre:

1. **Contrato de memória** — ponteiro para o `STATE.md` **lido no início de cada
   sessão**, mais o mapa de visão/roadmap/specs. Os caminhos vêm da decisão de
   SDD da Fase 3.
2. **Architecture Principles** — **só se o projeto tiver princípios de verdade**
   (enforcement por lint/arch-rules, ADR, ou convenção estrutural consistente).
   Vai resumido no `AGENTS.md`, com uma tabela de roteamento, e o aprofundamento
   fatiado em `docs/` — **um arquivo por aspecto, por escopo**.
3. **General Rules** — "Writing implementation plans" (texto canônico, com os
   comandos **reais** de build/lint/e2e deste projeto) + "Implementation and
   Testing".

Quando existem testes e2e, eles ganham um **`AGENTS.md` aninhado na raiz da
configuração de e2e**, com o próprio `docs/` fatiado por aspecto (fixtures/auth,
mocking de rede, flakiness, visual, CI).

### Presets por stack (Fase 3)

O módulo `stack-presets` garante as **ai-tools obrigatórias da organização**
(skills + MCPs) de acordo com o stack detectado, **instalando só o que falta**
(idempotente) e com **carregamento progressivo** — lê apenas a referência do
stack identificado:

| Quando… | Skills baseline | MCPs baseline | Condição |
| --- | --- | --- | --- |
| Qualquer projeto | `tlc-spec-driven` (padrão da org) | — | só se **não** houver ferramenta de SDD |
| Frontend **React** | `vercel-react-best-practices` + testing/perf sob gap | Figma · Playwright · Chrome DevTools | se não existir no projeto |
| Frontend **Angular** | `angular-developer` (oficial) + testing/perf sob gap | Figma · Playwright · Chrome DevTools | se não existir no projeto |
| Backend **.NET / C#** | `dotnet-best-practices` (`github/awesome-copilot`) + testing/perf sob gap | — (set de MCP é só frontend) | se não existir no projeto |

Skills são instaladas **a nível de projeto** (vivem com o repo); MCPs vão no
`.mcp.json` com credenciais como **`${ENV_VAR}`** — nunca a chave, nunca um
placeholder tipo `YOUR-KEY` (HYG-08). Para trocar um pacote baseline, edite o
arquivo correspondente em `references/stack-presets/references/`.

#### A decisão de SDD

Não há pergunta: como todo preset, é um **piso**, não uma escolha.

- **Nenhuma ferramenta de SDD detectada** → instala `tlc-spec-driven` (padrão da
  org). Confirma-se a *instalação*, como qualquer mudança no repo — não se
  reabre *qual* ferramenta usar.
- **Já existe uma ferramenta de SDD** → ela é **mantida**, nada é instalado por
  cima.

Em **todos** os casos o `AGENTS.md` recebe o **contrato de memória**
(STATE/PROJECT/ROADMAP/specs). O que muda é para onde ele aponta:

| Situação | Para onde o contrato aponta |
| --- | --- |
| `tlc-spec-driven` (presente ou recém-instalado) — **o caso comum** | Os caminhos canônicos `.specs/…`, verbatim |
| Outra ferramenta de SDD já instalada | **Primeiro** procura a convenção nativa da própria ferramenta para memória/lições/roadmap e linka nela; só o que faltar é criado |
| Sem ferramenta, porque o usuário recusou a instalação | **Primeiro** procura a convenção do próprio projeto (`docs/adr/`, `ROADMAP.md`, `DECISIONS.md`…) e linka nela; só o que faltar é criado, com a mesma estrutura do `tlc-spec-driven` |

A regra vale para os dois últimos casos: **procurar antes de criar**. Um
`STATE.md` novo ao lado do arquivo de memória que a ferramenta já tem é
exatamente a duplicação que faz rules piorarem o agente.

> **Preset ≠ harness template.** O preset é o **piso de tooling** por *stack*
> (skills + MCPs). Um *harness template* (ver `harness-model.md`) é outra coisa:
> um bundle de **guides + sensores** amarrado a uma *topologia* de serviço. O
> preset é um dos insumos que um harness template empacota.

### Princípio que governa tudo: _less, but sharper_

Mais controles **não** é melhor. Cada rule, sensor ou skill precisa **merecer seu
lugar** (atacar uma falha *real e observada*, ter sinal de alta precisão, rodar o
mais "à esquerda" que o custo permitir, e não duplicar/conflitar com outro
controle). Na dúvida, **refine ou remova** em vez de adicionar. Itens fora de
escopo viram **uma linha de "deferido"**, nunca um catálogo.

## Como usar

No projeto-alvo, abra o chat do agente e peça para **construir ou avaliar o
harness** (ou invoque a skill `harness-builder-v2` pelo nome). O agente vai pedir
os inputs (caminho do repo, objetivo/dor, escopo, ferramenta alvo) e conduzir as
fases acima, pedindo seu aval no gate antes de alterar qualquer arquivo.

## Instalação

Esta é uma **skill** (não mais um plugin). Instale de uma das formas:

- **Por projeto** — copie a pasta para a raiz de skills do repo:

  ```bash
  cp -r harness-builder-v2 .cursor/skills/harness-builder-v2
  # ou: .agents/skills/harness-builder-v2
  ```

- **Pessoal** (vale em todos os seus projetos):

  ```bash
  cp -r harness-builder-v2 ~/.cursor/skills/harness-builder-v2
  ```

- **Distribuição para a organização** — publique a pasta em um repositório Git e
  instale via Skills CLI:

  ```bash
  npx skills add <owner/repo@harness-builder-v2> -g -y
  ```

Depois rode **Developer: Reload Window** no Cursor (ou reinicie). A skill passa a
ficar disponível.

## Estrutura

```text
harness-builder-v2/
├── SKILL.md                       # núcleo: o playbook de orquestração
├── README.md
├── references/                    # módulos preservados, independentes
│   ├── harness-engineer/          # espinha (modelo, assessment, sensores, script)
│   ├── agent-rules-architect/     # guides/rules (AGENTS.md + docs/, audit script)
│   └── stack-presets/             # presets por stack (skills + MCPs) + SDD
└── site/                          # landing page do produto
    ├── index.html
    ├── PRODUCT.md · DESIGN.md · visual.md
```

## Manter os módulos atualizados

Cada pasta em `references/` é uma **cópia fiel** da skill standalone
correspondente. Para atualizar um módulo, **substitua a pasta inteira** pela
versão nova da skill — o `SKILL.md` (playbook) referencia cada módulo por
caminho, então nada mais precisa mudar. Isso mantém as skills independentes e o
custo de manutenção baixo.

## Limites honestos

Sensores verificam **forma** e pegam **regressões** — não verificam
**correção**. Um teste pode afirmar o comportamento errado e ainda passar. Esta
skill **redireciona** a atenção humana para onde ela importa; não a elimina. A
revisão humana de *intenção* continua sendo necessária.
