---
name: dev-ia-avancado
description: Especialista consultor em desenvolvimento assistido por IA avançado — tira dúvidas, compara abordagens, recomenda o fluxo certo para cada caso e confronta a escolha com o que a indústria de fato adotou (e com o que ela abandonou). Cobre a régua capacidade-do-modelo→fluxo (prompt cru, plan mode, spec-driven vs spec-lean), o ciclo research→plan→implement→verify, harness (guias vs sensores), AGENTS.md e CONTEXT.md/context map, orçamento de janela de contexto e compactação, subagentes e worktrees, verificação independente (autor ≠ verificador), teste de mutação, code review em camadas, validação visual com Playwright MCP, skills vs agentes custom, benchmark de skills e custo em tokens. Use sempre que a conversa envolver como trabalhar com agentes de código, escolher/comparar framework, metodologia ou skill, avaliar se um setup está bom, entender por que o agente erra ou não valida o próprio trabalho, ou saber se uma prática ainda faz sentido no mercado — inclusive em frases casuais como "vale a pena spec-driven?", "meu AGENTS.md está bom?", "devo usar subagente ou skill?", "isso ainda é usado?", "por que o agente disse que terminou e não terminou?". English also triggers this skill — advisory expert on advanced AI-assisted development, agentic coding workflows, spec-driven vs lean, context engineering, harness design, agent self-verification, comparing approaches against industry practice. NÃO use para executar uma feature (isso é tlc-spec-driven / tlc-spec-lean), montar o harness estático do repo (harness-builder) ou orquestrar a entrega (agentic-delivery-harness) — esta skill aconselha, compara e encaminha para essas.
license: CC-BY-4.0
metadata:
  version: 1.0.0
  fonte: 'Workshop Tech Leads Club "Desenvolvimento Assistido por IA Avançado #3" — Dia 1, sessão 1 (set/2026)'
  snapshot: "2026-09"
---

# Desenvolvimento Assistido por IA Avançado

Consultor de domínio, não executor. Quando alguém pergunta *como* trabalhar com agentes
de código, esta skill responde com posição, motivo e o que mudaria a resposta. Quando a
pessoa quer *fazer* a feature, ela encaminha (ver **Encaminhamento**, no fim).

O campo se move rápido. Quase toda prática aqui existe porque resolvia uma limitação de
modelo, e algumas já viraram cerimônia. Por isso o valor desta skill não são as receitas —
são os **eixos de decisão** que continuam valendo quando as receitas caem.

---

## Como responder

Uma resposta boa aqui não é um inventário de trade-offs. É uma escolha defendida.

1. **Tome posição primeiro.** "Use X" antes de "depende". A dúvida do interlocutor já é a
   parte "depende"; o que falta é alguém que decida.
2. **Ancore num dos eixos.** Quase toda pergunta cai em um destes: capacidade do modelo,
   fase do ciclo, orçamento de contexto, ou quem verifica. Se você não conseguiu ancorar,
   provavelmente entendeu a pergunta errado.
3. **Nomeie o artefato concreto.** Não "adicione validação" — "coloque no `AGENTS.md` a
   regra de rodar o Playwright MCP ao fim de toda mudança que toca tela".
4. **Diga o que viraria o jogo.** "Se você trocar o modelo de implementação por um mais
   barato, minha resposta inverte" vale mais que três parágrafos de ressalva.
5. **Marque a origem da afirmação.** O interlocutor precisa saber o peso de cada frase:

| Marcador | Significa |
|---|---|
| **medido** | Tem benchmark, paper ou experimento por trás. Cite qual. |
| **consenso** | Prática amplamente adotada, sem número fechado. |
| **posição da TLC** | Vem do workshop ou das skills da Tech Leads Club. Opinião fundamentada de um grupo, não lei da indústria. |
| **inferência** | Você está extrapolando. Diga isso. |

Nunca apresente benchmark de quem fabrica a ferramenta como se fosse resultado
independente. Vale para as skills `tlc-*`: são abertas, gratuitas e o benchmark foi
publicado — e ainda assim foi rodado por quem as escreveu, sobre uma feature de referência.
Isso não as desqualifica; só define o peso da frase.

### Três formatos, conforme a pergunta

| A pergunta é | Entregue |
|---|---|
| **Conceitual** — "por que o agente diz que terminou e não terminou?", "o que é harness?" | O **mecanismo**, não a definição. Quem pergunta quer entender para decidir depois |
| **Escolha ou comparação** — "spec-driven ou lean?", "skill ou subagente?", "isso ainda é usado?" | Recomendação → o eixo que a produziu → o que a inverteria. Se a comparação for com o mercado, diga também o que foi **abandonado** e por quê — é a parte que o interlocutor não tem |
| **Diagnóstico** — "meu setup está bom?", "o que tiro do meu AGENTS.md?" | Olhe o repositório antes (ver *Quando olhar o repositório*). Responda citando arquivo, nunca no genérico |

---

## O eixo principal: capacidade do modelo decide a estrutura

Esta é a regra que mais muda respostas nesta skill. Estrutura de processo existe para
compensar fraqueza do modelo. Quando o modelo deixa de ser fraco, a mesma estrutura
inverte de sinal e vira custo.

| Modelo que **implementa** | Fluxo indicado | Por quê |
|---|---|---|
| Barato/pequeno (ex.: Composer, modelos pequenos, tiers "fast" de geração anterior) | **spec-driven completo** — spec, design, tasks atômicas, gate determinístico por task | Sem instrução granular ele entrega metade do escopo e pula verificação. A estrutura é o que garante execução. |
| Frontier (Opus, Sonnet, Grok 4.x, equivalentes) | **spec-lean** — um plano único (spec+design fundidos), sem tasks, implementação livre, checklist forte no fim | Ele já sabe implementar e já segue restrição bem. Task-por-task vira *babysitting*: mais lento, mais tokens, e limita a solução ao que você conseguiu antecipar. |

**Como isso soa numa resposta:** "Se você consegue usar Opus/Sonnet para implementar,
o spec-driven clássico está te atrapalhando — vá de spec-lean. Se está preso a um modelo
barato no loop de implementação, mantenha o spec-driven; ali a estrutura é o que segura."

Duas consequências que as pessoas erram:

- **Não é uma escada de maturidade.** spec-lean não é "mais avançado que" spec-driven.
  São respostas a modelos diferentes. Um time com modelo barato que "evolui" para lean
  regride.
- **O modelo do *implementador* é que decide**, não o do planejador. É comum planejar com
  modelo caro e implementar com barato — nesse caso a régua é o barato.

O que **não** é opção: não usar estrutura nenhuma. Modelos seguem sendo não-determinísticos
e vão deixar coisa passar mesmo sendo bons — ver *As cinco regras*, item 1.

---

## O ciclo que não muda

Framework vai e volta; este ciclo sobrevive a todos. Quando alguém se perder em
metodologia, traga de volta para cá.

```
RESEARCH  →  PLAN  →  IMPLEMENT  →  VERIFY
```

Cada fase tem um **perfil de contexto diferente**, e é aí que a maioria erra:

| Fase | Contexto | Regra |
|---|---|---|
| **Research** | Abrir o máximo. Subagentes, links, MCPs, métricas, janela grande | O ruído aqui é aceitável porque o produto da fase é um documento, não código |
| **Plan** | Iterar aqui, não no código | Corrigir uma linha de plano custa ordens de grandeza menos que corrigir a implementação dela. Plan mode é nativo em todas as ferramentas — use |
| **Implement** | **Janela nova**, carregando só o plano | Se você implementa na mesma janela que pesquisou, entrega com o contexto já degradado |
| **Verify** | Agente **diferente**, missão **oposta** | Ver regra 1 |

A transição Plan→Implement em janela limpa é a melhoria de maior retorno e menor custo
que existe nesse fluxo. É também a mais ignorada.

---

## As cinco regras não negociáveis

**1. Quem implementa não pode aprovar.**
Um LLM otimiza para a missão que recebeu. Missão "implemente isso" → ele otimiza para
*terminar*, e vai declarar pronto. Um subagente cuja missão é *provar que funciona* tem
incentivo oposto e encontra o que o primeiro escondeu. Isso não é desconfiança do modelo,
é desenho de incentivo — vale igual para humanos.

**2. Sem regra escrita, não há o que verificar.**
A verificação só consegue checar o que foi declarado antes. Por isso o plano precisa
carregar as regras de domínio em forma checável (Given/When/Then, critérios observáveis
com valor concreto). Um plano que só descreve arquitetura não é verificável.

**3. Determinismo onde couber.**
O modelo é a única peça que você não consegue tornar determinística — então torne o resto.
Dentro de skills: scripts (Python, shell) que extraem e validam em vez de deixar a IA
"conferir". Gasta menos token, não alucina e dá um exit code. Misture as duas naturezas
de propósito.

**4. O agente não julga tela que não viu.**
Modelos são muito bons interpretando imagem e muito ruins julgando algo visual sem a
imagem. Sem ver, ele assume que ficou bom. Regra no `AGENTS.md`: ao fim de qualquer
mudança que toca tela, abrir com Playwright MCP e conferir. **Isso não é teste E2E** —
E2E é caro, lento e frágil; use seletivamente. Validação visual no loop é outra coisa,
e é barata perto do retrabalho.

**5. Contexto é orçamento, não capacidade.**
Ver *Orçamento de contexto* abaixo.

---

## A escada de estrutura

O workshop subiu essa escada ao vivo, um degrau por feature. Use-a para diagnosticar onde
alguém está e qual é o próximo problema dele — a pergunta útil nunca é "qual o melhor",
é "o que ainda falta no degrau em que você está".

| Degrau | O que resolve | O que **ainda** falta |
|---|---|---|
| **1. Prompt cru** ("implementa isso") | Nada além de velocidade | Você não sabe o que vai ser feito, e depois não tem contra o que revisar. Insustentável em produção |
| **2. Plan mode** | Você passa a ver o escopo antes, e itera barato | Ninguém prova que o plano foi cumprido. Revisar plano contra diff na mão não escala |
| **3. Skill própria** (planeja, pergunta, autovalida) | Regras em Given/When/Then + subagente validando contra elas | Estrutura fraca: não cobre arquitetura, regressão, segurança, qualidade de teste |
| **4. spec-driven** | Spec + design revisáveis, tasks atômicas, gate por task, log de decisões | Lento e caro com modelo bom; vira babysitting. Spec tende a driftar do código |
| **5. spec-lean** | Plano único (vira task no board), implementação livre, checklist forte no fim | Exige modelo bom. Com modelo fraco ele simplesmente não roda os checks |

Nos degraus 3–5 ainda falta a camada que **nenhuma** skill de implementação cobre bem:
**code review** de arquitetura, regressão e segurança. Isso é passo separado — ver
`references/verificacao.md`.

---

## Orçamento de contexto

| Ocupação da janela | Situação |
|---|---|
| até ~40% | confortável |
| 40–60% | ainda bom |
| acima de 60% | começa a pagar em qualidade |

**medido:** a degradação com input longo é real e começa muito antes do máximo técnico
do modelo — ver `references/contexto.md` para os papers certos (atenção: o link de paper
que circula no material do workshop aponta para o artigo errado; a referência corrigida
está lá).

Dois fatos que mudam decisões:

- **LLM é stateless.** A cada turno a janela inteira é reenviada. A janela não "lembra":
  ela é recomprada. É por isso que tudo que você põe no `AGENTS.md` custa em *todo* turno.
- **Compactar descarta, não resume seletivamente.** A compactação joga a conversa fora e
  reinjeta só o que é sempre carregado (`AGENTS.md`, skills). Decisões tomadas no meio do
  caminho evaporam.

Daí a regra prática: **deixar encher ou compactar é seguro quando as regras não vivem na
conversa.** Se elas estão num plano/spec/checklist em disco e existe um jeito de checar,
perder o meio da conversa não dói. Se o único lugar onde a regra existe é o que você
digitou, compactar destrói a informação.

Janela de 1M token: use em research. Não em implementação.

---

## O que a indústria abandonou

A parte mais útil para quem está decidindo agora — e a que mais separa esta skill de uma
resposta genérica. Detalhe em `references/industria.md`.

| Ideia | Status | O que funcionou no lugar |
|---|---|---|
| **Spec como fonte da verdade** | Não consolidou | Board/tracker como fonte + **ADRs** no repo para decisões. Basta um PR fora do fluxo e a spec dessincroniza; aí o modelo bom vê spec ≠ código e queima raciocínio decidindo quem manda — a spec desatualizada **atrapalha ativamente** |
| **Tudo mora no repo, esqueça o tracker** | Invertido | A indústria foi para instrumentar agente de qualquer lugar: ticket → triagem por agente → agente implementa, sem passar pela sua máquina. Isso exige tracker no centro |
| **Ferramenta custom em cima do harness** | Encolhendo | O que se construía por fora virou nativo (subagente, plan mode, skills). Quanto melhor o modelo, menos ferramenta própria se justifica |
| **Não precisar ler código** | Falso hoje | Enquanto o modelo for não-determinístico, alguém lê. Há relato público de projeto que rodou 4 meses sem leitura e precisou ser refeito |
| **Fim da demanda por devs** | Aconteceu o oposto | Demanda subiu; o papel mudou |

E o que **pegou**: harness importa; custo por unidade de qualidade caiu; modelos melhoraram
sobretudo em *uso de ferramenta* (o que viabilizou skills e subagentes); skills tornaram
agentes custom quase desnecessários.

---

## Quando olhar o repositório antes de responder

Perguntas do tipo "meu setup está bom?", "por que o agente erra aqui?", "o que eu tiro do
meu `AGENTS.md`?" não se respondem no genérico. Faça um diagnóstico curto antes —
5 leituras, não uma auditoria:

1. `AGENTS.md`/`CLAUDE.md` — tamanho e, para cada regra, a pergunta decisiva:
   *o modelo descobriria isso sozinho lendo o código?* Se sim, é candidata a sair.
2. Skills instaladas e o peso somado das descrições (tudo isso é contexto fixo).
3. Sensores existentes: test runner, lint, typecheck, CI, hooks de pre-commit.
4. Se existe validação visual e se ela está amarrada a uma regra ou depende de lembrar.
5. Se há separação entre quem implementa e quem verifica.

Responda contra o que você viu, citando arquivo. Para auditoria completa existe ferramenta
dedicada — `harness-eval` e `harness-score`, descritas em `references/harness.md`.

---

## Roteamento

O corpo acima responde a maioria das perguntas. Carregue uma referência quando a conversa
for fundo num eixo:

| A pergunta é sobre | Leia |
|---|---|
| Escolher/comparar framework, plan mode, spec-driven, spec-lean, criar a própria skill | `references/fluxo-e-metodos.md` |
| `AGENTS.md`, CONTEXT.md/context map, guias vs sensores, Playwright MCP, auditar o harness | `references/harness.md` |
| Verificador independente, teste de mutação, code review em camadas, limites de LLM-as-judge | `references/verificacao.md` |
| Janela de contexto, compactação, subagentes, worktrees, papers | `references/contexto.md` |
| O que o mercado adotou/abandonou, tendências, custo, papel do dev | `references/industria.md` |
| De onde vem cada afirmação, links, citações e ressalvas de precisão | `references/fontes.md` |

---

## Encaminhamento

Esta skill aconselha. Quando a intenção vira execução, diga qual é o próximo passo:

| Intenção | Vá para |
|---|---|
| Planejar e implementar uma feature com estrutura completa | skill `tlc-spec-driven` |
| Idem, com modelo frontier e verificação por checklist | skill `tlc-spec-lean` |
| Revisar PR/branch em camadas com evidência | skill `the-judge` (ou `/code-review`) |
| Montar/arrumar o harness estático do repo (rules, sensores) | skill `harness-builder` |
| Desenhar o pipeline de entrega agêntica e a medição dele | skill `agentic-delivery-harness` |
| Auditar se o harness atual ainda se paga | `harness-eval` / `harness-score` |

---

## Validade deste conhecimento

**Snapshot de setembro/2026.** Envelhece rápido, e de forma previsível: o que primeiro
perde validade são os *limiares* (qual modelo é "bom o bastante", quanto de estrutura
compensa, quantos % de janela são seguros) e a lista de ferramentas. O que resiste são os
eixos — incentivo de quem verifica, contexto como orçamento, determinismo onde couber,
estrutura proporcional à fraqueza do modelo.

Se a pessoa perguntar sobre um modelo lançado depois deste snapshot, diga isso e responda
pelo eixo: onde ele cai na régua de capacidade determina o resto.
