# Engenharia de contexto

Índice:
1. Os dois fatos que explicam quase tudo
2. O orçamento da janela
3. Compactação: o que ela realmente faz
4. Perfil de contexto por fase
5. Subagentes
6. Worktrees
7. O que a pesquisa mostra (e a referência errada que circula)

---

## 1. Os dois fatos que explicam quase tudo

**LLM é stateless.** O modelo não "tem" o seu codebase nem lembra da conversa. A cada
chamada, a janela inteira é reenviada, processada e descartada. A janela não é memória —
é um payload recomprado a cada turno.

Daí decorre direto:

- Tudo que é "sempre carregado" (`AGENTS.md`, nome+descrição de toda skill instalada) é pago
  em **todo** turno, não uma vez.
- Uma conversa longa não é cara porque foi longa; é cara porque cada turno reenviou tudo que
  veio antes.

**Mais contexto piora a qualidade.** Não é intuitivo — janela maior parece estritamente
melhor — mas é medido, e é propriedade da arquitetura de atenção, não lacuna de treino que
a próxima geração resolve. Detalhe no item 7.

---

## 2. O orçamento da janela

| Ocupação | Situação |
|---|---|
| até ~40% | confortável |
| 40–60% | ainda bom |
| acima de 60% | começa a pagar em qualidade |

Números de regra de bolso, não de paper — trate como heurística operacional.

Sobre janelas anunciadas: fabricantes costumam ter dois patamares — um tamanho dentro do
qual afirmam ser seguro trabalhar, e um teto maior que é por sua conta e risco. Janela de 1M
não significa 1M de qualidade constante.

**Quando usar janela enorme:** research. É a única fase em que ruído é aceitável, porque o
produto da fase é um documento e não código.

**Quando não:** implementação e verificação. Ali você quer o mínimo suficiente.

---

## 3. Compactação: o que ela realmente faz

Quando a janela enche, a ferramenta compacta. Entenda o mecanismo antes de confiar:

1. Resume tudo que está na janela num bloco menor.
2. **Descarta** o histórico original.
3. Reinjeta o que é sempre carregado (`AGENTS.md`, skills).

Ponto crítico: a compactação **não escolhe** o que é importante. Não existe "isso aqui é
decisão, guarda". Decisões tomadas no meio da conversa — "combinamos que role é campo do
usuário, não tabela" — evaporam. O agente então segue com um resumo empobrecido e toma
decisões diferentes das que você acordou, sem saber que acordou.

**A regra que decorre disso:**

> Deixar a janela encher ou compactar é seguro **quando as regras não vivem na conversa**.

Se as regras estão num plano, numa spec, num checklist em disco, e existe um jeito de checar
contra eles, perder o meio da conversa não dói — há para onde voltar. Se o único lugar onde
a regra existe é o que você digitou no chat, compactar destrói informação.

Isso é o argumento mais forte a favor de artefato escrito. Não é burocracia: é o que torna
a conversa descartável.

---

## 4. Perfil de contexto por fase

| Fase | Janela | Entra | Sai |
|---|---|---|---|
| **Research** | abrir o máximo; subagentes, links, MCPs, métricas, dados | tudo que ajude | **um documento** |
| **Plan** | média | o documento de research + o código relevante | **um plano** |
| **Implement** | **nova, limpa** | só o plano | código + testes |
| **Verify** | **nova, limpa, outro agente** | plano/checks + o diff | relatório com evidência |

A transição **Plan → Implement em janela nova** é a melhoria de maior retorno e menor custo
do fluxo inteiro, e a mais ignorada. Depois de planejar, a janela já está em 60–70% de ruído
de exploração. Implementar ali entrega com contexto degradado. Copie o plano, abra janela
nova, implemente.

Note que isso é o mesmo movimento em duas escalas: **subagente** faz isso dentro de uma
sessão; **janela nova** faz entre fases.

---

## 5. Subagentes

Um subagente é uma thread separada com contexto zerado que recebe uma missão, trabalha, e
devolve **só a resposta** para o agente principal. O trabalho intermediário — os dez arquivos
que ele leu para concluir uma frase — não entra na sua janela.

Dois usos, e vale distinguir porque o benefício é diferente:

**a) Contexto.** Varredura de codebase, exploração ampla, pesquisa. Um subagente lê o backend,
outro o frontend, cada um volta com um parágrafo. A janela principal recebe as conclusões, não
o caminho.

**b) Incentivo.** Verificação e review. Aqui o ganho não é economizar contexto: é que a missão
do subagente é **diferente** da do autor. Ver `verificacao.md`.

Ferramentas e modelos atuais decidem sozinhos quando abrir subagente para (a) — você
geralmente não precisa pedir. Para (b) você precisa pedir, porque é decisão de processo, não
de eficiência.

Regra de conteúdo: **o conhecimento vai em skill, não no subagente.** Subagente é mecanismo
de contexto e de incentivo. Um subagente genérico com 3–4 skills é mais útil que um agente
custom com um papel fixo.

---

## 6. Worktrees

`git worktree` dá um diretório de trabalho separado por branch — não só uma branch, uma
**cópia do código**. Dois agentes, duas features, sem se atropelarem.

Pré-requisito: **estado isolável.** SQLite em arquivo por worktree, tranquilo. Banco
compartilhado, porta fixa, cache global ou build artifacts em lugar comum: os dois agentes
brigam. Resolva antes de prometer paralelismo.

O ganho real não é "duas features ao mesmo tempo". É que **verificação é lenta**: enquanto
uma branch roda checklist e teste de mutação, você planeja a próxima. O gargalo do fluxo
agêntico raramente é a implementação.

---

## 7. O que a pesquisa mostra (e a referência errada que circula)

⚠️ **Correção de referência.** O material do workshop linka `arXiv:2402.01438` como o paper
de degradação por tamanho de contexto. **Esse link está errado** — 2402.01438 é *"Exploring
the Effect of Multiple Natural Languages on Code Suggestion Using GitHub Copilot"* (Koyanagi
et al.), sobre idioma natural e sugestão de código, sem relação com janela de contexto.
Verificado em set/2026. Se alguém citar esse link, corrija.

As referências corretas:

**Liu et al. (2023), "Lost in the Middle: How Language Models Use Long Contexts"** —
`arXiv:2307.03172`. Performance segue curva em **U** conforme a posição da informação
relevante: alta no começo e no fim do contexto, **queda de mais de 30%** quando a informação
está no meio.

**Levy, Jacoby & Goldberg (2024), "Same Task, More Tokens: the Impact of Input Length on the
Reasoning Performance of Large Language Models"** — `arXiv:2402.14848`. Framework de QA
desenhado para isolar a variável: **mesma** tarefa, mesmo conteúdo relevante, só variando o
preenchimento em volta. Achado central: degradação notável de raciocínio em comprimentos de
entrada **muito menores que o máximo técnico** do modelo. É o paper que sustenta "não confie
na janela anunciada".

**Chroma (2025), "Context Rot"** — testou 18 modelos frontier: **todos** pioram conforme o
input cresce. Reforça que é propriedade arquitetural da atenção, não lacuna de capacidade.

**Refinamentos recentes (2025)** indicam que acima de ~50% de ocupação o padrão muda: o
modelo favorece tokens mais recentes, depois os do meio, e desfavorece os do início — e que
a degradação aparece com **bem menos tokens** em tarefas complexas do que nos testes
clássicos de agulha-no-palheiro.

**Como usar isso numa resposta:** os números são de benchmark, não de codebase. O que
transferir não é o limiar exato, é a direção — a degradação é real, começa cedo, piora com
a complexidade da tarefa, e não é resolvida por comprar janela maior.
