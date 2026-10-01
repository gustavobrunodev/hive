# Da sessão à fábrica: a nova arquitetura do desenvolvimento de software com agentes

> **Parte 1 de 2.** Este artigo descreve a fábrica de software agêntica como sistema de produção. A continuação — [Ferramentas para a fábrica agêntica](artigo-ferramentas.md) — compara Superpowers, Matt Pocock Skills, BMAD e TLC sobre esta arquitetura.

## O ponto de virada não é gerar mais código

Em poucos anos, o desenvolvimento assistido por IA saiu do autocomplete para agentes capazes de investigar repositórios, usar ferramentas, discutir requisitos, editar vários arquivos, executar testes e abrir pull requests. O salto é grande, mas chamar isso de “fábrica” cedo demais esconde o problema central.

Um agente que escreve código numa conversa continua sendo uma estação manual. Uma fábrica começa quando a origem do trabalho deixa de importar, as transições têm contratos explícitos, o estado sobrevive à conversa e uma declaração de “pronto” depende de evidência.

A tese deste artigo é:

> **A nova fábrica de software não é um modelo nem um framework. É uma arquitetura de trabalho orientada a eventos, na qual intenção, estado, execução, prova e decisão têm donos e controles diferentes.**

Essa distinção muda o foco. Quando gerar código fica barato, o gargalo migra para coordenar intenção, preservar contexto, contestar resultados e operar o software produzido. **Minha posição:** prova, e não digitação, passa a limitar a vazão da linha.

Ao longo do texto, afirmações são tratadas com pesos diferentes:

- **medido**: há paper, benchmark ou experimento citado;
- **consenso**: prática amplamente adotada, sem um número universal;
- **minha posição**: interpretação autoral, fundamentada na experiência e nas referências apresentadas;
- **inferência**: conclusão arquitetural derivada dessas fontes.

## Como chegamos até aqui

### 1. Autocomplete: IA como acelerador de digitação

Na primeira fase, a IA completava linhas, gerava boilerplate e explicava trechos. O humano mantinha problema, arquitetura, sequência e critério de pronto na cabeça. O ganho estava no teclado; coordenação e responsabilidade continuavam inteiramente humanas.

### 2. Chat executor: o agente “faz a feature”

Modelos melhores e acesso a ferramentas criaram o coding agent. Ele passou a ler o repositório, editar arquivos e executar comandos. O ganho foi real, mas tornou visíveis falhas recorrentes:

- implementar antes de entender o problema;
- confundir plausibilidade com prova;
- esquecer decisões antigas à medida que a conversa cresce;
- testar apenas o caminho que acabou de construir;
- revisar o próprio trabalho com as mesmas premissas que produziram o erro;
- planejar um escopo maior do que a janela consegue sustentar com qualidade.

### 3. Método: o processo vira instrução reutilizável

A resposta seguinte foi codificar comportamento: investigar antes de construir, planejar, usar TDD, depurar por causa raiz e verificar antes de concluir. Skills e plan mode transformaram prompts soltos em procedimentos repetíveis.

Esse degrau resolveu disciplina, mas não memória organizacional. A execução ainda dependia de uma sessão e de o modelo obedecer a uma sequência escrita.

### 4. Artefatos: a conversa se torna descartável

Quando o trabalho atravessa sessões, agentes e pessoas, decisões precisam sair do chat. Briefs, design docs, ADRs, tasks e checklists preservam intenção e permitem handoff. A conversa pode ser compactada ou encerrada porque o estado relevante vive fora dela.

### 5. Fábrica verificável: instrução deixa de ser controle

O passo atual é converter regras críticas em sensores e gates. Em vez de somente pedir “rode os testes”, o sistema registra quais provas são obrigatórias, executa comandos objetivos e impede que a unidade avance sem evidência recente. Um agente implementa; outro tenta reprovar.

![Linha do tempo da evolução do desenvolvimento com IA: autocomplete, chat executor, método, artefatos e fábrica verificável](assets/diagrams/01-evolucao-fabrica-agentica.svg)

*Figura 1 — O gargalo migra de escrever código para provar resultado. [Abrir fonte editável no Excalidraw](assets/diagrams/01-evolucao-fabrica-agentica.excalidraw).*

Essa evolução não é uma escada de maturidade em que todo degrau anterior fica proibido. Prompt direto continua adequado para uma alteração simples, reversível e de baixo risco. A mudança é saber quando a simplicidade deixa de comprar velocidade e passa a comprar incerteza.

## A mudança de unidade: de sessão para evento

Uma fábrica agêntica não começa com “abra o chat”. Ela começa com um evento:

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

O evento pode vir de produto, suporte, observabilidade ou engenharia. Todos chegam a uma forma operacional comum: intenção, critério observável, dono, risco e estado. O tracker deixa de ser apenas uma lista de tarefas e assume três funções que o chat não sustenta bem:

1. fila de trabalho;
2. lock entre agentes e pessoas;
3. ponto de pausa, correção e promoção humana.

**Inferência:** a origem do trabalho se torna irrelevante somente quando todas as entradas atravessam a mesma barra de prova. Um PR criado a partir de um alerta não pode ter menos evidência do que um PR criado a partir do roadmap.

## A fábrica TO-BE

![Arquitetura da fábrica de software agêntica TO-BE com direção humana, execução agêntica, operação e ciclo de feedback](assets/diagrams/02-fabrica-tobe.svg)

*Figura 2 — A fábrica fecha o ciclo quando produção e telemetria voltam a gerar eventos. [Abrir fonte editável no Excalidraw](assets/diagrams/02-fabrica-tobe.excalidraw).*

A linha pode ser descrita em sete estações:

| Estação | Entrada → saída | Obrigação principal |
| --- | --- | --- |
| **1. Entry** | evento → item normalizado | origem, intenção, dono e estado explícitos |
| **2. Triage** | item → rota e prioridade | decidir se está pronto, precisa discovery, informação ou espera |
| **3. Discover** | problema sem forma → veredito e direção | humano dirige produto, métrica, risco e trade-offs |
| **4. Plan** | direção aprovada → unidade executável | fronteira, fatias verticais, critérios e provas |
| **5. Implement** | unidade → código e testes | trabalhar em branch/sandbox e produzir evidência |
| **6. Gate** | diff + evidência → veredito | determinismo primeiro; contestação semântica depois |
| **7. Production** | deploy + telemetria → aprendizado | incidente, uso, custo e qualidade geram novos eventos |

O fluxo central — Discover, Plan, Implement, Verify e Review — é estável mesmo quando ferramentas e nomes mudam. Entry, Triage e Production exigem integração com tracker, CI/CD, plataforma e observabilidade; nenhuma biblioteca de prompts fecha essas camadas sozinha.

## O humano não sai do loop; muda de lugar

“Tirar o humano do loop” é uma formulação incompleta. O objetivo é tirá-lo do meio repetitivo e mantê-lo nas pontas de maior responsabilidade.

| Humano preserva | Agente absorve progressivamente |
| --- | --- |
| intenção e prioridade | coleta e normalização de contexto |
| discovery, resultado e apetite de risco | triagem previsível |
| decisões difíceis de reverter | implementação mecânica |
| lógica de negócio no review | checks determinísticos e coleta de evidência |
| desenho e evolução do harness | execução em branch/sandbox e abertura do PR |
| merge, release e exceções críticas | bugs pequenos de alta confiança |

Automatizar uma decisão de produto mal formulada apenas torna o erro mais eficiente. No outro extremo, usar review humano para descobrir lint quebrado, teste ausente ou type error desperdiça julgamento caro em algo que um sensor deveria resolver.

A revisão humana muda de natureza: deixa de provar mecânica linha a linha e passa a validar direção, regra de negócio, padrões novos e riscos sinalizados pelas camadas anteriores.

## Nem todo trabalho percorre todas as estações

Processo proporcional ao risco é diferente de processo uniforme.

| Tipo de trabalho | Rota indicada |
| --- | --- |
| mudança pequena, reversível e conhecida | implementação direta + autovalidação |
| bug óbvio com causa decidida | plan/check curto → implementação → verificação |
| ideia tecnicamente incerta | POC em branch descartável → aprendizado → plano real |
| feature média ou grande | discovery → plano → implementação → verificação → review |
| decisão de alto impacto com baixa clareza | RFC ou spike antes do plano |
| dados, auth, migração ou ação irreversível | fluxo completo + aprovação humana explícita |

A POC é laboratório, não atalho para merge. Seu resultado reduz incerteza; a implementação real volta para uma unidade planejada e verificável.

Uma heurística operacional é manter cada task na ordem de até uma semana de trabalho humano. **Minha posição:** trate esse número como ponto de partida, não como benchmark; calibre-o pelo harness, pela arquitetura e pela capacidade do modelo. O mecanismo importante é evitar planejar o fim sobre código que ainda não existe.

O corte deve ser vertical: “usuário altera o nome e recebe o valor atualizado”, não “criar coluna”, “criar endpoint” e “criar tela”. Uma fatia vertical oferece um comportamento observável para provar e revisar.

## A capacidade do modelo decide quanta estrutura existe

Estrutura compensa fraqueza. Quando o modelo melhora, parte da mesma estrutura pode virar custo.

| Modelo que implementa | Política de execução | Onde fica o rigor |
| --- | --- | --- |
| barato, pequeno ou inconsistente | fluxo granular, tasks atômicas e gate por task | mais instrução na entrada |
| frontier, bom em ferramentas e restrições | plano enxuto, implementação livre e checklist forte | mais contestação na saída |

A régua é o **modelo implementador**, não o planejador. Planejar com um modelo forte e entregar uma tarefa aberta a um modelo fraco continua exigindo estrutura granular.

Isso não torna o fluxo enxuto “mais maduro”. São respostas para capacidades diferentes:

- estrutura insuficiente deixa o modelo fraco entregar metade do escopo;
- estrutura excessiva fragmenta o raciocínio do modelo forte, aumenta tokens e cria babysitting;
- em ambos os casos, intenção declarada e prova continuam obrigatórias para trabalho relevante.

O que muda é a microcoreografia. O que não muda é o contrato.

## Contexto é orçamento, não capacidade

**Medido:** modelos degradam com contexto longo antes do máximo técnico. [Lost in the Middle](https://arxiv.org/abs/2307.03172) mostrou forte sensibilidade à posição da informação; [Same Task, More Tokens](https://arxiv.org/abs/2402.14848) isolou a queda de raciocínio ao aumentar o input sem mudar a tarefa relevante.

As faixas abaixo são heurísticas operacionais da skill, não limites de paper:

| Ocupação da janela | Uso |
| --- | --- |
| até aproximadamente 40% | confortável |
| 40–60% | ainda saudável |
| acima de 60% | risco crescente de perda de qualidade |

Dois fatos explicam a engenharia necessária:

1. **LLM é stateless.** A cada turno, a janela é reenviada e recomprada. Tudo que é sempre carregado custa em todo turno.
2. **Compactação descarta.** A ferramenta resume, remove o histórico e reinjeta instruções fixas. Ela não sabe quais decisões intermediárias eram sagradas.

Daí uma regra de projeto: **a conversa só pode ser descartável quando as regras vivem em artefatos duráveis**.

Cada fase pede um perfil diferente:

| Fase | Contexto adequado | Saída |
| --- | --- | --- |
| Research/Discover | amplo: pessoas, links, MCPs, métricas, subagentes | decisão ou design document |
| Plan | documento decidido + código relevante | plano/checks |
| Implement | **janela nova**, carregando somente o contrato | código + testes |
| Verify | **outro agente**, contexto limpo, checks + diff | relatório com evidência |
| Review | gates, diff, riscos e decisões | veredito de merge/direção |

A transição Plan→Implement em uma janela limpa é uma das mudanças de maior retorno e menor custo. Implementar na mesma conversa que explorou alternativas leva ruído de discovery para uma fase que precisa de precisão.

Subagente tem dois usos distintos:

- **contexto:** pesquisa ou varredura ampla sem poluir a janela principal;
- **incentivo:** verificação e review por uma missão oposta à do autor.

Abrir cedo demais custa briefing e handoff. Abrir tarde demais deixa o builder decidir sob contexto degradado. O gatilho é o volume do que precisa ser lido, não uma contagem arbitrária de tasks.

## A cadeia de artefatos

Cada documento responde a uma pergunta. Confundi-los gera duplicação e drift.

| Artefato | Pergunta |
| --- | --- |
| **PRD** | por que o produto precisa disso e qual resultado importa? |
| **Design doc / TDD** | qual solução e quais decisões de alto impacto estamos escolhendo? |
| **RFC** | qual alternativa devemos escolher antes de decidir? |
| **ADR** | qual decisão arquitetural foi tomada e com quais consequências? |
| **Task** | o que exatamente será construído agora? |
| **Checklist** | qual afirmação observável e qual prova decidem cada resultado? |
| **PR/review** | o que mudou, quais riscos restam e há evidência para aceitar? |

A separação crucial é entre **porquê**, **o quê** e **como provar**:

- design document preserva raciocínio;
- task remove exploração e entrega somente o trabalho decidido;
- checklist congela a barra de prova;
- PR carrega diff, evidência e riscos.

O design deve estar ligado à task, mas não inteiro dentro dela. O implementador precisa da decisão, não de toda a arqueologia da discussão.

### Onde cada artefato vive

A ideia de que “tudo precisa morar no repositório” não se sustentou como regra universal. O local depende de quem edita e de como o estado muda.

| Informação | Local que tende a funcionar |
| --- | --- |
| intenção de produto e design colaborativo | Notion, Confluence ou ferramenta já usada pelo negócio |
| fila, dono, prioridade e estado | Jira, Linear, GitHub Projects ou tracker equivalente |
| decisão durável de um repositório | ADR no próprio repo |
| decisão entre times/repos | base central, ligada aos tickets e repos |
| código e testes | Git |
| prova de uma execução | relatório/checklist local ou retido para auditoria |

Princípio: **estado mutável no tracker; decisão durável perto de quem a consome; colaboração onde as pessoas já trabalham**.

O tracker volta ao centro porque a indústria está migrando de sessão para evento. Links funcionam como chaves: a task aponta para o design, o repositório e a telemetria; MCPs permitem ao agente percorrer esse grafo sem obrigar PM, suporte ou UX a entrar na IDE.

## Harness: guiar, medir e impedir

“Harness” pode significar duas coisas:

- **harness-ferramenta:** Codex, Claude Code, Cursor, OpenCode e outros loops que gerenciam modelo, tools e contexto;
- **harness-projeto:** o conjunto que a equipe controla — instruções, skills, arquitetura, testes, lint, CI, hooks e gates.

No harness do projeto, toda peça deve ser classificada pela função:

| Camada | Função | Exemplos |
| --- | --- | --- |
| **Guia** | orientar antes da ação | `AGENTS.md`, skill, ADR, context map |
| **Sensor** | observar e devolver evidência | teste, lint, typecheck, observabilidade, inspeção visual |
| **Gate** | permitir, pedir ou negar | CI obrigatório, branch protection, hook e política determinística |

Pedido não é controle. `AGENTS.md` e skills influenciam um modelo não determinístico; são excelentes para preferências e processos. Se algo não pode acontecer, a decisão precisa viver fora do modelo.

O `AGENTS.md` deve conter somente o que o agente não descobriria sozinho: comandos não óbvios, estratégia de testes, invariantes arquiteturais e gatilhos como “se tocou UI, abra a aplicação e veja”. O código consistente é um guia melhor e mais barato do que uma longa explicação. O padrão aberto está documentado em [agents.md](https://agents.md/).

Um context map, como `CONTEXT.md`, guarda vocabulário e negativas de domínio: “estoque vive na warehouse, não no catálogo”. Ele pode ser carregado sob demanda, sem cobrar esse contexto em toda sessão.

### Sensores antes de framework

Num legado sem teste, typecheck, lint ou CI, nenhuma metodologia consegue provar a entrega. A ordem de retorno tende a ser:

1. um comando rápido e único de testes;
2. typecheck;
3. lint/format com autofix;
4. CI com os três;
5. hooks para riscos antes do commit/push;
6. validação visual quando existe interface;
7. observabilidade quando produção é a fonte da verdade.

**Consenso:** arquitetura, tipos e testes passam a valer duas vezes. Servem a humanos e se tornam canais de feedback para o agente.

### Validação visual não é E2E

O agente não deve julgar uma tela que não viu. Ao final de uma mudança visual, deve abrir o fluxo com navegador — por exemplo, [Playwright MCP](https://github.com/microsoft/playwright-mcp) — e inspecionar layout, estados, console e responsividade.

Isso não equivale a manter uma suíte E2E completa:

| Validação visual no loop | Teste E2E |
| --- | --- |
| roda na implementação atual | roda continuamente no CI |
| prova que o agente viu o resultado | protege fluxos contra regressão |
| baixo custo relativo | maior custo e manutenção |
| recomendada para toda mudança de UI | seletivo para jornadas críticas |

## Autonomia é decisão de arquitetura

**Minha posição:** dar autonomia não é escrever um prompt mais enfático. É definir o que existe entre a intenção do modelo e o mundo quando ele errar.

```text
modelo propõe → hook intercepta → política decide allow / ask / deny / contexto → ação ocorre
```

Antes de execução sem supervisão, mapeie quatro superfícies:

| Superfície | Falha que não se desfaz sozinha | Controle típico |
| --- | --- | --- |
| Shell | destruição fora do projeto, segredo no transcript, código remoto no shell | resolver alvo, bloquear cauda destrutiva, pedir decisão |
| Arquivos | apagar teste ou reescrever a política que supervisiona | proteger superfícies de política e comparar baseline |
| Git | reescrever histórico ou publicar sem evidência | negar force inseguro, exigir review e checks |
| Subagentes | cascata, modelo não permitido ou custo sem limite | allowlist, orçamento, limite de repetição e handoff |

A camada deve acompanhar a consequência:

- preferência → guia;
- erro reversível que precisa aparecer → sensor;
- declaração de pronto sem prova → gate de saída;
- ação destrutiva → gate antes da ação;
- decisão irreversível que o código não resolve → `ask`; se o host não suporta, `deny`.

Um gate amplo demais interrompe também o caminho legítimo e acaba desligado. O bom desenho nega a cauda perigosa e preserva a operação segura parecida com ela. O [Harness Toolkit](https://github.com/tech-leads-club/harness-toolkit) é uma implementação desse padrão; os princípios independem do produto. A taxonomia de ameaças da [OWASP para agentes](https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/) ajuda a mapear superfícies, mas não substitui threat modeling do projeto.

Uma arquitetura de autoridade sustentável separa três níveis: um **floor** que não pode ser desligado por configuração, controles de integridade sempre ativos e **rails** configuráveis pelo projeto. A política e seu wiring precisam ficar fora da superfície que o agente supervisionado pode reescrever. Modos mais ou menos autônomos devem mudar a quantidade de interrupções humanas, não a exigência de evidência.

Controle sem trilha não é auditável. Registre evento, regra acionada, veredito, motivo, prova disponível, custo e retries. Limite repetição: reenviar o mesmo pedido depois da mesma falha cria loop, não autonomia.

## Verificação é uma estação diferente de implementação

O autor otimiza para terminar. O verificador otimiza para encontrar onde a afirmação falha. Não é acusação de mentira; é desenho de incentivo.

Uma verificação real exige quatro propriedades:

1. **autor ≠ verificador:** contexto novo e missão adversarial;
2. **evidência ou zero:** toda conclusão cita arquivo/linha ou saída de comando;
3. **regra declarada antes:** o diff é comparado com critérios que não foram inventados depois;
4. **check com prova:** cada afirmação observável inclui o teste ou comando que decide.

Exemplo:

> “Com a tabela vazia, `GET /api/suppliers` responde 200 com `[]`” — provado pelo teste X.

Checks não podem ser enfraquecidos ou removidos para fazer a suíte passar. Sem essa proteção, o caminho mais curto para “tudo verde” é editar a régua.

### Teste de mutação: cobertura que discrimina

Cobertura diz que uma linha executou; não diz que o teste detectaria o bug. Teste de mutação injeta temporariamente uma falha — inverte uma comparação, troca um sinal, altera uma borda — e confirma que a suíte quebra.

Mutante sobrevivente é lacuna de teste. Essa técnica combate um modo de falha comum de código gerado: o teste tautológico, escrito a partir da implementação e incapaz de contradizê-la.

O retry precisa de limite. Um agente autônomo não deve repetir a mesma correção indefinidamente; após um número definido de fracassos, o fluxo escala com histórico e evidência.

## Review em camadas, com orçamento de ruído

Verificação responde “a feature fez o que o plano prometeu?”. Review olha o que o plano pode ter esquecido.

| Lente | Pergunta |
| --- | --- |
| Segurança | existe exploração viável e de alta confiança? |
| Requisitos | tudo que foi prometido foi entregue? |
| Testes | os testes cobrem e discriminam? |
| Arquitetura | padrões existentes foram respeitados? entrou padrão novo sem decisão? |
| Regressão/alucinação | algo sem relação foi alterado? |
| Performance | há regressão óbvia? |

Checks determinísticos vêm primeiro. Não use julgamento de LLM onde um exit code responde.

Depois, cada finding precisa de severidade e evidência:

- **blocker:** risco de merge;
- **should-fix:** defeito real não crítico;
- **nit:** limitado por um teto;
- **pré-existente:** registrado sem ser atribuído ao PR.

O modo de falha de review agêntico costuma ser excesso de observações. Um orçamento de ruído preserva credibilidade. Em decisões irreversíveis ou subjetivas, dois juízes cegos e a interseção dos vereditos são mais seguros do que um único LLM-as-judge. Registre também qual modelo julgou.

## Produção fecha a fábrica

Sem deploy, telemetria e reentrada, existe uma linha de geração de PRs, não uma fábrica de software.

Produção precisa devolver pelo menos:

- uso e resultado de produto;
- qualidade e incidentes;
- custo e performance;
- falhas de rollout;
- hipóteses invalidadas.

Esses sinais voltam como eventos. Triage decide se geram rollback, bug, discovery ou aprendizado sem ação. O loop permite automatizar primeiro o que não diferencia o negócio: triagem repetitiva, pequenos bugs, coleta de contexto, checks e abertura de PR.

Agentes em nuvem completam a separação entre processo e máquina. Recebem o evento, abrem sandbox/branch a partir de uma imagem conhecida, executam a mesma linha e devolvem o PR. Local ou remoto muda onde a estação roda, não o contrato.

## Paralelismo só funciona com isolamento

`git worktree` oferece um diretório por branch e evita que dois agentes disputem arquivos. Mas paralelismo exige estado isolável: banco compartilhado, porta fixa, cache global e artefatos comuns podem fazer duas worktrees colidirem.

O ganho real não é apenas construir duas features ao mesmo tempo. Verificação é lenta; enquanto uma unidade é contestada, a próxima pode ser planejada. A vazão aumenta sem enfraquecer o gate.

Ao dividir uma implementação longa:

1. preserve fatias verticais inteiras;
2. corte onde muda a superfície ou módulo;
3. faça handoff apenas no verde;
4. entregue checklist, diff, decisões e tentativas abandonadas;
5. use um verificador novo depois da última fatia — builders sucessivos continuam sendo autores.

## Como medir se a fábrica está melhorando

Linhas de código geradas são uma métrica fraca. A fábrica deve medir fluxo e confiança:

| Dimensão | Exemplos |
| --- | --- |
| Vazão | lead time por estação, tempo bloqueado e WIP |
| Qualidade | first-pass acceptance, regressões, mutantes sobreviventes |
| Prova | porcentagem de checks com evidência recente |
| Ruído | falsos positivos e findings descartados |
| Autonomia | intervenções humanas no meio do loop |
| Custo | tokens, tempo, retries e custo por unidade aceita |
| Operação | falhas de deploy, rollback e eventos de produção reabertos |

A métrica de maturidade não é “quanto código o agente escreveu”, mas **quanto do loop de implementação roda sem atenção humana e ainda produz evidência confiável**.

## O que a indústria adotou — e o que deixou para trás

O que se consolidou:

- harness importa tanto quanto o modelo;
- modelos melhoraram especialmente em uso de ferramentas;
- skills e subagentes reduziram a necessidade de personas custom;
- custo por unidade de qualidade caiu;
- arquitetura, testes, tipos, lint e CI ficaram ainda mais valiosos.

O que não se consolidou como prometido:

- **spec como fonte eterna da verdade:** um único hotfix fora do fluxo cria drift; o modelo passa a gastar raciocínio decidindo entre spec e código;
- **tudo no repo, tracker dispensável:** execução remota e múltiplas origens trouxeram o tracker de volta como fila e estado;
- **ninguém precisa ler código:** ainda não é viável para software mantido por pessoas;
- **mais ferramenta custom sempre ajuda:** plan mode, skills e subagentes nativos tornaram várias camadas externas manutenção morta;
- **IA reduz automaticamente a demanda por engenharia:** o papel muda para intenção, arquitetura, prova e harness.

O arranjo que tende a envelhecer melhor é: tracker como fonte do que fazer, ADR como registro de decisão, Git como fonte do código e sensores/gates como fonte da prova.

## Uma rota de adoção

Não tente instalar a fábrica inteira de uma vez.

### Estágio 1 — entrega assistida

- padronize um comando de teste;
- exija plano para trabalho não trivial;
- valide visualmente o que toca UI;
- registre decisões fora do chat.

### Estágio 2 — linha padronizada

- defina contratos de Discover, Plan, Implement e Review;
- abra implementação em contexto limpo;
- separe autor e verificador;
- conecte checklist a provas.

### Estágio 3 — execução remota

- normalize entradas no tracker;
- torne CI, gates e evidência independentes da máquina do dev;
- isole branch, estado e credenciais;
- faça o PR devolver relatório legível.

### Estágio 4 — fábrica orientada a eventos

- conecte Slack, alertas, backlog e suporte ao intake;
- automatize triagem por confiança;
- faça produção realimentar a fila;
- mantenha humanos nas portas de intenção, risco e irreversibilidade.

Em qualquer estágio, audite o harness. Modelos melhores tornam instruções antigas redundantes. Corte devagar, por evidência: primeiro verifique deterministicamente referências, caminhos e comandos; depois avalie redundância; por último, meça utilidade comportamental. Para julgamentos subjetivos, compare juízes cegos e só remova pela interseção dos vereditos.

## O papel da engenharia nessa fábrica

O desenvolvedor não desaparece; sobe de abstração.

Menos tempo é gasto transcrevendo implementação. Mais tempo vai para:

- decidir o que é certo;
- desenhar arquitetura que o agente consiga ler;
- instalar sensores que detectem erro;
- definir gates para o irreversível;
- revisar lógica de negócio e decisões novas;
- manter o harness enxuto;
- calibrar custo, autonomia e risco.

A habilidade rara deixa de ser “usar IA” e passa a ser **saber onde adicionar estrutura e onde removê-la**.

## Conclusão

A nova fábrica de software é uma linha de decisões e provas, não uma sequência de prompts. Ela começa num evento, preserva intenção em artefatos, executa com contexto controlado, separa autoria de julgamento e termina quando produção devolve aprendizado.

Os princípios duráveis são:

1. capacidade do modelo decide a quantidade de estrutura;
2. contexto é orçamento;
3. conversa não é memória;
4. autor não aprova;
5. pedido não é controle;
6. determinismo vem antes de julgamento;
7. processo acompanha risco e reversibilidade;
8. humano sai do meio repetitivo, não das decisões;
9. produção fecha o ciclo.

Frameworks podem implementar partes dessa arquitetura, mas não devem defini-la. Com a fábrica explícita, a comparação deixa de ser “qual ferramenta é melhor?” e vira “qual capacidade fecha a lacuna desta estação?”.

Essa é a pergunta da [Parte 2: Ferramentas para a fábrica agêntica](artigo-ferramentas.md).

## Referências

- [TLC AI Dev Flow](https://agent-skills.techleads.club/tlc-ai-dev-flow/)
- [Lost in the Middle](https://arxiv.org/abs/2307.03172)
- [Same Task, More Tokens](https://arxiv.org/abs/2402.14848)