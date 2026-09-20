# Verificação, review e os limites do LLM como juiz

Índice:
1. Por que o autor nunca aprova
2. O que torna uma verificação real
3. Teste de mutação
4. Code review em camadas
5. Severidade e orçamento de ruído
6. Onde o humano ainda entra
7. Limites do LLM-as-judge

---

## 1. Por que o autor nunca aprova

O argumento não é "o modelo mente". É desenho de incentivo.

Um LLM é uma máquina de probabilidade otimizando para a missão que recebeu. Missão
"implemente isso" → ele otimiza para **terminar**. Vai testar um pouco, porque testar faz
parte de terminar bem, mas vai deixar coisa passar e vai esquecer de rodar coisas — porque
provar não é a função objetivo.

Abra um subagente cuja missão é **provar que aquilo funciona** e o incentivo inverte: agora
achar problema é sucesso. O mesmo modelo, com a mesma capacidade, produz resultado diferente
porque a função objetivo mudou.

Isso vale igual para humanos, e é por isso que ninguém aprova o próprio PR. A novidade é que
com agentes o custo de ter um segundo revisor caiu para quase zero — não há desculpa.

**Consequência operacional:** "quem implementa ≠ quem verifica" não é sugestão de qualidade,
é a condição que faz o resultado ser confiável. Um fluxo onde o mesmo agente implementa e
declara pronto não tem verificação — tem autodeclaração.

---

## 2. O que torna uma verificação real

Quatro propriedades. Falte uma e a verificação vira teatro:

**a) Autor ≠ verificador.** Contexto zerado, missão adversarial.

**b) Evidência ou zero.** Toda afirmação do relatório cita `arquivo:linha` ou a saída do
comando. "Implementado conforme a spec" sem citação não conta. Sem essa regra o verificador
aprende que basta escrever que passou.

**c) Checa contra regra declarada antes.** Você só verifica o que foi escrito antes de
implementar. É por isso que o plano precisa carregar as regras de domínio em forma checável
(Given/When/Then, critério observável com **valor concreto**). Um plano que só descreve
arquitetura não é verificável.

**d) Check tem prova anexada.** A formulação mais precisa vem do spec-lean:

> Cada check é uma afirmação observável com valor concreto **mais a prova** — o teste cuja
> saída define o resultado. Sem prova, não existe check.

Exemplo do formato: *"`GET /api/suppliers` numa tabela vazia responde 200 com array vazio"*
— e como se prova: rodando o teste X.

**E a regra que protege tudo isso:** nenhum check pode ser **enfraquecido ou removido** para
a suíte passar. Se cair essa, o sistema inteiro se auto-corrompe em uma sessão — o caminho
mais curto para "tudo verde" passa a ser editar o critério.

**Um sinal de que está funcionando:** verificação que falha às vezes. Se ela nunca reprova,
ou é fraca demais, ou está lendo o que o autor escreveu em vez de rodar o que o código faz.

---

## 3. Teste de mutação

Chamado de **sensor de discriminação** nas skills `tlc-*`. Responde a uma pergunta que a
cobertura não responde: *os testes pegariam o bug se ele existisse?*

Como funciona: injeta falhas de comportamento num espaço isolado e temporário (nunca no
código real) — inverte uma comparação, troca um sinal, passa negativo onde só se testou
positivo — e confirma que algum teste quebra. **Mutante que sobrevive = lacuna de teste**, e
vira task de correção. O loop fix→re-verify é limitado (3 iterações) para não girar para
sempre.

Por que é tão eficaz com IA especificamente: o modo de falha mais comum de teste escrito por
agente é o **teste tautológico** — escrito a partir da implementação, ele confirma o que o
código faz, inclusive o bug. Passa sempre, cobre tudo, não discrimina nada. Mutação é
exatamente o sensor que pega isso.

É a contrapartida da regra "escreva testes a partir dos checks, nunca a partir da
implementação". A regra previne; a mutação detecta quando a regra não foi seguida.

---

## 4. Code review em camadas

Verificação prova que a feature faz o que o plano disse. Ela **não** olha arquitetura,
regressão, segurança nem qualidade. Isso é uma camada separada, e nenhuma skill de
implementação a cobre bem.

O padrão: **um subagente por lente**, cada um com contexto limpo e uma pergunta só. Subagente
especializado acha mais do que um generalista tentando olhar tudo.

| Lente | Pergunta |
|---|---|
| **Segurança** | Há exploração de fato viável? (só alta confiança — segurança é onde falso positivo mais custa credibilidade) |
| **Requisitos** | Tudo que foi prometido foi entregue? |
| **Testes** | O que entrou está testado, e os testes discriminam? |
| **Arquitetura** | Os padrões do projeto foram seguidos — e **entrou padrão novo sem avisar?** |
| **Regressão e alucinação** | O agente tocou em algo sem relação com esta mudança? |
| **Performance** | Alguma regressão óbvia? |

Duas lentes merecem destaque porque endereçam falhas específicas de agente:

**Arquitetura — "padrão novo sem aviso".** IA tem forte tendência a abstrair demais e a
introduzir design patterns que ninguém pediu. O problema não é o padrão ser ruim; é ele
entrar no repo sem decisão humana. A lente deve **avisar**, não necessariamente bloquear.

**Regressão e alucinação.** O caso clássico: o agente passa por um arquivo sem relação
nenhuma com a mudança e altera algo ali. Já houve caso de coluna deletada em estrutura de
banco. Essa lente olha o diff perguntando "isso tem a ver com a feature?" — e é
desproporcionalmente valiosa.

Referência aberta: `the-judge` (https://agent-skills.techleads.club/skills/the-judge/) —
seis passes (correção/lógica, segurança, estrutura, *AI slop* e comentários inúteis,
verificação das alegações da descrição do PR, bypasses e duplicação), evidência obrigatória,
integração via `gh`, e um contrato de convergência para re-review (round N só checa resolução
e blockers novos — impede a revisão infinita).

Dois princípios do `the-judge` que valem independentemente da ferramenta:

- **Evidência ou silêncio.** Afirmação sobre o código exige `file:line` verificado;
  afirmação sobre biblioteca externa exige URL de documentação **buscada durante o review**.
  Nunca afirmar de memória sobre comportamento de lib.
- **Rodar os checks determinísticos do próprio repo primeiro.** Lint, types e testes antes
  do julgamento. Não gaste juízo de LLM no que um exit code decide.

---

## 5. Severidade e orçamento de ruído

O modo de falha de review com IA não é deixar passar — é **apontar demais**. Cem observações
e a pessoa para de ler; a próxima rodada é ignorada por inteiro.

Duas defesas:

**Severidade explícita:**

| Nível | Efeito |
|---|---|
| 🔴 Blocker | Risco de merge (perda de dado, segurança, auth quebrada) → pedir mudanças |
| 🟠 Should-fix | Defeito real, não crítico para merge → comentário |
| 🟡 Nit | Menor. **Com teto** (ex.: 5 inline, resto contado no resumo) |
| 🟣 Pré-existente | Bug que já existia → só no resumo, não conta contra o PR |

A categoria **pré-existente** é mais importante do que parece: sem ela, todo PR que encosta
num arquivo antigo herda a dívida dele e a revisão vira injusta.

**Orçamento de ruído:** teto duro de comentários inline, priorizando o estrutural sobre o
cosmético. Um teto arbitrário e respeitado vale mais que um ideal de completude.

---

## 6. Onde o humano ainda entra

Depois de todas as camadas, o humano revisa — mas revisa **diferente**:

- **Lógica de negócio.** É onde o erro é mais caro e onde a máquina tem menos como saber que
  errou: o código pode estar certo e a regra, errada.
- **Decisões críticas de arquitetura.** Especialmente padrão novo que a lente de arquitetura
  sinalizou.
- **O que você já sabe que é frágil** neste repo.

Com automação forte, um PR de 50+ linhas sai em 10–15 minutos de revisão humana. Isso é
consequência da automação, não substituto dela — sem as camadas anteriores, o mesmo PR
exige leitura linha a linha.

**E não: não ler código ainda não é viável.** Há relato público de projeto que rodou ~4 meses
sem leitura de código e chegou a um ponto em que não dava nem para refatorar — a aplicação
foi refeita. Enquanto o modelo for não-determinístico e alguém tiver que manter o resultado,
alguém lê.

**A métrica de maturidade correta** não é "quanto eu revisei", é **quanto do loop de
implementação roda sem mim**. Se o loop depende da sua máquina e da sua atenção, ele não
escala para ticket→agente→PR. Cada pedaço que você tira de si mesmo e coloca no harness é um
pedaço que pode rodar em qualquer lugar.

---

## 7. Limites do LLM-as-judge

Use, mas com estas restrições — valem para verificação, review e avaliação de harness:

- **O juiz não pode ser o autor.** Repetindo porque é a falha mais comum.
- **O juiz é sensível ao modelo.** A mesma evidência, dois modelos, dois vereditos. Para
  decisão irreversível (deletar instrução, aprovar merge arriscado), julgue em dois modelos
  e fique com a **interseção**.
- **Registre o modelo no relatório.** Um veredito sem o modelo que o produziu não é
  reproduzível.
- **Juízo sem evidência é ruído.** Exija citação; trate afirmação sem prova como não-dita.
- **Duplo juiz cego para o que é subjetivo.** Segundo juiz sem ver a nota do primeiro. O
  desacordo é informação: é exatamente onde o humano deve olhar.
- **Não peça juízo onde cabe script.** Se um exit code responde, não gaste LLM. Determinismo
  é mais barato, não alucina e é auditável.
