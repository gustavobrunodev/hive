# Design Studio

App onde Product Managers e Designers de UX transformam dores reais de clientes do Itaú em Protótipos mockados, para validar hipóteses com clientes antes de qualquer desenvolvimento de produção.

## Dados de dor

**Fonte**:
Uma base de sinais de clientes: Likert, Voz do Cliente ou FullStory.
_Avoid_: base, datasource, origem

**Likert**:
A Fonte com as notas e os comentários abertos que clientes deixam dentro do Produto.
_Avoid_: pesquisa, NPS, avaliação

**Voz do Cliente**:
A Fonte com as ligações em que clientes relatam dores a atendentes.
_Avoid_: VoC, call center, atendimento

**FullStory**:
A Fonte com o comportamento real de navegação dos clientes e seus sinais de frustração (rage click, dead click, error click).
_Avoid_: analytics, replay

**Evidência**:
Um registro bruto de uma Fonte: uma resposta de Likert, uma ligação, uma sessão do FullStory.
_Avoid_: registro, dado, feedback

**Dor**:
Um problema do cliente identificado num Relatório de Fonte a partir de várias Evidências daquela Fonte, com frequência e impacto. Pertence a uma única Fonte; no FullStory, sempre inclui onde acontece (tela e elemento), não só o tipo de sinal.
_Avoid_: problema, issue, insight, pain point

**Relatório de Fonte**:
A análise datada de uma Fonte, para um Produto e um período, que produz Dores ranqueadas e serve de contexto para o agente propor melhorias.
_Avoid_: relatório, report, análise

## Trabalho

**Produto**:
A oferta do Itaú que um PM ou UX cuida (ex.: Câmbio, Extrato), que recorta as Fontes e agrupa Relatórios de Fonte e Protótipos.
_Avoid_: app, jornada, squad

**Protótipo**:
Uma aplicação web mockada, criada e mantida pelo Design Studio a partir de um template, que recria telas de um Produto e propõe melhorias, normalmente ligadas a uma ou mais Dores, para teste com clientes. Nunca é código de produção.
_Avoid_: projeto, app, mock, POC

**Referência**:
Material sobre o app real (prints, URL, sessão do FullStory) que o agente usa para recriar telas dentro de um Protótipo.
_Avoid_: anexo, input, inspiração

**Atual**:
A recriação mockada, dentro de um Protótipo de produto existente, de como as telas do Produto são hoje, feita a partir das Referências.
_Avoid_: as-is, original, baseline

**Proposta**:
Uma alternativa de telas que o agente cria dentro de um Protótipo, ao lado do Atual; um Protótipo guarda várias Propostas, com uma ativa.
_Avoid_: to-be, melhoria, nova versão

**Variante**:
Uma alternativa gerada no modo live para um elemento selecionado, que o usuário aceita ou descarta; aceitar altera a Proposta.
_Avoid_: opção, alternativa, versão

**Ponto de restauração**:
O estado de um Protótipo depois de cada resposta do agente, para onde o usuário pode voltar com um clique.
_Avoid_: checkpoint, commit, versão

**Briefing**:
O ponto de partida de um Protótipo de produto novo, que não tem Atual: texto livre, um PRD, uma ideia.
_Avoid_: input, prompt, ideia

## Ferramental

**Skill de UX**:
O pacote trocável de onde o app tira as regras de UX que entrega ao agente, o detector e o template de Protótipo: impeccable fora do banco, iu-memorable dentro. O modo ao vivo é do app, não da Skill de UX.
_Avoid_: motor de design, kit de design, design system
