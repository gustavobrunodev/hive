# O que a indústria adotou, abandonou e está adotando

Use esta referência quando a pergunta for "isso ainda faz sentido?", "o mercado usa isso?",
"minha abordagem está alinhada?". Snapshot de set/2026.

Índice:
1. O que saiu como se esperava
2. O que não saiu
3. Spec como fonte da verdade: a autópsia
4. Para onde o fluxo está indo
5. A evolução da fábrica de software
6. Custo
7. O papel do dev

---

## 1. O que saiu como se esperava

- **Adoção cresceu forte.** Empresas grandes reportam parcelas altas do código escrito com
  IA. Trate esses números com cuidado: "70% do código" mede linha gerada, não trabalho — e
  depende muito do contexto da empresa.
- **Custo por unidade de qualidade caiu.** Não que token tenha ficado barato em absoluto:
  a qualidade que você compra por dólar subiu muito. Um tier "fast" de modelo bom hoje faz
  por pouco o que exigia o modelo topo de linha antes.
- **Modelos evoluíram mais rápido que o esperado** — e, crucialmente, **sobretudo em uso de
  ferramenta**. É isso, mais que "inteligência" bruta, que viabilizou skills, subagentes e
  MCPs. Um modelo que escolhe a skill certa e chama o MCP certo sozinho muda o que você
  precisa escrever.
- **Harness importa.** Consolidado. A discussão passou de "qual modelo" para "o que você
  colocou em volta dele".
- **Modelos chineses viraram alternativa real** na faixa de custo-benefício.
- **É caminho sem volta.** A forma de desenvolver software mudou; a discussão é sobre como,
  não sobre se.

---

## 2. O que não saiu

| Previsão | O que aconteceu |
|---|---|
| **Fim da demanda por devs** | O oposto: demanda subiu, e há cargos novos. O que mudou foi o papel |
| **Ninguém mais lê código** | Não é viável hoje. Ver item abaixo |
| **Vamos trabalhar menos** | Trabalha-se **de qualquer lugar** — o que na prática é mais, não menos |
| **Spec vira a fonte da verdade** | Não consolidou. Autópsia na seção 3 |
| **Ferramenta custom em cima do harness** | Encolhendo — o que se construía por fora virou nativo |
| **Dá para acordar sem especificação** | Não. Sem declaração prévia você não sabe o que saiu, e não tem contra o que verificar |

**Sobre não ler código.** Há relato público de projeto que rodou ~4 meses sem leitura de
código e chegou a um ponto em que nem refatorar dava — a aplicação teve que ser refeita.
O argumento estrutural: enquanto o modelo for não-determinístico e alguém precisar **manter**
o resultado, alguém lê. Você pode reduzir muito *quanto* lê (ver `verificacao.md`, seção 6),
não zerar.

**Sobre ferramenta custom.** O ciclo já se repetiu: alguém constrói uma camada por fora para
garantir entrega ponta a ponta com mais verificação; meses depois, plan mode, subagentes e
skills chegam nativos e a camada vira manutenção morta. A regra que sobra: **quanto melhor o
modelo e a ferramenta, menos ferramenta própria se justifica.** Antes de construir, pergunte
se isso não vai vir de graça no próximo trimestre.

---

## 3. Spec como fonte da verdade: a autópsia

A ideia original do spec-driven era forte: a spec é a verdade, o código é derivado, tudo mora
no repositório, esqueça o tracker. Não pegou. Vale entender por quê, porque o motivo é
instrutivo e se aplica a outras ideias parecidas.

**Mecanismo da falha — drift.** A spec só permanece verdadeira se **100%** das mudanças
passarem pelo fluxo. Um PR de hotfix, um dev que não usa o processo, uma correção direta em
produção: a spec dessincroniza. E aí:

1. Você aponta o modelo para a spec como verdade.
2. Ele lê o código e vê outra coisa.
3. **Ele queima raciocínio decidindo quem manda** — e pode decidir errado.

Ou seja: spec desatualizada não é neutra, **atrapalha ativamente**. E quanto mais inteligente
o modelo, mais ele nota a contradição e mais gasta com ela. É um caso raro em que a qualidade
do modelo torna a prática pior.

**Onde ainda funciona:** time pequeno e disciplinado onde dá para garantir que toda operação
passa pelo fluxo. Se é o seu caso e funciona, siga. Mas não é generalizável, e o modo de
falha é silencioso.

**O que ficou no lugar:**

- **Board/tracker como fonte da verdade** do *que* fazer. É o que sobrevive a múltiplos
  fluxos, múltiplas pessoas e agentes rodando fora da sua máquina.
- **ADRs no repositório** para *decisões*. Decisão arquitetural é apendada, datada e
  raramente invalidada por um hotfix — é o tipo de informação que envelhece bem em repo. É a
  diferença: spec descreve o *estado* (drifta), ADR registra a *escolha* (não drifta).
- **Bots nos repos** aplicando as regras automaticamente, em vez de um documento pedindo que
  as pessoas as sigam.

O princípio transferível: **ponha no repo o que é apendado e imutável; ponha no tracker o que
muda de estado.**

---

## 4. Para onde o fluxo está indo

A direção dominante: **instrumentar agente a partir de qualquer lugar.**

```
suporte / incidente / ticket
        ↓
   agente faz triagem
        ↓
   agente implementa          ← nunca passa pela sua máquina
        ↓
  verificação + review automatizados
        ↓
        PR
```

É uma mudança de unidade: de **sessão de chat** para **evento**. Issue, mensagem no Slack,
alerta e item de backlog entram numa forma comum (escopo, critério, dono, estado), e o
tracker assume três funções que o chat não consegue sustentar: fila, lock entre agentes e
ponto de pausa/correção humana.

Consequências que mudam decisões hoje:

- **O tracker vira o centro**, não o repositório. Por isso o plano-que-vira-ticket (spec-lean)
  e não a spec-que-mora-no-repo.
- **MCPs formam o grafo de contexto.** A task pode ligar para o design doc no Notion, para o
  repo no GitHub e para métricas/observabilidade; o agente segue esses links de onde estiver.
- **O loop de implementação não pode depender de você.** Cada passo que exige sua máquina ou
  sua atenção é um passo que não roda nesse desenho. Essa é a métrica de maturidade real do
  seu fluxo.
- **Verificação e review têm que ser automatizados de ponta a ponta**, porque não há humano
  no meio para pegar o que passou.
- **Spec-driven repo-cêntrico fica em atrito** com esse modelo — e é uma das razões, junto
  com a capacidade dos modelos, de a família estar migrando para lean.

Segunda tendência: **menos harness customizado.** Conforme os modelos melhoram em seguir
instrução e usar ferramenta, parte do que hoje é skill vira comportamento padrão. A previsão
que circula entre quem trabalha nisso é que o conjunto de skills necessárias encolhe a cada
geração. Por isso auditar o harness periodicamente (`harness-eval`) deixou de ser higiene e
virou necessidade.

O exemplo mostrado na segunda sessão foi um *second brain* no Slack conectado a Notion,
GitHub, Linear e PostHog: ele localizou por que uma liberação estava atrasada e o pedido de
correção virou PR sem o responsável abrir o computador. O princípio é integração + processo
padronizado; a ferramenta específica não é requisito.

---

## 5. A evolução da fábrica de software

Três estágios, úteis para situar em qual alguém está:

**~2022–2023.** Visão (CEO/PM/eng) → backlog → dev constrói → PR → produção. Humano no centro
do loop. Construir leva dias, revisar leva horas ou dias.

**Estágio atual (a maioria).** Entradas de vários lugares (reclamação de cliente, incidente,
ideia) → filtro de engenharia/PM → backlog → dev pega e implementa **com IA**, normalmente
spec-driven → PR → produção. Humano ainda bem envolvido no loop.

**Para onde vai.** O fluxo da seção 4: triagem e implementação agênticas, humano nas pontas
— intenção/discovery antes e validação de direção depois —, não no meio repetitivo da
execução. Agentes em nuvem rodam a mesma linha e devolvem o PR, sem depender da máquina do
desenvolvedor.

Se a pessoa está no estágio atual e quer avançar, o próximo passo raramente é "adotar
framework X". É **padronizar a entrada e automatizar verificação e review**, porque é isso
que permite tirar o humano do loop de execução sem perder confiança. Depois automatize o que
não diferencia o negócio — bugs pequenos, triagem repetitiva, coleta de contexto — antes de
procurar mais uma ferramenta para o ato de implementar.

Essa é uma direção, não um calendário universal. Legado, cultura, compliance e qualidade do
harness colocam cada empresa num nível diferente. Trate previsões de "até o fim do ano" da
aula como **posição da TLC**, não como consenso ou garantia.

---

## 6. Custo

Ordens de grandeza observadas (set/2026), como calibração e não como orçamento:

- Uso intenso e diário de um desenvolvedor, com modelo bom de custo-benefício: na casa de
  **algumas centenas de dólares por mês**. O mesmo trabalho só com o modelo topo de linha
  seria múltiplas vezes isso.
- Benchmarkar frameworks de spec-driven a sério — uma feature complexa de referência
  (integração de pagamento, ~2 semanas de dev humano), reimplementada várias vezes com cada
  framework — custou **dezenas de milhares de reais**. É o motivo pelo qual quase ninguém
  faz benchmark de verdade e a maioria das recomendações de skill é sentimento.

Alavancas na ordem em que compensam mexer:

1. **Janela de contexto.** Cada turno reenvia tudo — é a maior alavanca e a mais ignorada.
2. **Composição de modelos por fase.** Raciocínio alto para planejar e para desenhar checks;
   tier rápido para fatias mecânicas.
3. **Determinismo dentro das skills.** Script em vez de LLM sempre que um exit code responde.
4. **Menos babysitting.** Task-por-task com modelo bom gasta mais e não compra nada.
5. **Evitar retrabalho.** Validação visual e verificação parecem custo até você contar as
   iterações que elas evitaram.

Ao responder pergunta de custo, deixe claro que essas são referências de um contexto, não
uma tabela de preço.

---

## 7. O papel do dev

O que mudou e o que não mudou:

**Não mudou:** boa arquitetura, código legível, testes que discriminam, tipos, lint, CI.
Tudo isso continua importando — e agora importa **duas vezes**, porque além de servir a
humanos virou o canal de feedback do agente. Codebase bem estruturado significa agente que
acha as coisas mais rápido (menos token) e sabe quando errou (menos retrabalho).

**Mudou:** menos tempo digitando implementação, mais tempo em (a) definir o que é certo,
(b) desenhar o sistema que verifica, (c) revisar o crítico, (d) manter o harness.

**A oportunidade, para quem está de pleno em diante:** quem sabe operar esse fluxo se
multiplica de forma que não era possível antes. A habilidade escassa não é "usar IA" — é
saber **onde colocar estrutura e onde tirar**, que é exatamente o eixo desta skill.
