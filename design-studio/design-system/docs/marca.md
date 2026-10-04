O Design Studio é um quadro de oficina moderno, da família do FigJam e do Miro, onde PM e UX transformam Dores reais de clientes em Protótipos com um agente de IA. O chão é um canvas pontilhado neutro. Sobre ele ficam painéis lisos com sombra suave, telas dentro de molduras de aparelho e as Dores coladas como notas autoadesivas, uma cor por Fonte. O agente é um colega no mesmo quadro, com cursor laranja e nome, e não uma caixa de chat. A densidade é de ferramenta de trabalho: Geist a 15px, cinzas quentes, bordas finas, cantos generosos e um único laranja, raro.

## Voz e conteúdo

- Escreva em pt-BR simples, para quem não é técnico. Trate a pessoa por "você"; o agente fala em primeira pessoa ("Inseri um aviso depois do bloco “Beneficiário”").
- Chame as coisas pelo que PM e UX reconhecem: Dor, Fonte, Evidência, Relatório, Protótipo, Atual, Proposta, Variante, Ponto de restauração. Esses nomes vão com inicial maiúscula. Nunca exponha a máquina: nada de git, MCP, CLI, checkpoint, stream ou pedido de permissão.
- Botões dizem a ação: "Gerar Variantes", "Inserir", "Descartar", "Limpar filtro". O aviso que vem depois confirma em poucas palavras: "Elemento inserido · Ponto de restauração criado"; "Variantes descartadas. Nada mudou."
- Placeholders mostram um pedido real: "Peça uma mudança, cite uma Dor com @…"; "O que entra aqui? Ex.: um aviso explicando o estorno".
- Todo dado sintético leva o `SeloExemplo` ("Dados de exemplo"). Não invente métricas de impacto, resultados de teste nem nomes de clientes.
- Sem emoji, sem exclamação, sem rótulos em caixa-alta espaçada e sem sobrelinha acima de título.

## Cor

Cinzas quentes carregam tudo; o laranja aparece só onde há ação ou seleção, e três pastéis dizem a origem da Evidência. Há dois temas: abra no claro (projetor e tela compartilhada) e ofereça o escuro para sessões longas. O escuro tem os próprios valores, não uma inversão.

- **Chão e superfícies**: `quadro` com o pontilhado em `ponto` (1.15px no `passo-ponto` de 22px); painéis em `superficie`; fundos recuados em `superficie-2`; hover e seleção discreta em `superficie-3`; menus e barras flutuantes em `elevada`.
- **Texto**: `tinta` para o principal, `tinta-2` para o secundário e os ícones, `tinta-3` para metadados e rótulos de frame. As três passam 4.5:1 em `superficie` e `quadro` nos dois temas; `tinta-3` passa inclusive sobre `ponto`.
- **Laranja**: `acento` é a ação principal, a seleção e o agente. Por cima dele vai sempre `sobre-acento`, nunca branco. Como texto, o laranja só aparece como `acento-tinta`. `acento-suave` é o fundo do item atual e da opção marcada.
- **Fontes**: `nota-likert` (manteiga), `nota-voz` (pêssego) e `nota-fullstory` (menta), sempre com `nota-tinta` por cima.
- **Estado**: `critico` para impacto Alto, gravação e tendência de alta; `atencao` para Médio; `observar` para Baixo e neutros; `ok` para concluído e resolvido. Cada um tem a tinta que passa sobre o próprio fundo suave (`critico-tinta`, `atencao-tinta`, `observar-tinta`, `ok-tinta`).
- **Avisos**: `toast` com `sobre-toast`, invertidos.
- **Bordas**: `borda` divide áreas e linhas. `borda-forte` contorna campos e botões secundários, mas fica em 1,57:1 contra `superficie`: um controle precisa de mais que ela para ser visto (sombra, fundo, rótulo).

Regras com nome:
- **Tinta escura no laranja.** Todo fundo `acento` leva `sobre-acento`. Branco sobre laranja não existe no estúdio.
- **Laranja raro.** O laranja marca três coisas: a ação principal, o que está selecionado e o agente. Se não for nenhuma das três, ele sai.
- **Nenhum azul.** Não há azul em lugar nenhum da interface: links herdam a cor do texto e o foco é contorno em `tinta`.
- **Uma cor por Fonte.** Manteiga é Likert, pêssego é Voz do Cliente, menta é FullStory. Essas cores não servem para status, categoria nem decoração.

## Tipografia

Duas famílias, servidas como arquivo: `ui` (Geist) para toda a interface e `titulo` (Bricolage Grotesque, com eixo óptico) só onde o quadro fala com a pessoa.

- `display` na saudação do Início; `headline` no título de página; `title` em folhas laterais; `title-conversa` no cabeçalho da conversa.
- `body` em toda a interface, com numerais tabulares; `body-lead` no campo do chat do Início; `mensagem` nas respostas do agente; `narrativa` no texto do Relatório, até 66ch.
- `botao` nos rótulos de botão; `label` em rótulos de seção, menus e pílulas; `nota` e `nota-grande` nos títulos das notas.
- Bricolage nunca entra em botões, campos, listas ou corpo de texto. Rótulos ficam em Geist 600, em caixa normal.

## Espaço, forma e camada

- Ritmo: `espaco-2xs` (6), `espaco-xs` (8), `espaco-sm` (10), `espaco-md` (14), `espaco-lg` (22), `espaco-xl` (36). O pontilhado e as grades de notas usam o mesmo `passo-ponto`.
- Estrutura: lateral de `lat-w` (264px, recolhida em `lat-recolhida`), conversa entre `conversa-min` e `conversa-max` ao lado do canvas, páginas em até `conteudo-max`, o Início em `inicio-max`.
- Cantos: `raio` em botões, campos e cartões pequenos; `raio-painel` em painéis do canvas e cartões de frame; `raio-l` em painéis de página; `raio-folha` em folhas laterais; `raio-xl` no campo do chat do Início; `raio-pill` em seletores, chips, pílulas, toasts e no rótulo do cursor. A nota é a exceção: `raio-nota`, quase reta, como papel.
- Bordas de 1px. Linha tracejada sempre significa algo: vazio ou "novo", zona de soltar, vaga e prévia do Inserir, conector entre Dor e tela.
- Sombra diz camada, não importância: `sombra-1` para repouso, `sombra-2` para o que flutua sobre o canvas, `sombra-3` para o que se sobrepõe a tudo, `sombra-nota` para papel colado e `sombra-aparelho` para molduras. Sem brilho, sem sombra colorida, sem gradiente decorativo.

## Movimento

Transições entre 0.15s e 0.24s na curva `cubic-bezier(0.16, 1, 0.3, 1)`. O cursor do agente desliza em 0.62s. Painéis e mensagens surgem subindo de leve. O frame que o agente acabou de mudar pulsa um anel laranja uma vez. Só indicadores de carregamento giram ou brilham em laço. Com `prefers-reduced-motion`, tudo cai para 0.001ms e o pulso vira um anel fixo.

## Foco e acessibilidade

- Foco visível em tudo que é focável: contorno de 2px em `tinta`, afastado 2px. Ele passa 3:1 em todas as superfícies, nos dois temas.
- WCAG 2.2 AA com folga para projeção. A informação nunca depende só de cor: impacto vai com ícone e palavra, a Fonte vai com ícone, e os gráficos têm tabela gêmea.
- Dois pares ficam abaixo do ideal e estão marcados nas notas dos tokens: `sobre-acento` em `acento-press` (4,04:1, só durante o clique) e `borda-forte` como único limite de um controle.

## O quadro

- O canvas é um mundo transformado por translate e scale. Rótulos de frame, de linha e de coluna de notas dividem tamanho e espaçamento por `--z` (o zoom, com piso 0.42) e leem igual em qualquer zoom. Conectores usam traço que não escala.
- Cada tela é uma `MolduraDeAparelho` com rótulo acima, a `entre-frames` da vizinha. Cada Dor fica colada como `NotaAutoadesiva` à direita da tela onde dói, com conector tracejado.
- Enquanto o agente trabalha, o `CursorDoAgente` vai até o que ele está criando e a resposta é escrita na conversa ao lado.
- O que roda dentro da tela do aparelho é o Protótipo do cliente e usa o design system do cliente. Nada destes tokens entra lá, e nada de lá vira token do estúdio. As únicas marcas do estúdio por cima da tela são as do modo ao vivo.

## Modo ao vivo

As ferramentas da base do canvas mudam a tela no lugar. **Editar** escolhe um elemento e gera Variantes dele. **Inserir** escolhe um ponto entre dois blocos (a mira) e gera um elemento novo com Variantes (a vaga e a prévia). **Ajustar** muda densidade, texto e cantos ao vivo. As três usam o `PainelFlutuante`; a ferramenta ativa fica invertida em `tinta`, e o laranja é reservado à seleção, à mira, à vaga e à prévia.

## Gráficos

Os Gráficos do Relatório falam em forma de ênfase: `graf-enfase` para a única série ou categoria em foco, `graf-contexto` para todo o resto, `graf-enfase-lavada` para o resto de uma barra partida pelo filtro e `graf-area` sob a linha. A paleta passou no validador de cores nos dois temas. O cinza reprova de propósito no croma mínimo, porque deve recuar.

- Um só eixo; duas medidas viram dois gráficos.
- Barras de 20px até 74% do trilho, com a ponta do dado arredondada.
- Linha de 2px com mira, dica e navegação por teclado.
- Filtro numa linha acima; cada gráfico tem "Ver tabela".
- Categoria nunca vira arco-íris: trocar a ênfase é tocar em outra categoria.

## Iconografia

Ícones de traço do próprio app (grupo de assets Icones): grade de 24, traço de 1.75, pontas e junções arredondadas, sem preenchimento. Em código use `stroke="currentColor"` com a classe `ic`, para o ícone seguir o texto: `tinta-2` na maior parte da interface, `acento-tinta` no item atual, `acento` dentro dos toasts. Tamanhos: 17px em botões, 18px na lateral, 13px em pílulas. Sem emoji como ícone.

## Marca e agentes

- A marca é o sinal (grupo de assets Marca) ao lado de "Design Studio" em Bricolage Grotesque 700, em `tinta`. Use `sinal.svg` no claro e `sinal-escuro.svg` no escuro.
- Os agentes são identificados pelas logos oficiais de Claude e Devin (grupo de assets Agentes), sempre dentro do ladrilho neutro de `LogoDoAgente`. Elas não são acento e não colorem mais nada.
- A Skill de UX do porte é o iu-memorable (grupo de assets iu-memorable). Use a marca dele só onde o app apresenta a Skill de UX, como nas Configurações: `simbolo` de 24px para cima, `simbolo-16` entre 16 e 20px, versão `-escuro` sobre fundo escuro. Ela não substitui o sinal do Design Studio.
- O estúdio não usa logotipo, nome nem fonte de nenhuma outra empresa.

## Consumindo

Os componentes são React 18 com tipos TypeScript, nomes em pt-BR (`Botao`, `NotaAutoadesiva`, `GraficoDeLinha`) e props em pt-BR (`variante`, `aoMudar`, `emFoco`). Toda classe CSS da lib começa com `dst-`, então ela convive com o CSS de qualquer app.

- **No código**: importe `@design-studio/design-system/dist/ds-bundle.css` uma vez (tokens, fontes, base e componentes) e os componentes de `@design-studio/design-system`. Os tokens também saem como dados (`cores`, `raios`, `estilosDeTexto`) e há uma função `razaoDeContraste` para checar pares novos.
- **Numa página da Claude Design**: com React 18 na página, os componentes ficam em `window.DesignStudio` (`const { Botao, NotaAutoadesiva } = window.DesignStudio`). Cada componente tem prévia ao vivo, guia e tipos.
- **Tema**: `data-theme="dark"` na raiz do documento troca todos os tokens; sem atributo vale o claro.
- **Tokens**: cada um é uma variável CSS com o próprio nome (`--acento`, `--raio-l`, `--lat-w`). Para cola de layout entre componentes, use os tokens de espaço (`--espaco-md`) e de raio, nunca hex solto.
- **Responsivo**: abaixo de 820px as barras do gráfico e os insights passam a uma coluna.
