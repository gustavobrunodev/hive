# Fábrica de software agêntica: do evento ao PR

Use esta referência quando a pergunta for sobre tirar o humano do loop, ligar Slack/alertas/
tickets a agentes, escolher onde guardar documentos, definir o tamanho de uma task ou montar
o fluxo discovery → planejamento → implementação → review.

Índice:
1. A mudança de unidade: sessão → evento
2. Onde o humano fica
3. As sete estações
4. Quando pular etapas
5. A cadeia de artefatos
6. Onde cada artefato vive
7. Tamanho da task e fatias verticais
8. Skills do fluxo
9. Tracker, MCPs e agentes em nuvem
10. Subagentes e handoff
11. Maturidade e estratégia de adoção

---

## 1. A mudança de unidade: sessão → evento

Uma fábrica agêntica não é uma conversa longa com um agente. É um sistema orientado a
eventos no qual trabalho chega de várias origens e atravessa a mesma linha:

```text
issue / Slack / alerta / backlog
              ↓
        intake + triagem
              ↓
 discover → plan → implement → verify → review
              ↓
             PR
              ↓
       produção + feedback ──────┐
              └──────────────────┘
```

O ganho do desenho não é o agente escrever mais rápido. É tornar **a origem do trabalho
irrelevante**: uma task aberta por alguém não técnico, um alerta de produção e um item criado
por engenharia passam pelo mesmo planejamento, pela mesma implementação e pela mesma barra
de prova.

Para isso, cada entrada precisa chegar numa forma comum: escopo, critério observável, dono e
estado. A fila, o lock entre agentes e o ponto de pausa humano deixam de ser o chat e passam
a ser o tracker.

**Posição da TLC:** código deixou de ser o gargalo; prova virou o gargalo. Por isso a fábrica
investe os passos caros em verificação em camadas, não em microgerenciar como o agente digita.

---

## 2. Onde o humano fica

"Tirar o humano do loop" é formulação incompleta. A meta é tirar o humano **do meio
repetitivo** e mantê-lo **nas pontas de alto valor**.

| Humano mantém | Agente absorve progressivamente |
|---|---|
| Intenção: qual problema merece ser resolvido | Triagem de itens previsíveis |
| Discovery: produto, métrica de sucesso, apetite de risco | Implementação mecânica |
| Decisões críticas e difíceis de reverter | Checks determinísticos e coleta de evidência |
| Direção no review final; lógica de negócio | Pequenos bugs e tarefas recorrentes de alta confiança |
| Desenho e evolução do harness | Execução em branch/sandbox e abertura do PR |

Discovery continua assistida por IA — pesquisa, perguntas, código, métricas e MCPs — mas o
humano é o *driver*. Automatizar a decisão de produto inteira é economia falsa: se a intenção
estiver errada, plano, código e verificação apenas tornam o erro mais eficiente.

No outro extremo, o humano não deveria gastar review procurando erro que lint, typecheck,
testes e agentes de review conseguem provar antes. Ele lê o PR para validar **direção**, não
para substituir a suíte.

---

## 3. As sete estações

O AI Dev Flow publicado pela TLC modela a fábrica em sete estações. As quatro centrais já
têm skills; intake, triagem e feedback de produção continuam dependentes da plataforma e do
contexto da empresa.

| Estação | Entrada → saída | Regra de desenho |
|---|---|---|
| **1. Entry** | Evento → item normalizado | Slack, issue, alerta e backlog chegam no mesmo formato |
| **2. Triage** | Item → fila/estado | Classifica: pronto, precisa discovery, falta informação, aguarde. Estado funciona como fila, lock e pausa humana |
| **3. Discover** | Problema sem forma → veredito + design doc | Feature normalmente passa; bug óbvio pode pular. Humano dirige |
| **4. Plan** | Trabalho decidido → task(s) executáveis | Fatias verticais, critérios observáveis com valores concretos, fronteira explícita |
| **5. Implement** | Task → código + provas | Sandbox/branch própria; checks baratos primeiro; verificador independente |
| **6. Gate** | PR + evidência → veredito de review | Checks determinísticos antes de juízo; review consolidado; humano ainda decide merge |
| **7. Production** | Deploy/telemetria → novo evento | Incidente ou feedback reentra na estação 1 |

O fluxo central publicado é:

```text
tlc-discover → tlc-plan → tlc-implement → the-judge
```

As anotações da aula também registram a sequência prática de Waldemar como
`tlc-discover → tlc-plan → tlc-spec-lean → the-judge`. Trate-a como a variante local que
usa o spec-lean para plan+build; a página oficial pós-aula separa essa responsabilidade em
`tlc-implement`. O princípio não muda: discovery e planejamento produzem entradas estáveis,
o implementador prova o trabalho, e um judge independente revisa o PR.

Em times que ainda preferem o fluxo integrado, `tlc-spec-driven` ou `tlc-spec-lean` podem
cobrir plan+implement. A escolha continua obedecendo à régua de capacidade do modelo; a
linha da fábrica não exige uma única família de skills.

---

## 4. Quando pular etapas

Processo proporcional ao risco, não cerimônia uniforme:

| Trabalho | Caminho recomendado |
|---|---|
| Mudança simples, reversível, baixo impacto e código conhecido | Prompt direto → implementação → autovalidação. Se toca UI, ainda veja a tela |
| Ideia tecnicamente incerta | Branch/POC descartável: deixe o agente explorar; use o resultado para aprender; depois volte e planeje a implementação real |
| Bug óbvio, causa e correção já decididas | Pode pular discovery; transforme a decisão em task/check e implemente |
| Feature média/grande ou intenção ainda abstrata | Discovery → design doc revisável → plan → implement → verify/review |
| Decisão de alto impacto com baixa clareza | RFC ou spike antes de planejar; não force uma certeza falsa |
| Mudança irreversível, dados, auth, segurança, migração | Fluxo completo e aprovação humana explícita nas portas irreversíveis |

A branch de POC é laboratório, não atalho para merge. O padrão mostrado na aula foi: dar uma
missão aberta, deixar o agente descobrir uma solução, ajustar até entender o problema,
descartar/estabilizar o aprendizado, então escrever o plano e fazer a implementação real.

---

## 5. A cadeia de artefatos

Os documentos não são sinônimos. Cada um responde uma pergunta diferente:

| Artefato | Pergunta que responde | Conteúdo que merece estar ali |
|---|---|---|
| **PRD** | Por que o produto precisa disso? | Problema, público, jornada, resultado esperado, métrica |
| **Design doc / TDD** | Qual solução de alto nível o time está escolhendo e por quê? | Problema + direção técnica, fluxos/estados, schema, contratos, decisões difíceis de reverter, questões abertas |
| **RFC** | Qual opção devemos escolher? | Pesquisa de alternativas para comentário antes da decisão; útil quando impacto/coordenação são altos |
| **ADR** | Qual decisão arquitetural já tomamos? | Escolha, contexto, alternativas rejeitadas, consequências; registro apendado, não descrição viva do sistema |
| **Task** | O que exatamente deve ser construído agora? | Intenção, fronteira, fatias verticais, critérios observáveis com valores concretos, links para o raciocínio |
| **Checklist** | Como a implementação será provada? | Uma afirmação observável + o teste/comando cuja saída decide cada check |
| **PR/review** | O que mudou e há evidência para aceitar? | Diff, provas, riscos, findings com citação |

A separação crucial é **porquê vs o quê**:

- O design doc preserva o raciocínio, as alternativas e a direção técnica.
- A task remove a exploração e entrega ao implementador somente o trabalho decidido.
- O checklist congela a barra de prova; ele não renegocia o design durante a implementação.

Se o plano carrega uma longa justificativa, o implementador paga contexto que não precisa.
Se a task não liga de volta ao design, quem revisa perde o porquê. O link entre os dois é o
equilíbrio.

---

## 6. Onde cada artefato vive

Não existe regra universal de "commitar tudo" ou "nunca commitar". A pergunta é quem precisa
editar, qual o alcance da decisão e se o artefato muda de estado.

| Contexto | Colocação que tende a funcionar |
|---|---|
| Time com negócio/produto | PRD e design doc em Notion/Confluence ou ferramenta já usada por essas pessoas; não obrigue não-dev a versionar Markdown |
| Execução e orquestração | Task no Jira/Linear/GitHub Projects; o board é a fonte do estado |
| Decisão durável de um repo | ADR (e às vezes RFC) no repo, perto do código que a consome |
| Decisão que cruza vários repos/times | Base de conhecimento central, com links nos tickets e repos afetados |
| Checks de uma execução | Artefato local/efêmero da implementação, salvo apenas se o fluxo depende dele para handoff/auditoria |
| Dev solo, um repo, fluxo controlado | Markdown no repo pode ser o caminho mais simples; não adote SaaS só para imitar empresa grande |

Princípio transferível: **estado mutável no tracker; decisão durável perto de quem a consome;
raciocínio colaborativo onde os colaboradores já trabalham.**

---

## 7. Tamanho da task e fatias verticais

Uma task grande demais obriga o agente a planejar o fim sobre código que ainda não existe.
As decisões intermediárias mudam o terreno; o plano inicial fica especulativo e o agente
precisa decidir durante a implementação sem o alinhamento que o plano deveria ter comprado.

**Heurística da sessão:** mantenha a task na ordem de até uma semana de trabalho humano.
Não é benchmark nem limite técnico; é ponto de partida. Comece menor e aumente conforme
harness, arquitetura e confiança do time amadurecem.

Não volte às microtasks de uma ou duas horas. Corte por **resultado vertical observável**,
nunca por camada:

- bom: "usuário edita o nome do job e recebe o novo valor";
- ruim: "criar coluna", depois "criar endpoint", depois "criar tela".

A versão publicada de `tlc-plan` prefere uma task por fonte decidida e só separa quando há
uma costura defensável: dependência de deploy, resposta externa ainda pendente ou outro time.
Combine isso com a heurística da aula assim: **não fragmente por preferência**, mas reabra o
recorte se o trabalho não cabe numa janela saudável, se uma fatia sozinha exige decisões
especulativas sobre outra ainda inexistente ou se o blast radius torna a revisão impraticável.

---

## 8. Skills do fluxo

| Skill | Faz | Não faz |
|---|---|---|
| `tlc-discover` | Entrevista a ideia, investiga contexto, produz veredito e design doc planejável | Não corta task nem implementa |
| `tlc-plan` | Transforma PRD/design doc/RFC/thread já decidido em task(s) ancoradas no código | Não decide produto nem implementa |
| `tlc-implement` | Extrai checklist, constrói e aciona verificador independente | Não inventa intenção nem faz discovery |
| `the-judge` | Review de PR baseado em evidência, depois dos checks determinísticos | Não substitui decisão humana de merge/direção |

`grill-me` é uma alternativa citada na aula para provocar perguntas durante discovery. O
valor do padrão não está no nome da skill, mas em ter algo que **instigue o humano a pensar**
antes de convergir. Cada empresa tende a customizar discovery com suas métricas, MCPs e
modo próprio de decidir.

Nota de nomenclatura: a conversa pode chamar a fase de "TLC Discovery", mas o nome publicado
e o link oficial da skill são **`tlc-discover`**.

---

## 9. Tracker, MCPs e agentes em nuvem

O tracker "volta" porque uma fábrica precisa de orquestração de alto nível:

- coluna/label define fila e pode impedir dois agentes de pegar o mesmo trabalho;
- transição de estado dispara triagem, planejamento ou implementação;
- item concentra dono, risco, confiança, links e evidência;
- humano pode pausar, corrigir ou promover o item sem entrar na sessão do agente.

Os links funcionam como chaves entre sistemas. Uma task no Linear pode apontar para um
design doc no Notion; com os MCPs dos dois, o agente segue o link e monta o grafo de contexto
sozinho. O mesmo vale para GitHub, Jira, Confluence, métricas e observabilidade.

O agente em nuvem completa o desenho: recebe o evento, abre sandbox/branch a partir de uma
imagem conhecida do repo, executa o mesmo fluxo e devolve o PR. Local vs nuvem deixa de mudar
o processo; muda apenas onde a estação roda.

Há também um corolário de experiência: **a IA se adapta às pessoas e às ferramentas que elas
já usam**, não o contrário. A aula citou a convergência entre Codex e ChatGPT como sinal de
uma experiência única; o princípio durável é não obrigar PM, suporte ou negócio a entrar na
IDE, aprender Git ou trocar Notion/Slack pelo formato preferido dos desenvolvedores.

Exemplo apresentado na aula: o **Unblocked** operava como *second brain* no Slack, conectado
a Notion, GitHub, Linear e PostHog. Uma PM perguntou por que um acesso ainda não estava
liberado; o bot encontrou a regra no código/contexto, e a correção virou PR sem exigir que o
responsável abrisse o computador. Trate como ilustração de integração, não como recomendação
exclusiva da ferramenta.

---

## 10. Subagentes e handoff

Abrir subagente cedo demais adiciona custo e latência de briefing/handoff. Abrir tarde demais
deixa a janela principal degradar. O gatilho não deve ser "quantas slices existem", porque
duas slices podem ter tamanhos radicalmente diferentes; estime o **contexto da mudança**.

No `tlc-implement` publicado, o default experimental agrupa fatias verticais inteiras por
orçamento estimado de leitura (150k tokens) e faz handoff apenas numa fronteira limpa. Esse
número é configuração da skill, não lei geral. O princípio é:

1. pese o que o próximo trecho precisa ler;
2. nunca corte no meio de um resultado vertical;
3. prefira fronteira em que muda a superfície/módulo;
4. entregue checklist + diff + decisões, não um resumo narrativo da conversa;
5. mantenha o verificador fora da cadeia de autoria, mesmo se houve vários builders.

Ver `contexto.md` para contexto/compactação e `verificacao.md` para autor ≠ verificador.

---

## 11. Maturidade e estratégia de adoção

A direção da indústria não é uma promessa de que toda empresa chega ao mesmo estágio na
mesma data. Legado, cultura, compliance, sensores e arquitetura criam ritmos diferentes.

Uma progressão útil:

1. **Chat assistivo:** humano pede trechos; sem fluxo repetível.
2. **Entrega assistida:** agente implementa ponta a ponta, mas humano conduz cada estação.
3. **Linha padronizada:** discovery/plan/implement/review têm contratos e skills estáveis.
4. **Execução remota:** ticket dispara agente em nuvem; PR volta com evidência.
5. **Fábrica orientada a eventos:** múltiplas entradas, triagem automática por confiança,
   produção realimenta a fila; humano nas pontas.

O próximo passo raramente é procurar mais uma ferramenta de implementação. Primeiro
padronize a linha e automatize o trabalho que **não diferencia** o negócio: bugs pequenos,
triagem repetitiva, checks, coleta de contexto e abertura de PR. Ferramenta nova só merece
entrar se remover uma dependência humana ou fechar uma lacuna de prova observável.

Marque previsões de prazo como **posição da TLC**, não consenso. A afirmação defensável é a
direção — mais execução autônoma e humana nas pontas —, não a data em que cada empresa chega.
