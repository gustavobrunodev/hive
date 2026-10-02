# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

- **Protótipo de validação deste app:** HTML, CSS e JS estáticos, sem build. É uma escolha do usuário (2026-10-01): abre em qualquer navegador e é publicado como link privado para teste. Não é o código do app final.
- **App real:** Electron, Windows primeiro, com renderer React. O harness de agentes vem copiado do Hive Desktop ([ADR 0002](docs/adr/0002-harness-copiado-do-hive.md)).
- **Protótipos gerados pelo app:** Angular ([ADR 0004](docs/adr/0004-template-angular.md)).

## Users

**Principais:** Product Managers e Designers de UX de um grande banco brasileiro. Conhecem a fundo o produto, os clientes e a pesquisa, mas não sabem usar agentes de código, terminal, git, MCP nem a infraestrutura da AWS. A tarefa deles é transformar uma dor real de cliente num Protótipo mockado e testável o mais rápido possível, e validá-lo com clientes ("errar rápido").

**Também usam o app:** o time em workshop, olhando a mesma tela, e a liderança, que vê o antes e depois junto com as evidências na hora de decidir.

## Product Purpose

Reunir num só lugar três coisas:

- os dados de dor dos clientes (Likert, Voz do Cliente, FullStory);
- os Protótipos a criar ou melhorar;
- a capacidade de um agente de propor e construir as melhorias.

O motor principal é o chat com o agente, ao lado do Protótipo rodando ao vivo. O objetivo final é um app mockado para teste de usabilidade, não código de produção.

**Experiência (decisão do usuário, 2026-10-01):** o mais parecida possível com o Claude Design. O chat é a primeira tela. Nela o usuário:

- escolhe agente e modelo;
- dita por voz;
- cola e anexa arquivos;
- escolhe em qual Protótipo vai trabalhar, ou nenhum.

Ao enviar, o app passa para a vista de trabalho: chat na lateral e o Protótipo sendo criado ou alterado no canvas.

**Sucesso no POC:** um PM que nunca abriu um terminal vai de uma Dor real a uma Proposta melhorada, rodando ao vivo, numa única sessão e sem ajuda técnica.

## Positioning

O Claude Design já atende PMs, mas não faz quatro coisas que este produto faz:

1. **Contexto de dor real.** Fontes viram Relatórios de Fonte, que viram Dores, e as Dores alimentam o agente.
2. **Protótipo publicável.** O Protótipo é código rodável que vira URL de teste.
3. **Dados na conta AWS do banco.** Os dados não saem dela.
4. **Skill de UX.** A régua de UX é o impeccable, ou o iu-memorable com o DS do banco.

Uma feature que não serve a pelo menos uma dessas quatro fica de fora.

## Operating Context

- Usado sozinho num notebook corporativo, em sessões longas.
- Usado em call com tela compartilhada.
- Usado em workshop com projetor, com o time lendo de longe.
- Usado ao apresentar à liderança. Qualquer tela precisa funcionar projetada e compartilhada, e o antes e depois precisa ser mostrável.
- **Construção e porte.** O POC é construído fora do banco e portado depois por outro agente ([ADR 0001](docs/adr/0001-porte-com-pontos-de-troca.md)).
- **Dados do POC.** Só dados sintéticos: 2 ou 3 Produtos (por exemplo Câmbio e Extrato) com Dores semeadas.
- **Idioma.** Somente pt-BR.
- **Fluxo guiado.** Escolher o Produto, depois a Fonte, gerar o Relatório de Fonte, ver o Painel de Top Dores e criar o Protótipo.
- **Fluxo solto.** Chat no nível do Produto e chat dentro de cada Protótipo, com atalhos em linguagem de PM.

## Capabilities and Constraints

O vocabulário canônico está em [GLOSSARY.md](GLOSSARY.md): Fonte, Evidência, Dor, Relatório de Fonte, Produto, Protótipo, Atual, Proposta, Variante, Referência, Briefing, Ponto de restauração e Skill de UX. O escopo completo está em [ROADMAP.md](ROADMAP.md).

**Dentro do POC:**

- **Dores no chat e na lateral.** A tela inicial sugere as Dores em alta, o usuário cita Dores com @ e anexa Relatórios. O painel completo de Dores, com as 5 primeiras por Fonte, fica num item da barra lateral.
- **Relatório de Fonte.** Tem duas vistas. **Leitura** traz as Dores ranqueadas e uma narrativa com citações e Evidências. **Gráficos** (pedido do usuário em 2026-10-02) traz filtro por Dor e por período, volume por categoria de Dor, recorrência semana a semana e insights por categoria. Cada gráfico tem uma tabela equivalente.
- **Protótipo de produto existente.** Recria o Atual a partir das Referências; a Dor é opcional.
- **Protótipo de produto novo.** Parte de um Briefing.
- **Propostas.** Um Protótipo tem várias Propostas, com uma ativa.
- **Sessão de design.** O chat fica ao lado do palco live. O overlay de seleção, anotação e Variantes funciona dentro do palco, com troca entre celular e desktop e telas pensadas primeiro para celular. O modo ao vivo tem duas ferramentas. **Editar** gera Variantes de um elemento escolhido. **Inserir** cria um elemento novo antes ou depois de um bloco da tela, a partir de um pedido em texto livre, e também oferece Variantes para escolher.
- **Pontos de restauração.** Um a cada resposta do agente.
- **Multi-agente visível.** Claude e Devin, cada um com seus modelos e identificado pela logo original do agente. O Copilot saiu do escopo em 2026-10-01.
- **Sem pedido de permissão técnico.** O agente age livremente dentro da pasta do Protótipo.
- **Configurações.** Mostram a Skill de UX, que se atualiza sozinha e volta à versão anterior se quebrar.

**Fora do POC (roadmap):**

- Publicar em S3 e CloudFront e devolver a URL de teste.
- AWS configurada por Protótipo.
- Ferramentas de teste de usabilidade.
- Loop de validação com Hipótese.
- Envio ao Figma.
- Dor consolidada entre Fontes.

**Restrições:**

- O design system deste app precisa ser diferente do usado no Hive Desktop.
- As telas dos Protótipos seguem o design system do Itaú (IDS) o mais de perto possível (decisão do usuário em 2026-10-02). Os tokens de cor, raio, tipo e anatomia de botão foram lidos do CSS público de itau.com.br. As fontes proprietárias do banco não são copiadas: o Lato, fallback declarado pelo próprio site, entra no lugar delas. Logos também não são copiadas. Dentro do banco, o iu-memorable substitui essa camada no porte.

## Brand Commitments

- **Nome:** Design Studio.
- **Voz:** pt-BR simples, para quem não é técnico. As coisas se chamam pelo que PM e UX reconhecem (Dor, Protótipo, Proposta), nunca pelo que o sistema faz por baixo (MCP, git, CLI, checkpoint, stream).
- **Identidade:** visual próprio, distinto do Hive Desktop.
- **Cores (decisão do usuário, revista em 2026-10-01).** O laranja do Itaú é o acento da interface, usado só nas ações principais e nos destaques, sobre neutros modernos. **Nenhum azul**: o usuário recusou o azul-marinho da primeira versão. A regra vale também quando contrariar alertas de padrão saturado. Não usa logo, nome nem tipografia do banco; a marca na tela é "Design Studio".
- **Conteúdo dos frames (decisão do usuário, 2026-10-02).** As telas dentro dos frames seguem os tokens do IDS, inclusive o azul-marinho do banco. A regra do "nenhum azul" vale para a interface do Design Studio, não para o Protótipo que o usuário está desenhando.
- **Distribuição:** o protótipo fica em arquivos locais e não é publicado como link público, porque carrega a identidade de cor e, dentro dos frames, os tokens de design system de uma organização real.
- **Referência de experiência:** o Claude Design, o mais próximo possível: chat como primeira tela, chat ao lado do canvas, comentários na própria tela, ajustes finos e modo apresentação. Ele é referência de experiência, não de visual.
- **Temas:** claro e escuro, com alternância. Abre no claro, por causa do projetor e do compartilhamento de tela.
- **Tom visual:** moderno, amigável e intuitivo. O usuário recusou o primeiro mundo visual, a sinalização de metrô.

## Evidence on Hand

- **Não há dados reais nem marca do banco.** Não existem dados reais de clientes, prints dos apps do banco nem logos. Todo dado de demonstração é sintético e aparece rotulado como "Dados de exemplo".
- **Tokens do IDS lidos do site público (2026-10-02).** São 371 variáveis CSS `--ids_*` de itau.com.br, com cores, raios, tipo e easing. Viram valores no `proto.css` do protótipo, e nenhuma imagem, logo ou arquivo de fonte do banco foi copiado.
- **Dores semeadas a partir do briefing do usuário:**
  - Likert: "Não consigo ver o histórico maior que 90 dias".
  - Voz do Cliente: "Minha transação de câmbio estornou e não recebi nenhuma notificação".
  - FullStory: rage click, sempre com tela e elemento onde acontece.
- **Afirmações que não podem ser inventadas:** métricas de impacto real, resultados de testes com clientes, nomes de clientes reais.
- **Documentos do projeto:** [ROADMAP.md](ROADMAP.md), [GLOSSARY.md](GLOSSARY.md) e [docs/adr/](docs/adr/).

## Product Principles

1. **Dor real primeiro.** Toda Proposta aponta para as Evidências que a justificam, e o usuário consegue abri-las sem sair do trabalho.
2. **Esconder a máquina.** Nada de terminal, git, MCP ou pedido de permissão. O usuário vê Dores, Protótipos e Propostas, não arquivos e processos.
3. **Errar rápido, com volta.** Gerar alternativas é barato e todo passo do agente é reversível.
4. **Mostrável.** Toda tela funciona projetada e em compartilhamento de tela, e o antes e depois de um Protótipo está sempre a um gesto de distância.
5. **Portável.** O que difere entre a máquina pessoal e a do banco passa por um ponto de troca explícito.

## Accessibility & Inclusion

- **WCAG 2.2 AA** em todas as telas: contraste, foco visível, navegação completa por teclado e rótulos para leitor de tela.
- **Margem de contraste para projeção.** O app é usado com projetor e em compartilhamento de tela comprimido, que lavam contraste sutil. Texto principal, estados e dados ficam bem acima do mínimo AA, e a informação nunca depende só de nuances de cor.
- **Exceção dentro dos frames: o botão primário do IDS.** Branco sobre #FF6200 dá 3,0:1. Passa no AA como texto grande, porque o rótulo tem 20px em negrito, mas fica sem margem para projeção. É mantido por fidelidade ao design system do banco e vale só para o conteúdo dos frames, nunca para a interface do Design Studio. O botão desabilitado do IDS no Atual também fica abaixo de 3:1, mas a WCAG isenta controles desabilitados.
