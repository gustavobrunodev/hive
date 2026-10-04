/* Os tokens do Design Studio. Esta é a fonte: build.mjs gera src/tokens.css
   e o script de sincronização gera o tokens.json da Claude Design a partir daqui. */

export type Tema = "claro" | "escuro"

export interface TokenDeCor {
  nome: string
  claro: string
  /** Ausente quando o valor é o mesmo nos dois temas. */
  escuro?: string
  uso: string
}

export interface TokenDeSombra {
  nome: string
  claro: string
  escuro: string
  uso: string
}

export interface TokenSimples {
  nome: string
  valor: string
  uso: string
}

export const cores: readonly TokenDeCor[] = [
  { nome: "quadro", claro: "#f6f6f4", escuro: "#131312",
    uso: "Chão do canvas e do Início, sob o pontilhado. Nunca leva texto direto sem painel, exceto rótulos de frame em tinta-3." },
  { nome: "ponto", claro: "#dcdcd6", escuro: "#2b2b29",
    uso: "Pontos do canvas: radial-gradient de 1.15px em passo de 22px (passo-ponto), com a parada externa na cor de quadro." },
  { nome: "superficie", claro: "#ffffff", escuro: "#1b1b1a",
    uso: "Painéis, lateral, cartões, campos e botão secundário." },
  { nome: "superficie-2", claro: "#f7f7f5", escuro: "#212120",
    uso: "Fundos recuados: rodapé de folha, seletores pill, hover de item de lista." },
  { nome: "superficie-3", claro: "#efefec", escuro: "#2a2a28",
    uso: "Hover de botão terciário, aba de Proposta selecionada, segmento de escolha curta." },
  { nome: "elevada", claro: "#ffffff", escuro: "#252524",
    uso: "Menus, barras flutuantes do canvas, painel flutuante do modo ao vivo e dica do gráfico." },
  { nome: "borda", claro: "#e6e6e1", escuro: "#2e2e2c",
    uso: "Divisórias de 1px entre áreas e linhas de lista; grade horizontal dos gráficos." },
  { nome: "borda-forte", claro: "#cfcfc8", escuro: "#42423f",
    uso: "Contorno de botão secundário e de campos; bordas tracejadas de vazio; linha de base dos gráficos. Contra superficie dá 1,57:1 no claro e 1,71:1 no escuro, abaixo do 3:1 de borda de controle: o botão secundário se apoia também em sombra e rótulo; não delimite um campo só com ela." },
  { nome: "tinta", claro: "#1a1a1a", escuro: "#f2f2ee",
    uso: "Texto principal em superficie, superficie-2, superficie-3, elevada e quadro. Também o contorno de foco (2px, afastado 2px) e o fundo da ferramenta ativa." },
  { nome: "tinta-2", claro: "#48483f", escuro: "#b9b9b2",
    uso: "Texto secundário e ícones em superficie, superficie-2, elevada e quadro." },
  { nome: "tinta-3", claro: "#5e5e57", escuro: "#94948c",
    uso: "Metadados, rótulos de frame, horários e conectores; ≥4.5:1 em superficie, quadro e inclusive sobre ponto." },
  { nome: "acento", claro: "#ec7000", escuro: "#ff7a1a",
    uso: "O único laranja de marca: ação principal, botão de enviar, seleção, cursor do agente, mira e vaga do Inserir. Sempre com sobre-acento por cima, nunca texto branco." },
  { nome: "acento-hover", claro: "#d96600", escuro: "#ff8d3d",
    uso: "Hover de todo elemento com fundo acento." },
  { nome: "acento-press", claro: "#c45c00", escuro: "#ff9f5c",
    uso: "Clique de todo elemento com fundo acento. Com sobre-acento dá 4,04:1 no claro, abaixo de 4,5:1 para texto comum; dura só o clique." },
  { nome: "acento-suave", claro: "#fdeee2", escuro: "#3a2413",
    uso: "Fundo do item de navegação atual, opção marcada, dica \"Próxima\", zona de soltar arquivo e insight em foco." },
  { nome: "acento-tinta", claro: "#a34c00", escuro: "#ffa260",
    uso: "A única forma de laranja usada como texto ou ícone: item atual, \"em foco\" no rótulo do frame, marcas de confirmação. Em superficie e acento-suave." },
  { nome: "sobre-acento", claro: "#1a1a1a", escuro: "#141414",
    uso: "Texto e ícone sobre acento, acento-hover e acento-press, nos dois temas." },
  { nome: "nota-likert", claro: "#ffe7a0", escuro: "#e9d48b",
    uso: "Nota autoadesiva e chip de Fonte da Fonte Likert. Só isso." },
  { nome: "nota-voz", claro: "#ffd2c0", escuro: "#eeb8a3",
    uso: "Nota autoadesiva e chip de Fonte da Fonte Voz do Cliente. Só isso." },
  { nome: "nota-fullstory", claro: "#cdeed8", escuro: "#a7d9b9",
    uso: "Nota autoadesiva e chip de Fonte da Fonte FullStory. Só isso." },
  { nome: "nota-tinta", claro: "#29261d", escuro: "#1d1a11",
    uso: "Texto sobre nota-likert, nota-voz e nota-fullstory, nos dois temas." },
  { nome: "critico", claro: "#c4291c", escuro: "#d6392b",
    uso: "Impacto Alto (pílula cheia com texto branco), microfone gravando, tendência de alta de uma Dor." },
  { nome: "critico-suave", claro: "#fdebe8", escuro: "#3c1814",
    uso: "Fundo de aviso de erro e de tela quente no mapa de onde dói." },
  { nome: "critico-tinta", claro: "#9c1f14", escuro: "#ffa69b",
    uso: "Texto de erro em critico-suave e superficie." },
  { nome: "atencao", claro: "#ffe08a", escuro: "#4a3b10",
    uso: "Fundo da pílula de impacto Médio." },
  { nome: "atencao-tinta", claro: "#614300", escuro: "#ffd66b",
    uso: "Texto da pílula de impacto Médio, em atencao." },
  { nome: "observar", claro: "#ececea", escuro: "#2c2c2a",
    uso: "Fundo da pílula de impacto Baixo e de pílulas neutras." },
  { nome: "observar-tinta", claro: "#4c4c47", escuro: "#cfcfc8",
    uso: "Texto em observar." },
  { nome: "ok", claro: "#1f8a5b", escuro: "#3cbf82",
    uso: "Ícone de passo concluído, achado resolvido e tendência de queda." },
  { nome: "ok-suave", claro: "#e2f3e9", escuro: "#12301f",
    uso: "Fundo de selo \"Resolvido\" e de passo concluído." },
  { nome: "ok-tinta", claro: "#12633f", escuro: "#7fdcaa",
    uso: "Texto em ok-suave e superficie." },
  { nome: "toast", claro: "#1a1a1a", escuro: "#f2f2ee",
    uso: "Fundo invertido de toasts, dica do canvas e pílula da mira do Inserir." },
  { nome: "sobre-toast", claro: "#ffffff", escuro: "#141414",
    uso: "Texto sobre toast." },
  { nome: "graf-enfase", claro: "#ec7000", escuro: "#e36b00",
    uso: "A série ou categoria em foco de um gráfico; uma por gráfico. No escuro baixa para não vibrar contra o fundo." },
  { nome: "graf-enfase-lavada", claro: "rgba(236, 112, 0, 0.38)", escuro: "rgba(227, 107, 0, 0.42)",
    uso: "O resto de uma barra partida quando um filtro de Dor recorta a categoria em foco." },
  { nome: "graf-contexto", claro: "#8f8f88", escuro: "#7a7a73",
    uso: "Todas as outras séries e categorias de um gráfico: o cinza que recua." },
  { nome: "graf-area", claro: "rgba(236, 112, 0, 0.10)", escuro: "rgba(227, 107, 0, 0.14)",
    uso: "Lavagem sob a linha em foco (10% no claro, 14% no escuro)." },
  { nome: "aparelho", claro: "#0f0f0f", escuro: "#050505",
    uso: "Corpo da moldura de aparelho (390×780, canto raio-aparelho) e a ilha da tela. No escuro ganha fio de 1px em borda." },
  { nome: "marca-claude", claro: "#d97757",
    uso: "Cor da logo oficial do Claude, só dentro do ladrilho de logo. Não é acento e não colore mais nada." },
]

export const sombras: readonly TokenDeSombra[] = [
  { nome: "sombra-1",
    claro: "0 1px 2px rgba(24, 24, 18, 0.06), 0 1px 1px rgba(24, 24, 18, 0.04)",
    escuro: "0 1px 2px rgba(0, 0, 0, 0.4)",
    uso: "Repouso: botão secundário, painéis, cartões de frame, segmento ativo." },
  { nome: "sombra-2",
    claro: "0 8px 24px rgba(24, 24, 18, 0.08), 0 2px 6px rgba(24, 24, 18, 0.05)",
    escuro: "0 10px 28px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)",
    uso: "Flutuante: campo do chat, barras flutuantes do canvas, hover de cartão, dica do gráfico." },
  { nome: "sombra-3",
    claro: "0 28px 64px rgba(24, 24, 18, 0.16), 0 8px 20px rgba(24, 24, 18, 0.08)",
    escuro: "0 30px 70px rgba(0, 0, 0, 0.6), 0 8px 20px rgba(0, 0, 0, 0.35)",
    uso: "Sobreposto: menus, folhas laterais, painéis do modo ao vivo, balões de comentário, toasts." },
  { nome: "sombra-nota",
    claro: "0 1px 1px rgba(20, 20, 18, 0.08), 0 10px 18px -8px rgba(20, 20, 18, 0.26)",
    escuro: "0 1px 1px rgba(0, 0, 0, 0.3), 0 12px 20px -8px rgba(0, 0, 0, 0.6)",
    uso: "Papel colado: notas autoadesivas; no hover cresce e a nota sobe 3px." },
  { nome: "sombra-aparelho",
    claro: "0 30px 60px rgba(20, 20, 15, 0.18), 0 6px 16px rgba(20, 20, 15, 0.1)",
    escuro: "0 30px 70px rgba(0, 0, 0, 0.6), 0 0 0 1px #2e2e2c",
    uso: "Molduras de aparelho e janelas de desktop no canvas." },
]

export const raios: readonly TokenSimples[] = [
  { nome: "raio-nota", valor: "3px", uso: "Nota autoadesiva: quase reta, como papel. A exceção deliberada aos cantos generosos." },
  { nome: "raio-s", valor: "8px", uso: "Ladrilho de logo do agente, chips pequenos, campos internos de painel." },
  { nome: "raio-m", valor: "10px", uso: "Botão pequeno, item de navegação, ferramenta da barra flutuante, campos do painel flutuante." },
  { nome: "raio", valor: "12px", uso: "Botões, campos de formulário, seletor de Dor, vaga do Inserir, cartões pequenos." },
  { nome: "raio-painel", valor: "14px", uso: "Painéis do canvas, cartões de frame, evidências, barras flutuantes, insight em foco." },
  { nome: "raio-l", valor: "18px", uso: "Painéis de página e painel flutuante do modo ao vivo; campo do chat compacto." },
  { nome: "raio-folha", valor: "22px", uso: "Folhas laterais." },
  { nome: "raio-xl", valor: "24px", uso: "Campo do chat do Início." },
  { nome: "raio-aparelho", valor: "44px", uso: "Moldura de aparelho; a tela dentro dela usa 34px." },
  { nome: "raio-pill", valor: "999px", uso: "Seletores, chips, pílulas de impacto, toasts, rótulo do cursor do agente." },
]

export const espacos: readonly TokenSimples[] = [
  { nome: "espaco-2xs", valor: "6px", uso: "Entre ícone e texto em pílulas; folga mínima." },
  { nome: "espaco-xs", valor: "8px", uso: "Entre ícone e rótulo em botões; entre chips." },
  { nome: "espaco-sm", valor: "10px", uso: "Entre parágrafos de mensagem; padding de linhas de lista." },
  { nome: "espaco-md", valor: "14px", uso: "Entre grupos de um painel; das barras flutuantes às bordas do canvas." },
  { nome: "espaco-lg", valor: "22px", uso: "Padding de folha lateral; gap da grade de notas." },
  { nome: "espaco-xl", valor: "36px", uso: "Respiro lateral das páginas de lista." },
  { nome: "passo-ponto", valor: "22px", uso: "Passo do pontilhado do canvas, o mesmo das grades de notas." },
  { nome: "entre-frames", valor: "72px", uso: "Distância entre frames de uma mesma linha no canvas." },
]

export const layout: readonly TokenSimples[] = [
  { nome: "lat-w", valor: "264px", uso: "Largura da lateral aberta; recolhida tem 68px." },
  { nome: "lat-recolhida", valor: "68px", uso: "Largura da lateral recolhida, só ícones." },
  { nome: "conversa-min", valor: "340px", uso: "Largura mínima da conversa ao lado do canvas (300px até 1180px de janela)." },
  { nome: "conversa-max", valor: "400px", uso: "Largura máxima da conversa ao lado do canvas." },
  { nome: "conteudo-max", valor: "1200px", uso: "Contêiner das páginas de lista." },
  { nome: "inicio-max", valor: "780px", uso: "Saudação e campo do chat do Início." },
  { nome: "aparelho-l", valor: "390px", uso: "Largura da moldura de aparelho (altura 780px)." },
  { nome: "painel-vivo", valor: "300px", uso: "Largura do painel flutuante do modo ao vivo." },
]

export interface ArquivoDeFonte {
  familia: string
  /** Caminho relativo a src/. */
  arquivo: string
  peso: string
}

export const arquivosDeFonte: readonly ArquivoDeFonte[] = [
  { familia: "Geist", arquivo: "fonts/geist-e09adc.woff2", peso: "400 700" },
  { familia: "Bricolage Grotesque", arquivo: "fonts/bricolage-grotesque-a97232.woff2", peso: "500 800" },
]

/** Pilhas de fonte. No CSS viram --f-ui e --f-titulo. */
export const familias = {
  ui: "'Geist', 'Segoe UI', system-ui, -apple-system, sans-serif",
  titulo: "'Bricolage Grotesque', 'Geist', 'Segoe UI', system-ui, sans-serif",
} as const

export interface EstiloDeTexto {
  nome: string
  familia: keyof typeof familias
  tamanho: string
  alturaDeLinha: number
  peso: number
  espacamento?: string
  tamanhoOptico?: number
  amostra: string
  uso: string
}

export const estilosDeTexto: readonly EstiloDeTexto[] = [
  { nome: "display", familia: "titulo", tamanho: "2.875rem", alturaDeLinha: 1.06, peso: 700, espacamento: "-0.025em", tamanhoOptico: 64, amostra: "Boa tarde, Marina", uso: "Saudação do Início. No app escala com clamp(2rem, 3.6vw, 2.875rem)." },
  { nome: "headline", familia: "titulo", tamanho: "2.125rem", alturaDeLinha: 1.08, peso: 700, espacamento: "-0.025em", amostra: "Protótipos", uso: "Título de página (Protótipos, Dores, Relatórios). 1.75rem no celular." },
  { nome: "title", familia: "titulo", tamanho: "1.625rem", alturaDeLinha: 1.15, peso: 700, espacamento: "-0.02em", amostra: "Relatório de Fonte", uso: "Título de folha lateral." },
  { nome: "title-conversa", familia: "titulo", tamanho: "1.1875rem", alturaDeLinha: 1.25, peso: 700, espacamento: "-0.015em", amostra: "Remessa sem susto", uso: "Cabeçalho da conversa; uma linha, corta com reticências." },
  { nome: "body", familia: "ui", tamanho: "15px", alturaDeLinha: 1.5, peso: 400, amostra: "Peça uma mudança, cite uma Dor com @…", uso: "Toda a interface, com numerais tabulares." },
  { nome: "body-lead", familia: "ui", tamanho: "1.0625rem", alturaDeLinha: 1.5, peso: 400, amostra: "Cole uma Dor, anexe um Relatório ou descreva o que quer mudar.", uso: "Subtítulo da saudação e texto do campo do chat no Início." },
  { nome: "mensagem", familia: "ui", tamanho: "0.9375rem", alturaDeLinha: 1.6, peso: 400, amostra: "Inseri um aviso depois do bloco “Beneficiário”, na tela Revisar da Proposta A.", uso: "Mensagens do agente na conversa." },
  { nome: "narrativa", familia: "ui", tamanho: "1.0625rem", alturaDeLinha: 1.65, peso: 400, amostra: "A maior parte das ligações começa depois do estorno, não antes.", uso: "Narrativa do Relatório, no máximo 66ch." },
  { nome: "botao", familia: "ui", tamanho: "0.9375rem", alturaDeLinha: 1.2, peso: 600, amostra: "Gerar Variantes", uso: "Rótulo de botão; 0.875rem no botão pequeno." },
  { nome: "label", familia: "ui", tamanho: "0.75rem", alturaDeLinha: 1.25, peso: 600, espacamento: "0.01em", amostra: "Recentes", uso: "Rótulos de seção, títulos de menu, pílulas. Nunca em caixa-alta." },
  { nome: "nota", familia: "ui", tamanho: "0.9375rem", alturaDeLinha: 1.32, peso: 600, amostra: "Minha transação de câmbio estornou e não recebi nenhuma notificação", uso: "Título da nota autoadesiva, até 3 linhas." },
  { nome: "nota-grande", familia: "ui", tamanho: "24px", alturaDeLinha: 1.3, peso: 600, amostra: "Rage click no botão Confirmar remessa", uso: "Título da nota colada no canvas ao lado do frame." },
]

/** A curva de toda transição do app; o cursor do agente usa a mesma em 0.62s. */
export const curva = "cubic-bezier(0.16, 1, 0.3, 1)"

/**
 * Pares de texto (e marcas) que o sistema promete, com o mínimo WCAG de cada um.
 * src/tokens/tokens.test.ts cobra todos nos dois temas.
 */
export interface ParDeContraste {
  frente: string
  fundo: string
  minimo: number
  onde: string
}

export const paresDeContraste: readonly ParDeContraste[] = [
  { frente: "tinta", fundo: "superficie", minimo: 4.5, onde: "texto principal em painéis" },
  { frente: "tinta", fundo: "quadro", minimo: 4.5, onde: "texto sobre o canvas" },
  { frente: "tinta", fundo: "elevada", minimo: 4.5, onde: "menus e barras flutuantes" },
  { frente: "tinta", fundo: "superficie-3", minimo: 4.5, onde: "aba e opção selecionadas" },
  { frente: "tinta-2", fundo: "superficie", minimo: 4.5, onde: "texto secundário" },
  { frente: "tinta-2", fundo: "quadro", minimo: 4.5, onde: "texto secundário no canvas" },
  { frente: "tinta-2", fundo: "superficie-2", minimo: 4.5, onde: "fundos recuados" },
  { frente: "tinta-3", fundo: "superficie", minimo: 4.5, onde: "metadados" },
  { frente: "tinta-3", fundo: "quadro", minimo: 4.5, onde: "rótulo de frame" },
  { frente: "tinta-3", fundo: "ponto", minimo: 4.5, onde: "rótulo de frame sobre o pontilhado" },
  { frente: "acento-tinta", fundo: "superficie", minimo: 4.5, onde: "laranja como texto" },
  { frente: "acento-tinta", fundo: "acento-suave", minimo: 4.5, onde: "item atual" },
  { frente: "sobre-acento", fundo: "acento", minimo: 4.5, onde: "rótulo do botão primário" },
  { frente: "sobre-acento", fundo: "acento-hover", minimo: 4.5, onde: "botão primário no hover" },
  { frente: "nota-tinta", fundo: "nota-likert", minimo: 4.5, onde: "nota Likert" },
  { frente: "nota-tinta", fundo: "nota-voz", minimo: 4.5, onde: "nota Voz do Cliente" },
  { frente: "nota-tinta", fundo: "nota-fullstory", minimo: 4.5, onde: "nota FullStory" },
  { frente: "critico-tinta", fundo: "critico-suave", minimo: 4.5, onde: "texto de erro" },
  { frente: "atencao-tinta", fundo: "atencao", minimo: 4.5, onde: "pílula Médio" },
  { frente: "observar-tinta", fundo: "observar", minimo: 4.5, onde: "pílula Baixo" },
  { frente: "ok-tinta", fundo: "ok-suave", minimo: 4.5, onde: "selo Resolvido" },
  { frente: "sobre-toast", fundo: "toast", minimo: 4.5, onde: "toast" },
  { frente: "acento", fundo: "superficie", minimo: 3, onde: "mira, vaga e contorno de seleção" },
  { frente: "graf-enfase", fundo: "superficie", minimo: 3, onde: "série em foco" },
  { frente: "graf-contexto", fundo: "superficie", minimo: 3, onde: "séries de contexto" },
]

/**
 * Pares reais do app que ficam abaixo do ideal, com o valor medido. O teste
 * confere que continuam assim: se alguém corrigir, o teste pede para tirar
 * a exceção daqui e das notas dos tokens.
 */
export interface ExcecaoDeContraste {
  frente: string
  fundo: string
  tema: Tema
  medido: number
  motivo: string
}

export const excecoesDeContraste: readonly ExcecaoDeContraste[] = [
  { frente: "sobre-acento", fundo: "acento-press", tema: "claro", medido: 4.04, motivo: "Dura só o clique do botão primário." },
  { frente: "borda-forte", fundo: "superficie", tema: "claro", medido: 1.57, motivo: "Abaixo do 3:1 de borda de controle; o botão secundário se apoia em sombra e rótulo." },
  { frente: "borda-forte", fundo: "superficie", tema: "escuro", medido: 1.71, motivo: "Abaixo do 3:1 de borda de controle; o botão secundário se apoia em sombra e rótulo." },
]
