# Fontes, proveniência e ressalvas

Leia quando precisar citar a origem de uma afirmação, mandar um link, ou quando o
interlocutor questionar de onde vem a recomendação.

---

## 1. Fontes primárias desta versão

**Workshop Tech Leads Club — "Desenvolvimento Assistido por IA Avançado #3" (set/2026)**
Dia 1, sessão 1: *"Desenvolvimento com IA, Harness, Spec-Driven e Como Trabalhar com Modelos
Frontier"* — 1h46, conduzida por Waldemar Neto, com participação de Felipe Rodrigues,
Felipe Adamoli e William Fernandes.
https://www.techleads.club/c/workshop-ia-3-09-2026/sections/1181300/lessons/4533570

**Formato da aula:** construção de um ERP do zero, ao vivo, subindo a escada de estrutura um
degrau por feature — prompt cru → plan mode → skill própria → `tlc-spec-driven` →
`tlc-spec-lean` → code review em camadas → auditoria do próprio harness. Ferramenta: Cursor.
Modelo: Grok 4.6 Fast para a maior parte, por velocidade e custo.

Resumo oficial da aula, na íntegra:

> Nessa aula construímos um ERP do zero para entender, nível a nível, por que um prompt solto
> não basta e o que precisa existir em volta do modelo para o código sair validado. Começamos
> com um "implemente isso" seco, passamos por plan mode, criamos uma skill de spec e
> verificação, rodamos o tlc-spec-driven completo e chegamos na versão lean, onde o modelo
> implementa livre e um sub agent prova o trabalho contra um checklist. No caminho vemos o que
> mudou nos modelos nos últimos meses e por que parte do harness que a gente construía já
> virou babysitting.

**Dia 1, sessão 2:** *"A Próxima Fase da Fábrica de Software Agêntica"* — 1h09, conduzida
por Waldemar Neto.
https://www.techleads.club/c/workshop-ia-3-09-2026/sections/1181300/lessons/4533572

**Formato da aula:** continuação do ERP ao vivo. Uma mudança visual simples roda sem plano;
uma POC em branch ilustra exploração aberta; depois o fluxo completo passa por discovery,
design doc, task no Linear, implementação local/remota, verificação e PR. A sessão também
mostra automação de triagem e um caso real de Slack → contexto → correção → PR.

**Resumo editorial, em paráfrase:** a aula move a fábrica do fluxo humano-em-todas-as-etapas
para uma linha em que qualquer task — vinda de Slack, alerta ou PM — atravessa o mesmo
planejamento, implementação e verificação. O humano concentra-se em intenção/discovery e no
review final; design doc e task vivem em ferramentas colaborativas ligadas por MCPs; um
agente em nuvem pode devolver o PR sem depender da máquina do desenvolvedor.

**Dia 1, sessão 3:** *"Hooks: Harness-toolkit"* — 33min12s, apresentada por Felipe
Rodrigues.
https://www.techleads.club/c/workshop-ia-3-09-2026/sections/1181300/lessons/4533574

**Formato da aula:** apresentação do Harness Toolkit seguida de demonstrações no Cursor. O
agente é bloqueado ao tentar ler segredo, executar `push --force`, encerrar com teste
quebrado, adicionar comentário narrativo, duplicar código e abrir PR sem review. A sessão
fecha com a arquitetura floor→política/rails, posturas de interação, observabilidade,
portabilidade entre providers e uma autoavaliação contra o OWASP Agentic Top 10.

**Resumo editorial, em paráfrase:** prompt orienta, mas não controla execução. Hooks dos
editores viram pontos de interceptação para código determinístico decidir `allow`, `ask`,
`deny` ou injetar contexto. Um piso anterior à configuração impede que o próprio agente
desligue garantias básicas; controles opcionais adaptam o rigor operacional do projeto sem
misturá-lo ao quanto o agente interrompe o humano.

---

## 2. Links de referência

**Material da aula**
- Diagramas (Excalidraw): https://link.excalidraw.com/l/7V6DWtFSy3p/2CqCeb9zehB
- Código construído ao vivo: https://github.com/tech-leads-club/workshop-1209
- Aula — sessão 2: https://www.techleads.club/c/workshop-ia-3-09-2026/sections/1181300/lessons/4533572
- Aula — sessão 3: https://www.techleads.club/c/workshop-ia-3-09-2026/sections/1181300/lessons/4533574
- PDF da sessão 3: https://assets-v2.circle.so/5r14txpbb99v0uus70ggbitwfjmz
- `getdesign.md` (catálogo de DESIGN.md usado na demo): https://getdesign.md/

**Skills da Tech Leads Club** (abertas, gratuitas)
- Catálogo: https://agent-skills.techleads.club/
- Repositório: https://github.com/tech-leads-club/agent-skills
- AI Dev Flow (fábrica agêntica): https://agent-skills.techleads.club/tlc-ai-dev-flow/
- `tlc-discover`: https://agent-skills.techleads.club/skills/tlc-discover/
- `tlc-plan`: https://agent-skills.techleads.club/skills/tlc-plan/
- `tlc-implement`: https://agent-skills.techleads.club/skills/tlc-implement/
- `tlc-spec-driven`: https://agent-skills.techleads.club/skills/tlc-spec-driven/
- `tlc-spec-lean`: https://agent-skills.techleads.club/skills/tlc-spec-lean/
- `the-judge` (code review): https://agent-skills.techleads.club/skills/the-judge/
- `harness-eval` (o harness ainda é válido?): https://agent-skills.techleads.club/skills/harness-eval

Instalação: `npx @tech-leads-club/agent-skills install --skill <nome>`

**Outras ferramentas**
- Harness Toolkit: https://github.com/tech-leads-club/harness-toolkit
- `harness-score` (estrutura do harness existe e está correta?): https://github.com/paladini/harness-score
- Playwright MCP: https://github.com/microsoft/playwright-mcp
- Padrão AGENTS.md: https://agents.md/
- OWASP — Agentic AI Threats and Mitigations: https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/

**Conteúdos relacionados exibidos na sessão 3**
- Harness Engineering: https://www.techleads.club/c/ia-first-curso-desenvolvimento-com-ia/sections/982679/lessons/3727678
- Harness Engineering — o futuro da engenharia de software com IA: https://www.techleads.club/c/compartilhe-aprenda/harness-engineering-o-futuro-da-engenharia-de-software-com-ia
- Lançamento do `harness-score` v1.0: https://www.techleads.club/c/compartilhe-aprenda/lancado-harness-score-v1-0-um-scan-qualquer-ferramenta-agentica
- Testes com IA — impedir que o agente sabote os testes: https://www.techleads.club/c/aulas-semanais/aula-testes-eficientes-com-ia
- Code Review Escalável com IA: https://www.techleads.club/c/ia-first-curso-desenvolvimento-com-ia/sections/982679/lessons/3785892

**Papers** — ver `contexto.md` seção 7 para o detalhe e para a correção do link errado.
- Liu et al. 2023, *Lost in the Middle* — arXiv:2307.03172
- Levy, Jacoby & Goldberg 2024, *Same Task, More Tokens* — arXiv:2402.14848

---

## 3. Falas que carregam a tese

Reconstruídas da transcrição (fala espontânea, levemente normalizada). Use para dar peso a
uma recomendação, sempre atribuindo.

Sobre **quem verifica**:
> "Não dá para deixar o mesmo agente cuja missão é implementar dizer se a coisa está pronta,
> porque ele vai dizer que está — a missão dele é terminar aquilo ali. Quando abre outro
> subagente, a missão dele é provar que aquilo está funcionando; ele vai fazer de tudo para
> validar."

Sobre **a régua modelo→estrutura**:
> "Essa estrutura está te atrapalhando, porque esses modelos são muito mais inteligentes para
> implementar. Isso aqui basicamente é fazer babysitting nesses modelos."

E o fecho da sessão:
> "spec-driven ainda é útil rodando com os modelos mais baratos. spec-lean é o caminho para
> rodar com modelos melhores."

Sobre **validação visual**:
> "A IA sem ver a coisa é quase impossível de ficar bom, ou de você conseguir validar que
> ficou bom. Modelos são muito bons com imagens, mas muito ruins em interpretar algo visual
> sem ter aquela imagem."

Sobre **`AGENTS.md`**:
> "Coloque o mínimo de coisa possível, só coisas que o modelo não saberia sozinho. Depois de
> ter bastante código feito sempre do mesmo jeito eu posso remover, porque o código é o melhor
> exemplo."

Sobre **spec como fonte da verdade**:
> "Se você não está num time em que consegue controlar que toda operação vai ser feita com
> spec-driven, um PR já tem o drift: o código é diferente da spec. Aí você diz para ele 'essa
> aqui é a spec', ele olha o código, é diferente, e começa a lutar num raciocínio pensando
> sobre o que é o certo. Está atrapalhando o modelo."

Sobre **maturidade do fluxo**:
> "Quanto menos eu humano me envolver nesse loop de implementação, melhor — porque daí eu
> consigo rodar esse loop em qualquer lugar, não precisa ser na minha máquina."

Sobre **benchmark de skills**:
> "Ninguém fazia benchmark de verdade. 'Essa skill aqui é boa' — era muito sentimento da
> pessoa. Se a gente está gastando token numa coisa, eu quero saber se ela é realmente
> efetiva."

Da **sessão 3, sobre controle de execução**:
> "Pedido nunca vai ser controle de execução."

Sobre **adoção de governança**:
> "Ferramenta de governança que exige configuração antes de servir não passa da primeira
> semana de uso."

E a tese de **autonomia**:
> "Dar autonomia a um agente é uma decisão de arquitetura, não de prompt."

### Teses da sessão 2 (paráfrase da transcrição)

- O humano sai do meio repetitivo da execução, não das decisões: dirige discovery/intenção
  e valida direção no final.
- Tracker não morreu; voltou como fila, estado e ponto de entrada para agentes.
- Design doc explica o porquê e a solução de alto nível; a task diz o que construir; o
  checklist diz como provar.
- Negócio não deveria ser obrigado a versionar Markdown se já trabalha melhor em
  Notion/Confluence; MCPs preservam acesso do agente ao contexto externo.
- A experiência tende a se unificar: o agente aparece nas ferramentas das pessoas, em vez de
  obrigar cada área a adotar a interface e o formato preferidos por engenharia.
- Task grande demais força decisões durante a implementação. A heurística da aula é ficar na
  ordem de até uma semana de trabalho humano, calibrando pelo harness e pela maturidade.
- Subagente prematuro custa mais e demora mais; o valor aparece quando a mudança ameaça a
  janela ou quando a missão precisa ser independente, como verificação.
- Automatize primeiro o que não diferencia o negócio e resista a adicionar ferramenta nova
  apenas para a etapa de implementação.

As anotações do participante registram o fluxo de Waldemar com `tlc-spec-lean`; o catálogo
oficial pós-aula publica `tlc-discover → tlc-plan → tlc-implement → the-judge`. A skill
preserva os dois como variantes e usa os nomes/links publicados ao encaminhar execução.

### Teses da sessão 3 (paráfrase da transcrição)

- Modelo melhor erra menos, mas continua tocando shell, arquivos, git e subagentes; por isso
  autonomia é um problema estrutural, não só de qualidade do modelo.
- Prompt, skill e `AGENTS.md` são pedidos. O controle começa quando um hook intercepta o
  evento e código fora do modelo decide o que pode ocorrer.
- Garantia forte vem da ordem: o floor roda antes da configuração, e o agente não escreve na
  superfície que poderia desligá-lo.
- Um bloqueio precisa preservar o caminho legítimo parecido com o risco; caso contrário a
  equipe desliga a governança depois de poucos dias.
- Gate de saída impede o agente de se declarar pronto sem evidência recente; falha devolve o
  trabalho ao agente, e repetição precisa de limite para não criar loop autônomo infinito.
- Regra de time pode virar gate customizado — o exemplo foi impedir abertura de PR sem review
  pela skill `the-judge` e exigir nova revisão após qualquer modificação.
- Postura de interação muda interrupções, não evidência nem critério de pronto.
- Governança adotável entrega baseline antes de configuração; política específica do projeto
  vem depois, versionada e revisada como código.
- Decisão, motivo, prova, custo e retry precisam ser observáveis; controle sem trilha não é
  auditável.
- A avaliação OWASP apresentada é autoavaliação dos autores, com lacunas publicadas; não é
  certificação nem cobertura independente.

---

## 4. Ressalvas de precisão

Coisas que esta skill afirma com peso diferente. Respeite ao responder.

**a) O link de paper do material está errado.** O material aponta `arXiv:2402.01438` como
evidência de degradação por tamanho de contexto. Esse ID é outro artigo (Copilot e idiomas
naturais). Verificado em set/2026. As referências corretas estão em `contexto.md` §7.

**b) O benchmark das skills `tlc-*` foi rodado por quem as escreveu.** É aberto, publicado e
reproduzível — e ainda assim é benchmark do fabricante. A metodologia (uma feature complexa
de referência, reimplementada várias vezes por framework) é razoável; a amostra é uma feature.
Apresente como "posição da TLC com benchmark publicado", nunca como resultado independente.

**c) Os percentuais de janela de contexto (40/60) são regra de bolso**, não resultado de
paper. A *direção* é medida; o *limiar* é operacional.

**d) Números de adoção corporativa** ("X% do código escrito por IA") medem linha gerada, não
trabalho entregue, e variam enormemente por contexto. Cite com essa ressalva.

**e) Nomes de modelo e tiers envelhecem rápido.** Quando a pergunta citar um modelo posterior
a set/2026, não finja conhecê-lo: classifique pela régua de capacidade e responda pelo eixo.

**f) Esta versão cobre as sessões 1 a 3 de um workshop de 11 sessões.** Ver seção 5.

**g) "Até uma semana humana" é heurística operacional da sessão 2.** Não é medida de paper
nem limite do modelo. O tamanho sustentável cresce com arquitetura, sensores, isolamento e
capacidade do modelo; o mecanismo importante é evitar planejar etapas futuras sobre código
que ainda não existe.

**h) A previsão de automação até o fim de 2026/início de 2027 é posição da TLC.** A direção
é sustentada pelos exemplos apresentados; o prazo não é consenso e não vale igualmente para
empresas com legado, compliance ou baixa maturidade de harness.

**i) A contagem de regras da sessão 3 diverge entre artefatos.** A página editorial diz sete
regras inegociáveis; a fala, o PDF e o README público consultado em 22/set/2026 dizem oito.
Trate nomes, contagens e defaults como snapshot do produto e consulte o catálogo atual antes
de responder com número fechado.

**j) A cobertura OWASP é autoavaliação do projeto.** O material declara 4 riscos cobertos,
5 parciais e 1 não aplicável, com lacunas explícitas. Isso é mais auditável que alegar 10/10,
mas não equivale a teste ou certificação independente.

**k) O toolkit estava em evolução durante a aula.** Diferencie o padrão arquitetural estável
(interceptar fora do modelo, fail closed, proteger política, registrar decisão) da superfície
do produto (rails, nomes, defaults, providers e comandos), que pode mudar.

---

## 5. O que esta versão **não** cobre

A v1.2 vem das três primeiras sessões. Conscientemente fora de escopo — se a pergunta cair
aqui, responda pelos fundamentos e **diga que essa parte não veio da fonte**:

| Tema | Onde foi tratado no workshop |
|---|---|
| Projeto brownfield, migração e repatriação de legado | Dia 1 tarde / Dia 2 |
| Arquitetura de software na era da IA | Dia 2 |
| Mercado e o papel do novo dev | Dia 1 (Felipe Adamoli) |
| Desenvolvimento com IA no iFood | Dia 1 (Júlio Santos) |
| Empresa IA-first, arquitetura para eficiência | Dia 2 |
| Workflow end-to-end em codebase real | Dia 2 |

---

## 6. Como estender esta skill com novas sessões

O desenho suporta crescer por acréscimo. Ao incorporar uma sessão nova:

1. **Extraia** transcrição + resumo + links da aula.
2. **Classifique cada afirmação** num dos eixos existentes (fluxo, harness, verificação,
   contexto, indústria) e acrescente na referência correspondente — não crie arquivo novo
   por sessão. O leitor pergunta por tema, não por aula.
3. **Abra uma referência nova só quando surgir um eixo genuinamente novo** (ex.: brownfield e
   migração provavelmente merecem `legado.md`; arquitetura merece `arquitetura.md`). Se abrir,
   registre na tabela de roteamento do `SKILL.md`.
4. **Atualize o `SKILL.md`** apenas se a sessão mudar uma *regra de decisão*. Conteúdo novo
   que não muda decisão vai só para a referência — o corpo precisa continuar enxuto.
5. **Registre a sessão** na seção 1 e remova a linha correspondente da tabela da seção 5.
6. **Verifique os links citados na aula** antes de propagá-los. O item 4(a) existe porque o
   material trazia um link errado.
7. **Bump** de `metadata.version` e `metadata.snapshot`.
