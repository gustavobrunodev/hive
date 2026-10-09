---
name: Design Studio
description: Quadro de oficina onde as Dores reais do cliente ficam coladas ao lado das telas e o agente trabalha como colega, com cursor e nome.
colors:
  acento: "#ec7000"
  acento-hover: "#d96600"
  acento-press: "#c45c00"
  acento-suave: "#fdeee2"
  acento-tinta: "#a34c00"
  sobre-acento: "#1a1a1a"
  quadro: "#f6f6f4"
  ponto: "#dcdcd6"
  superficie: "#ffffff"
  superficie-2: "#f7f7f5"
  superficie-3: "#efefec"
  borda: "#e6e6e1"
  borda-forte: "#cfcfc8"
  tinta: "#1a1a1a"
  tinta-2: "#48483f"
  tinta-3: "#5e5e57"
  nota-likert: "#ffe7a0"
  nota-voz: "#ffd2c0"
  nota-fullstory: "#cdeed8"
  nota-tinta: "#29261d"
  critico: "#c4291c"
  critico-suave: "#fdebe8"
  critico-tinta: "#9c1f14"
  atencao: "#ffe08a"
  atencao-tinta: "#614300"
  observar: "#ececea"
  observar-tinta: "#4c4c47"
  ok: "#1f8a5b"
  ok-suave: "#e2f3e9"
  ok-tinta: "#12633f"
  toast: "#1a1a1a"
  aparelho: "#0f0f0f"
  escuro-quadro: "#131312"
  escuro-ponto: "#2b2b29"
  escuro-superficie: "#1b1b1a"
  escuro-superficie-2: "#212120"
  escuro-superficie-3: "#2a2a28"
  escuro-elevada: "#252524"
  escuro-borda: "#2e2e2c"
  escuro-borda-forte: "#42423f"
  escuro-tinta: "#f2f2ee"
  escuro-tinta-2: "#b9b9b2"
  escuro-tinta-3: "#94948c"
  escuro-acento: "#ff7a1a"
  escuro-acento-hover: "#ff8d3d"
  escuro-acento-suave: "#3a2413"
  escuro-acento-tinta: "#ffa260"
  escuro-sobre-acento: "#141414"
  escuro-nota-likert: "#e9d48b"
  escuro-nota-voz: "#eeb8a3"
  escuro-nota-fullstory: "#a7d9b9"
  escuro-nota-tinta: "#1d1a11"
  graf-enfase: "#ec7000"
  graf-enfase-lavada: "rgba(236, 112, 0, 0.38)"
  graf-contexto: "#8f8f88"
  graf-area: "rgba(236, 112, 0, 0.10)"
  escuro-graf-enfase: "#e36b00"
  escuro-graf-enfase-lavada: "rgba(227, 107, 0, 0.42)"
  escuro-graf-contexto: "#7a7a73"
  escuro-graf-area: "rgba(227, 107, 0, 0.14)"
  marca-claude: "#D97757"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3.6vw, 2.875rem)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.025em"
    fontVariation: "'opsz' 64"
  headline:
    fontFamily: "Bricolage Grotesque, Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Bricolage Grotesque, Geist, Segoe UI, system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  body-lead:
    fontFamily: "Geist, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.01em"
  nota:
    fontFamily: "Geist, Segoe UI, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.32
rounded:
  nota: "3px"
  s: "8px"
  m: "10px"
  base: "12px"
  painel: "14px"
  l: "18px"
  folha: "22px"
  xl: "24px"
  aparelho: "44px"
  pill: "999px"
spacing:
  2xs: "6px"
  xs: "8px"
  sm: "10px"
  md: "14px"
  lg: "22px"
  xl: "36px"
  ponto: "22px"
  entre-frames: "72px"
components:
  button-primary:
    backgroundColor: "{colors.acento}"
    textColor: "{colors.sobre-acento}"
    typography: "{typography.body}"
    rounded: "{rounded.base}"
    padding: "9px 15px"
  button-primary-hover:
    backgroundColor: "{colors.acento-hover}"
  button-primary-active:
    backgroundColor: "{colors.acento-press}"
  button-secondary:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.base}"
    padding: "9px 15px"
  button-secondary-hover:
    backgroundColor: "{colors.superficie-2}"
  button-tertiary:
    textColor: "{colors.tinta}"
    rounded: "{rounded.base}"
    padding: "9px 10px"
  button-tertiary-hover:
    backgroundColor: "{colors.superficie-3}"
  send-button:
    backgroundColor: "{colors.acento}"
    textColor: "{colors.sobre-acento}"
    rounded: "{rounded.pill}"
    size: "38px"
  composer:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.xl}"
    padding: "12px 12px 10px"
  pill-selector:
    backgroundColor: "{colors.superficie-2}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pill}"
    height: "34px"
    padding: "0 12px"
  nav-item:
    textColor: "{colors.tinta-2}"
    rounded: "{rounded.m}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.acento-suave}"
    textColor: "{colors.tinta}"
  sticky-note-likert:
    backgroundColor: "{colors.nota-likert}"
    textColor: "{colors.nota-tinta}"
    typography: "{typography.nota}"
    rounded: "{rounded.nota}"
    padding: "13px 14px 12px"
  sticky-note-voz:
    backgroundColor: "{colors.nota-voz}"
    textColor: "{colors.nota-tinta}"
    rounded: "{rounded.nota}"
  sticky-note-fullstory:
    backgroundColor: "{colors.nota-fullstory}"
    textColor: "{colors.nota-tinta}"
    rounded: "{rounded.nota}"
  impact-high:
    backgroundColor: "{colors.critico}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.pill}"
    padding: "5px 8px 5px 7px"
  impact-medium:
    backgroundColor: "{colors.atencao}"
    textColor: "{colors.atencao-tinta}"
    rounded: "{rounded.pill}"
  impact-low:
    backgroundColor: "{colors.observar}"
    textColor: "{colors.observar-tinta}"
    rounded: "{rounded.pill}"
  floating-toolbar:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.painel}"
    padding: "4px"
  toolbar-tool:
    textColor: "{colors.tinta-2}"
    rounded: "{rounded.m}"
    height: "34px"
    padding: "0 9px"
  toolbar-tool-pressed:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.superficie}"
  agent-cursor-label:
    backgroundColor: "{colors.acento}"
    textColor: "{colors.sobre-acento}"
    padding: "4px 10px"
  device-frame:
    backgroundColor: "{colors.aparelho}"
    rounded: "{rounded.aparelho}"
    width: "390px"
    height: "780px"
    padding: "11px"
  sheet:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.folha}"
    width: "min(560px, calc(100vw - 20px))"
  toast:
    backgroundColor: "{colors.toast}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.pill}"
    padding: "10px 16px"
  floating-panel:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.l}"
    width: "300px"
  agent-logo:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.s}"
    size: "24px"
  agent-logo-large:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.base}"
    size: "40px"
  chart-bar-emphasis:
    backgroundColor: "{colors.graf-enfase}"
    height: "20px"
  chart-bar-context:
    backgroundColor: "{colors.graf-contexto}"
    height: "20px"
  chart-filter-select:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.base}"
    height: "38px"
    padding: "0 34px 0 12px"
  chart-tooltip:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.base}"
    padding: "8px 12px"
  insight-focus:
    backgroundColor: "{colors.acento-suave}"
    rounded: "{rounded.painel}"
    padding: "18px 14px"
  insert-guide-label:
    backgroundColor: "{colors.toast}"
    textColor: "{colors.superficie}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  insert-slot:
    textColor: "{colors.acento-tinta}"
    rounded: "{rounded.base}"
    padding: "8px"
---

# Design System: Design Studio

## Overview

**Creative North Star: "Quadro de oficina"**

O Design Studio é um quadro de workshop moderno, da família de FigJam e Miro, em que o cliente real está presente. A cena-base é um canvas pontilhado neutro e infinito; sobre ele ficam painéis lisos com sombra suave, telas dentro de molduras de aparelho com rótulo acima, e as Dores coladas como notas autoadesivas levemente giradas, uma cor por Fonte. O agente não é uma caixa de chat: é um colega no mesmo quadro, com cursor laranja e nome, que desliza até o elemento que está criando enquanto a resposta é escrita na lateral.

A densidade é de ferramenta de trabalho, não de vitrine: interface em Geist a 15px, cinzas quentes quase neutros, bordas finas e cantos generosos. A única cor de marca é o laranja da família Itaú, reservado para ação principal, seleção e o cursor do agente, sempre com tinta escura por cima. As cores pastel das notas não são decoração: elas codificam a Fonte da Evidência (Likert, Voz do Cliente, FullStory). Abre no tema claro (projetor e tela compartilhada); o tema escuro serve sessões longas no notebook e mantém a mesma gramática.

O mundo recusa a tela de chat genérica de IA (prompt num vazio creme, brilhos de "mágica") e recusa o dashboard; mesmo os Gráficos do Relatório falam em forma de ênfase, uma série laranja contra contexto cinza. Nenhum azul aparece na interface do estúdio, e nenhum logotipo, nome ou fonte de banco é usado: a marca na tela é "Design Studio". Os Protótipos exibidos dentro das molduras pertencem a uma camada de conteúdo separada que imita o design system do Itaú (IDS), com o azul-marinho e o laranja #FF6200 do banco e Lato no lugar das fontes proprietárias (ver Components, "Camada do Protótipo"). Ela termina na borda da tela do aparelho: nada dela sobe para o estúdio.

**Key Characteristics:**
- Canvas pontilhado infinito como chão de todas as vistas de trabalho e do Início.
- Um único acento laranja, raro, com tinta escura por cima; nenhum azul.
- Notas autoadesivas por Fonte (manteiga, pêssego, menta), giradas entre -1.8° e 1.8°, que se endireitam ao passar o mouse.
- Telas em molduras de aparelho com rótulos no estilo Figma, contra-escalados pelo zoom.
- O agente como presença física: cursor nomeado, conectores tracejados ligando Dor e tela.
- Painéis lisos, sombra suave e difusa, sem brilho, sem gradiente decorativo.
- Gráficos em forma de ênfase: uma série laranja contra cinza quente, um só eixo e sempre uma tabela gêmea.
- WCAG 2.2 AA com folga para projeção, interface só em pt-BR, dados sintéticos sempre rotulados "Dados de exemplo".

## Colors

Cinzas quentes quase neutros carregam tudo; o laranja aparece só onde há ação ou seleção, e três pastéis codificam a origem da Evidência.

### Primary
- **Laranja de Oficina** (acento): botão principal, botão de enviar, item selecionado, rótulo e seta do cursor do agente, linha e ponto da mira e contorno tracejado da vaga do Inserir, ponto da Proposta ativa, contorno de nota selecionada, `::selection` e `caret-color`. Escurece no hover (acento-hover) e no clique (acento-press). No escuro sobe de luminância (escuro-acento) para manter o contraste com a tinta escura.
- **Laranja Lavado** (acento-suave): fundo do item de navegação atual, da opção marcada nos menus, das dicas "Próxima" e das zonas de soltar arquivo.
- **Laranja Tinta** (acento-tinta): texto e ícone em laranja sobre superfícies claras (ícone do item atual, "em foco" no rótulo do frame, marcas de confirmação). É a única forma de laranja usada como texto.
- **Tinta sobre Acento** (sobre-acento): o texto de qualquer elemento laranja. Nunca branco.

### Secondary
- **Manteiga Likert** (nota-likert), **Pêssego Voz** (nota-voz), **Menta FullStory** (nota-fullstory): fundo das notas autoadesivas e dos chips de Fonte. Cada cor pertence a uma Fonte e a mais nenhuma coisa. Texto sobre elas sempre em **Tinta de Nota** (nota-tinta), nos dois temas.

### Tertiary (estado)
- **Vermelho Crítico** (critico, critico-suave, critico-tinta): impacto Alto (pílula cheia com texto branco), microfone gravando, tendência de alta de uma Dor, tela "quente" no mapa de onde dói.
- **Amarelo Atenção** (atencao, atencao-tinta): impacto Médio.
- **Cinza Observar** (observar, observar-tinta): impacto Baixo e pílulas neutras.
- **Verde Ok** (ok, ok-suave, ok-tinta): passo concluído, achado resolvido, tendência de queda, comentário resolvido.

### Neutral
- **Quadro** (quadro) com **Ponto** (ponto): o canvas e o pontilhado de 22px. O ponto é desenhado em radial-gradient de 1.15px.
- **Superfície / Superfície 2 / Superfície 3** (superficie, superficie-2, superficie-3): painéis e lateral; fundos recuados (rodapés de folha, pills); hover e itens ativos discretos. A superfície elevada de menus e barras flutuantes é branca no claro e escuro-elevada no escuro.
- **Borda / Borda Forte** (borda, borda-forte): divisórias de 1px; contorno de botão secundário, campos e bordas tracejadas de vazio.
- **Tinta / Tinta 2 / Tinta 3** (tinta, tinta-2, tinta-3): texto principal; texto secundário e ícones; metadados, rótulos de frame, conectores. A tinta-3 foi ajustada para ≥4.5:1 inclusive contra a cor do ponto do canvas.
- **Toast** (toast): avisos, dica do canvas e pílula da mira do Inserir, invertidos (tinta escura no claro, clara no escuro).

### Dados (Gráficos do Relatório)
- **Ênfase** (graf-enfase): a série ou categoria em foco, uma por gráfico. No escuro baixa para escuro-graf-enfase, menos luminoso que o acento escuro, para não vibrar contra o fundo.
- **Ênfase Lavada** (graf-enfase-lavada): o resto de uma barra partida, quando um filtro de Dor recorta parte da categoria em foco.
- **Contexto** (graf-contexto): todas as outras séries e categorias, cinza quente da família dos neutros.
- **Área** (graf-area): lavagem de 10% (14% no escuro) sob a linha em foco.

A paleta passou no script validate_palette: no claro, ênfase contra contexto sobre branco dá ΔE 12.3 sob daltonismo e 17.7 normal, contraste ≥3:1; no escuro, ΔE 11.2 e 18.8 sobre escuro-superficie. A reprovação de croma mínimo do cinza é proposital: o contexto deve recuar.

### Marcas de terceiros
- **Claude** (marca-claude): a cor da logo oficial do Claude, só dentro do ladrilho de logo. A logo do Devin usa currentColor, em tinta. São marcas de identificação, não acento: não contam para a regra do Laranja Raro e não colorem mais nada.

### Named Rules
**The Tinta Escura no Laranja Rule.** Todo elemento do estúdio com fundo laranja leva tinta escura (sobre-acento). Branco sobre laranja não passa AA em texto comum e não existe na interface do estúdio. A única exceção do produto é o botão primário do IDS dentro das molduras (ver Camada do Protótipo), e ela não sai de lá.

**The Laranja Raro Rule.** O laranja marca só três coisas: a ação principal, o que está selecionado e o agente. Se um laranja não for nenhuma das três, ele sai.

**The Nenhum Azul Rule.** Não há azul em lugar nenhum da interface do estúdio, nem em links, foco, informação ou gráficos. Foco é contorno em tinta; links herdam a cor do texto. O azul-marinho do IDS existe só dentro da tela do aparelho, como conteúdo do Protótipo.

**The Uma Cor por Fonte Rule.** Manteiga é Likert, pêssego é Voz do Cliente, menta é FullStory. Essas cores não servem para status, categoria ou decoração.

**The Uma Série Laranja Rule.** Um gráfico tem uma série em ênfase e todo o resto em cinza de contexto. Categoria nunca vira arco-íris: trocar a ênfase é tocar em outra categoria, não pintar mais uma.

## Typography

**Display Font:** Bricolage Grotesque (com Geist, Segoe UI, system-ui)
**Body Font:** Geist (com Segoe UI, system-ui, -apple-system)

**Character:** Geist dá à interface a neutralidade precisa de ferramenta; Bricolage Grotesque, com eixo óptico e peso 700, entra só onde o quadro fala com a pessoa: saudação, títulos de página e de conversa, rótulos de linha no canvas e slides. Ambas servidas localmente (OFL 1.1), sem CDN.

### Hierarchy
- **Display** (Bricolage 700, clamp(2rem, 3.6vw, 2.875rem), 1.06, opsz 64): saudação do Início. No modo Apresentar, os títulos de slide sobem para clamp(2.125rem, 3.6vw, 3.375rem).
- **Headline** (Bricolage 700, 2.125rem, 1.08): título de página (Protótipos, Dores, Relatórios). 1.75rem no celular.
- **Title** (Bricolage 700, 1.625rem, 1.15): título de folha lateral; o cabeçalho da conversa usa 1.1875rem, e os rótulos de linha no canvas usam 16px divididos pelo zoom.
- **Body** (Geist 400, 15px, 1.5, numerais tabulares): toda a interface. Mensagens do agente em 0.9375rem/1.6; narrativa de relatório em 1.0625rem/1.65 com no máximo 66ch.
- **Body Lead** (Geist 400, 1.0625rem): subtítulo da saudação e texto do campo do chat no Início.
- **Label** (Geist 600, 0.75rem, +0.01em): rótulos de seção da lateral, títulos de menu, pílulas. Nunca em caixa-alta.
- **Nota** (Geist 600, 0.9375rem, 1.32, até 3 linhas): título da nota autoadesiva; 24px nas notas grandes coladas no canvas.

### Named Rules
**The Bricolage Só Fala Rule.** Bricolage Grotesque aparece em saudações, títulos e rótulos de linha do canvas. Nunca em botões, campos, listas ou corpo.

**The Rótulo Sem Grito Rule.** Rótulos são Geist 600 em caixa normal. Não há rótulos em caixa-alta espaçada nem sobrelinhas acima de títulos.

## Layout

A estrutura é uma grade de duas colunas: lateral de 264px (recolhível para 68px, transição de 0.22s) e área principal. A vista de trabalho divide a área principal em conversa de 340 a 400px à esquerda e canvas à direita. Páginas de lista ficam em contêiner de no máximo 1200px com respiro de 36px; o Início centraliza saudação e campo do chat em 780px e as notas em 1040px.

O canvas é um mundo absoluto transformado por translate e scale. Frames de uma mesma linha ficam a 72px entre si; notas de Dor ficam numa coluna de 250px ao lado do frame que resolvem, a 26px uma da outra. Barras flutuantes ocupam o topo (propostas e ações, a 14px das bordas) e a base central (ferramentas, a 18px do fundo).

Ritmo de espaçamento observado: 6, 8, 10, 14, 22 e 36px; o pontilhado tem passo de 22px, o mesmo intervalo das grades de notas.

**Gráficos.** O filtro fica numa linha acima de tudo (período e Dor), seguido de um resumo de no máximo 36em; abaixo, barras e linha lado a lado (0.95fr e 1.05fr, 18px entre si) e os insights num painel inteiro, cada um em duas colunas (lado de 0.32fr com mínimo de 180px, corpo de no máximo 34em).

**Responsivo.** Até 1400px os rótulos das ferramentas do topo somem; até 1180px a conversa encolhe para 300 a 340px, o quadro de Dores vira uma coluna, os gráficos se empilham e os rótulos de todas as ferramentas viram só ícone. Até 820px os insights e as linhas de barra passam a uma coluna, a lateral vira barra horizontal de ícones no topo, a vista de trabalho mostra conversa ou canvas com um alternador, o selo "Dados de exemplo" passa para o cabeçalho e zoom/mover saem da barra de ferramentas.

### Named Rules
**The Rótulo Contra-escalado Rule.** Rótulos de frame, de linha e de coluna de notas no canvas dividem tamanho e espaçamento por `--z` (zoom, com piso em 0.42), para manter tamanho de leitura constante em qualquer zoom. Conectores usam traço que não escala.

## Elevation & Depth

Híbrido: superfícies lisas com sombra suave e difusa em três degraus, mais uma sombra própria para notas que simula papel colado. Sem brilho, sem sombra colorida, sem sombra deslocada dura. No tema escuro as sombras ficam mais densas e a moldura de aparelho ganha um fio de 1px.

### Shadow Vocabulary
- **Repouso** (`box-shadow: 0 1px 2px rgba(24,24,18,0.06), 0 1px 1px rgba(24,24,18,0.04)`): botão secundário, painéis, cartões de frame, segmento ativo.
- **Flutuante** (`box-shadow: 0 8px 24px rgba(24,24,18,0.08), 0 2px 6px rgba(24,24,18,0.05)`): campo do chat, barras flutuantes do canvas, hover de cartão, dica do gráfico.
- **Sobreposto** (`box-shadow: 0 28px 64px rgba(24,24,18,0.16), 0 8px 20px rgba(24,24,18,0.08)`): menus, folhas laterais, painéis de edição, balões de comentário, toasts.
- **Papel Colado** (`box-shadow: 0 1px 1px rgba(20,20,18,0.08), 0 10px 18px -8px rgba(20,20,18,0.26)`): notas autoadesivas; no hover aumenta e a nota sobe 3px.
- **Aparelho** (`box-shadow: 0 30px 60px rgba(20,20,15,0.18), 0 6px 16px rgba(20,20,15,0.1)`): molduras de aparelho e janelas no canvas.

### Named Rules
**The Sombra Diz Camada Rule.** O degrau de sombra indica a camada (repouso, flutuando sobre o canvas, sobreposto a tudo), não a importância. Elementos da mesma camada usam a mesma sombra.

## Shapes

Cantos generosos e consistentes: 12px em botões, campos e cartões pequenos; 14px em painéis de canvas e cartões de frame; 18px em painéis de página; 22px em folhas laterais; 24px no campo do chat do Início. Pills de 999px para seletores, chips, pílulas de impacto, toasts e o rótulo do cursor do agente (que tem o canto inferior esquerdo em 4px, apontando para a seta). A nota autoadesiva é a exceção deliberada: 3px, quase reta, como papel. Molduras de aparelho em 44px com tela em 34px e entalhe superior.

Bordas são de 1px em borda ou borda-forte. Linhas tracejadas têm significado: estado vazio e "novo" (1.5px borda-forte), zona de soltar, seleção citada, vaga e prévia do Inserir (laranja, as duas últimas a 2px contra-escalados), conectores entre Dor e tela (traço 14/10). Nos gráficos, a barra tem só a ponta do dado arredondada (4px) e começa reta no eixo.

## Components

### Buttons
Diretos e táteis: descem 1px no clique.
- **Shape:** cantos de 12px; variante pequena de 10px com padding 6px 11px.
- **Primary:** fundo laranja, tinta escura, Geist 600 0.9375rem, padding 9px 15px. Hover e clique escurecem o laranja.
- **Secondary:** superfície com borda-forte e sombra de repouso; hover em superfície 2.
- **Tertiary:** transparente, hover em superfície 3.
- **Focus:** contorno de 2px em tinta, afastado 2px, em todo elemento focável.
- **Disabled:** opacidade 0.5.
- **Enviar:** círculo laranja de 38px com seta, no canto do campo do chat; desabilitado vira superfície 3.

### Chips e Pílulas
- **Seletores (pill):** 34px de altura, superfície 2, borda fina, ícone em tinta 2; usados para agente, modelo e Protótipo no campo do chat.
- **Chip de Dor:** pill branco com o chip circular da Fonte à esquerda e texto truncado; botão de remover redondo de 18px.
- **Pílulas de impacto:** Alto em vermelho cheio com texto branco, Médio em amarelo, Baixo em cinza; Geist 600 0.75rem.
- **Selo "Dados de exemplo":** pill com ponto laranja de 7px; aparece no cabeçalho quando a lateral está recolhida ou no celular.

### Cards / Containers
- **Corner Style:** 14px (cartões de frame, revisão, evidência), 18px (painéis de página), 16px (menus e balões).
- **Background:** superfície; rodapés e cabeçalhos recuados em superfície 2.
- **Shadow Strategy:** repouso em painéis, flutuante no hover (ver Elevation & Depth).
- **Border:** 1px borda; linhas internas separadas por borda no topo.
- **Internal Padding:** 10 a 14px em listas, 14 a 16px em evidências, 22px em folhas.

### Inputs / Fields
- **Campo do chat:** cartão branco de 24px de canto com sombra flutuante, textarea sem borda em 1.0625rem, linha de contexto (anexos, Dores citadas) acima e barra de ferramentas abaixo (+, seletores, microfone, enviar). Na vista de trabalho fica compacto: 18px de canto e sombra de repouso.
- **Campos de formulário:** borda-forte, 12px de canto, padding 9px 12px; foco troca a borda para laranja.
- **Gravação:** microfone vira vermelho cheio; a onda é desenhada em barras laranja de 3px.

### Navigation
- **Lateral:** superfície com divisória à direita; marca em Bricolage 700. Itens em Geist 500 tinta 2, 10px de canto, hover em superfície 2; item atual em laranja lavado com ícone em laranja tinta e peso 600. Seção Recentes com ícone em quadrado de 28px. Rodapé com alternador de tema (pill segmentado) e conta.
- **Recolhida:** 68px, só ícones, centralizada.
- **Celular:** barra horizontal de ícones no topo.
- **Abas de Proposta:** pill flutuante no topo do canvas; aba selecionada em superfície 3 com peso 600, Proposta ativa com ponto laranja, descartada riscada.

### Nota autoadesiva (assinatura)
Papel quase reto (3px), cor da Fonte, tinta de nota, sombra de papel colado e giro entre -1.8° e 1.8°. No hover se endireita e sobe 3px; selecionada ganha contorno laranja de 2.5px e um selo de confirmação laranja no canto. Rodapé com volume, pílula de impacto translúcida e tendência. No canvas aparece em tamanho grande (título 24px) ao lado do frame que resolve, ligada a ele por conector tracejado.

### Moldura de aparelho e frame (assinatura)
Aparelho preto de 390×780px, 44px de canto, entalhe, sombra de aparelho. Rótulo do frame acima em Geist 500 tinta 3 com o nome da tela em 600; "em foco" em laranja tinta. Frames entram com escala e opacidade (0.42s); em criação mostram esqueleto; o frame que o agente acabou de mudar pulsa uma vez: um anel laranja de 4px (contra-escalado) se afasta 26px e some em 0.9s; com movimento reduzido, fica um anel fixo. Janelas de desktop usam 1040×680px com barra cinza.

### Cursor do agente (assinatura)
Seta com sombra leve e rótulo pill laranja com o nome do agente em tinta escura, 600 15px. Desliza pelo canvas em 0.62s ease-out exponencial até o elemento em edição. Na conversa, um cursor de escrita laranja de 7px marca o texto sendo escrito.

### Barras flutuantes do canvas
Pill de 14px em superfície elevada com sombra flutuante e padding de 4px. Ferramentas de 34px em tinta 2 (Mover, Comentar, Editar, Inserir, Ajustar); ferramenta ativa invertida (fundo tinta, texto superfície); a ação "Testar" é o único item laranja.

### Painel flutuante do modo ao vivo
Painel de 300px em superfície elevada, 18px de canto, sombra sobreposta, entra em 0.18s. Cabeçalho com ícone, alvo ("Depois do bloco …") e tela em tinta 3; corpo com 14px entre grupos; rodapé com botões pequenos que dividem a largura. Grupos de escolha curta são segmentados em superfície 3 (opção marcada em superfície com sombra de repouso); sugestões são uma grade de duas colunas de botões de 10px com borda, marcada invertida em tinta; campos de texto com borda de 1px e 10px de canto, foco em laranja. Serve ao Ajustar, ao Editar e ao Inserir.

### Inserir (modo ao vivo)
Ferramenta irmã do Editar: escolhe um ponto entre blocos da tela e gera um elemento novo com Variantes.
- **Mira:** linha laranja de 2px na largura do bloco, ponto laranja de 14px com halo em superfície na ponta esquerda e pílula invertida (toast, Geist 500 0.75rem) dizendo "Inserir antes/depois do bloco …". Cursor `copy` sobre a tela.
- **Painel:** Onde (Antes/Depois), pedido em texto livre obrigatório, sugestões por tipo (aviso, ajuda, botão, campo, etapas, resumo), Tamanho (P/M/G) e Quantas Variantes (1 a 4).
- **Vaga:** espaço reservado na tela com contorno laranja tracejado, fundo laranja a 6%, texto em laranja tinta (sempre o valor do tema claro, porque a tela é clara nos dois temas), 12px de canto; altura mínima de 56, 96 ou 160px conforme P/M/G. Enquanto gera, um brilho varre a vaga em 1.1s e o cursor do agente vai até ela.
- **Prévia:** a Variante em teste ganha contorno laranja tracejado afastado 4px (contra-escalado), até ser aceita ou descartada.
O elemento inserido é conteúdo do Protótipo: veste os tokens da camada do Protótipo, não os do estúdio.

### Logos dos agentes
As marcas oficiais de Claude e Devin num ladrilho neutro de 24px (superfície, borda de 1px, 8px de canto, svg de 15px); 20px nos insights; 40px com svg de 24px nas Configurações. Aparecem no cabeçalho da mensagem, no seletor de agente do campo do chat, nas abas do menu de agente, na autoria do insight e nas Configurações. Identificam o agente; nunca são decoração nem trocam de cor.

### Gráficos do Relatório
Vista irmã da Leitura, para quem precisa ver o volume antes de ler a narrativa.
- **Filtro:** segmentado de período (90, 60, 30 dias) e um seletor de Dor de 38px, 12px de canto, borda forte, rótulo "Dor" em tinta 3; "Limpar filtro" terciário aparece só quando há recorte.
- **Barras por categoria:** rótulo à esquerda (36%, mínimo 120px), barra de 20px com no máximo 74% do trilho para que o rótulo de valor nunca seja cortado, valor e participação em tinta 2 tabular. A categoria em foco usa ênfase e peso 600; as outras, contexto. Cada linha é um botão: tocar troca a ênfase.
- **Linha semanal:** traço de 2px, pontos com halo de superfície, área de ênfase sob a série em foco, grade horizontal de 1px em borda, uma linha de base em borda forte, rótulo final com o último valor. Um só eixo de valores; nunca eixo duplo.
- **Leitura ponto a ponto:** mira vertical em tinta 3 e dica flutuante (12px de canto, sombra flutuante) que segue o ponteiro; com foco no gráfico, as setas, Home e End percorrem as semanas.
- **Tabela gêmea:** todo gráfico tem "Ver tabela", que troca o desenho por uma tabela de 0.875rem com números à direita e tabulares.
- **Insights por categoria:** artigos separados por borda no topo; o da categoria em foco ganha laranja lavado e 14px de canto. Lado com título e números grandes (Geist 700 1.0625rem); corpo com autoria do agente e texto de 0.9375rem/1.55 em no máximo 34em.
- **Títulos:** gráfico e painel de insights com título h2 em Geist 600 1rem e subtítulo em tinta 3; cada insight com h3.

### Camada do Protótipo (conteúdo, não estúdio)
> No app do POC, o conteúdo dos frames é livre (perfil `livre`, ADR 0006). Esta camada descreve o protótipo de validação, vira o perfil de exemplo dos testes e é o alvo do porte, onde o IDS de verdade vem do iu-memorable.

O que roda dentro das molduras é um app bancário fictício que representa o app do cliente, vestido o mais perto possível do design system do Itaú (IDS, tema varejo). Os tokens foram lidos das variáveis `--ids_*` de itau.com.br e cada um carrega o nome IDS em comentário no proto.css; tudo é escopado em `.pt`. Dentro do banco, o iu-memorable troca esta camada no porte.
- **Cor:** ação primária laranja #FF6200 (hover #E55800), ação secundária e links em azul-marinho #000066, texto #000000 e #4C4C4C, fundos #FFFFFF, #F1F2F4 e #E3E5E8, bordas #CFD1D3 e #5D636F; sucesso #0B5B38, erro #CC0000, alerta #FFCC00 com texto preto. Ícones de marca em #E55800 (3,7:1 sobre branco). Foco é contorno de 2px em azul-marinho.
- **Tipo:** pilha "Itau Text"/"Itau Display", depois Lato, servida localmente em 400, 700 e 900. As fontes proprietárias só valem se já estiverem instaladas; nenhum arquivo delas é copiado. Corpo 16px/24px; título de barra 16px/24px 700; valores grandes 24px/32px e 32px/40px 700.
- **Botões:** primário laranja com rótulo branco 700 20px/26px, altura mínima de 50px, 12px de canto, aperta para 98,5% no clique; desabilitado em #CFD1D3 com texto #999999. Fantasma em branco com borda e texto azul-marinho.
- **Cartões:** borda de 1px e 16px de canto, sem sombra. Etiquetas de status com 4px de canto; seletores de período e de mês com 8px, o selecionado em azul-marinho cheio. O cartão de meta também é azul-marinho com texto branco.
- **Campos:** só borda inferior em #5D636F; no foco vira 2px laranja.
- **Elementos inseridos** (aviso informativo, de alerta e de erro, link, ajuda, detalhe recolhível, campo validado, etapas numeradas, resumo, ações) seguem os mesmos tokens.
- **Contraste:** branco sobre #FF6200 dá 3,0:1. Passa no AA só porque o rótulo é texto grande (20px em negrito), sem folga para projeção; fica por fidelidade ao IDS e vale só aqui. O botão desabilitado do IDS fica abaixo de 3:1, isento pela WCAG por ser controle desabilitado.

Nada dessa camada vale como token, cor ou componente do estúdio, e nada do estúdio entra nela além das marcas do modo ao vivo (contorno de seleção, mira, vaga, prévia), que são do estúdio e ficam por cima. A distinção é proposital: o PM nunca deve confundir a ferramenta com o produto.

**The Moldura Sem Fresta Rule.** Barra de status e cabeçalho da tela ficam presos no topo e não encolhem (`flex: none`); a barra de status leva por baixo uma sombra de 3px na cor da superfície (`box-shadow: 0 3px 0 var(--pt-surface)`) que fecha a emenda de subpixel quando o canvas está em zoom fracionário. Toda faixa presa dentro de uma moldura segue o mesmo cuidado: o conteúdo rolado nunca vaza por uma linha.

## Do's and Don'ts

### Do:
- **Do** colocar tinta escura (sobre-acento) em todo fundo laranja do estúdio, nos dois temas.
- **Do** reservar o laranja para ação principal, seleção e o agente; tudo o mais é tinta e cinza quente.
- **Do** usar o canvas pontilhado (ponto de 1.15px em passo de 22px) como chão das vistas de trabalho e do Início.
- **Do** colar cada Dor como nota da cor da sua Fonte, girada entre -1.8° e 1.8°, ao lado da tela que ela explica, com conector tracejado.
- **Do** dividir por `--z` (piso 0.42) todo rótulo e espaçamento de texto que vive dentro do mundo do canvas.
- **Do** manter transições entre 0.15s e 0.24s em `cubic-bezier(0.16, 1, 0.3, 1)`; o cursor do agente desliza em 0.62s; tudo cai a 0.001ms sob `prefers-reduced-motion`.
- **Do** rotular todo dado sintético como "Dados de exemplo" e manter contraste AA com folga para projeção (tinta 3 ≥4.5:1 inclusive sobre o ponto do canvas).
- **Do** escrever toda a interface em pt-BR, com os nomes que PM e UX reconhecem.
- **Do** desenhar gráficos em forma de ênfase (graf-enfase contra graf-contexto), com um só eixo, barras até 74% do trilho e uma tabela gêmea para cada gráfico.
- **Do** identificar cada agente pela logo oficial no ladrilho neutro (24px; 40px nas Configurações).
- **Do** vestir as telas dentro das molduras com os tokens do IDS escopados em `.pt`, inclusive o que for inserido pelo modo ao vivo.

### Don't:
- **Don't** usar azul em qualquer lugar da interface do estúdio; o azul-marinho do IDS fica dentro das molduras.
- **Don't** usar texto branco sobre laranja na interface do estúdio; a única exceção é o botão primário do IDS dentro das molduras, com rótulo de 20px em negrito.
- **Don't** usar logotipo, nome ou fonte de banco; a marca na tela é "Design Studio".
- **Don't** reaproveitar os pastéis das notas para status, categoria ou decoração.
- **Don't** misturar a camada do Protótipo (IDS: #FF6200, azul-marinho, Lato) com tokens ou componentes do estúdio.
- **Don't** pintar categorias de um gráfico com cores diferentes; uma série laranja, o resto cinza.
- **Don't** usar Bricolage Grotesque em botões, campos, listas ou corpo de texto.
- **Don't** pôr rótulos em caixa-alta espaçada ou sobrelinhas acima de títulos.
- **Don't** usar brilhos, gradientes de "mágica" ou animação decorativa em loop; só indicadores de carregamento giram ou pulsam.
- **Don't** publicar o protótipo como link público: ele fica em arquivos locais.
