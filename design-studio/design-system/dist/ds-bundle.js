// src/tokens/tokens.ts
var cores = [
  {
    nome: "quadro",
    claro: "#f6f6f4",
    escuro: "#131312",
    uso: "Ch\xE3o do canvas e do In\xEDcio, sob o pontilhado. Nunca leva texto direto sem painel, exceto r\xF3tulos de frame em tinta-3."
  },
  {
    nome: "ponto",
    claro: "#dcdcd6",
    escuro: "#2b2b29",
    uso: "Pontos do canvas: radial-gradient de 1.15px em passo de 22px (passo-ponto), com a parada externa na cor de quadro."
  },
  {
    nome: "superficie",
    claro: "#ffffff",
    escuro: "#1b1b1a",
    uso: "Pain\xE9is, lateral, cart\xF5es, campos e bot\xE3o secund\xE1rio."
  },
  {
    nome: "superficie-2",
    claro: "#f7f7f5",
    escuro: "#212120",
    uso: "Fundos recuados: rodap\xE9 de folha, seletores pill, hover de item de lista."
  },
  {
    nome: "superficie-3",
    claro: "#efefec",
    escuro: "#2a2a28",
    uso: "Hover de bot\xE3o terci\xE1rio, aba de Proposta selecionada, segmento de escolha curta."
  },
  {
    nome: "elevada",
    claro: "#ffffff",
    escuro: "#252524",
    uso: "Menus, barras flutuantes do canvas, painel flutuante do modo ao vivo e dica do gr\xE1fico."
  },
  {
    nome: "borda",
    claro: "#e6e6e1",
    escuro: "#2e2e2c",
    uso: "Divis\xF3rias de 1px entre \xE1reas e linhas de lista; grade horizontal dos gr\xE1ficos."
  },
  {
    nome: "borda-forte",
    claro: "#cfcfc8",
    escuro: "#42423f",
    uso: "Contorno de bot\xE3o secund\xE1rio e de campos; bordas tracejadas de vazio; linha de base dos gr\xE1ficos. Contra superficie d\xE1 1,57:1 no claro e 1,71:1 no escuro, abaixo do 3:1 de borda de controle: o bot\xE3o secund\xE1rio se apoia tamb\xE9m em sombra e r\xF3tulo; n\xE3o delimite um campo s\xF3 com ela."
  },
  {
    nome: "tinta",
    claro: "#1a1a1a",
    escuro: "#f2f2ee",
    uso: "Texto principal em superficie, superficie-2, superficie-3, elevada e quadro. Tamb\xE9m o contorno de foco (2px, afastado 2px) e o fundo da ferramenta ativa."
  },
  {
    nome: "tinta-2",
    claro: "#48483f",
    escuro: "#b9b9b2",
    uso: "Texto secund\xE1rio e \xEDcones em superficie, superficie-2, elevada e quadro."
  },
  {
    nome: "tinta-3",
    claro: "#5e5e57",
    escuro: "#94948c",
    uso: "Metadados, r\xF3tulos de frame, hor\xE1rios e conectores; \u22654.5:1 em superficie, quadro e inclusive sobre ponto."
  },
  {
    nome: "acento",
    claro: "#ec7000",
    escuro: "#ff7a1a",
    uso: "O \xFAnico laranja de marca: a\xE7\xE3o principal, bot\xE3o de enviar, sele\xE7\xE3o, cursor do agente, mira e vaga do Inserir. Sempre com sobre-acento por cima, nunca texto branco."
  },
  {
    nome: "acento-hover",
    claro: "#d96600",
    escuro: "#ff8d3d",
    uso: "Hover de todo elemento com fundo acento."
  },
  {
    nome: "acento-press",
    claro: "#c45c00",
    escuro: "#ff9f5c",
    uso: "Clique de todo elemento com fundo acento. Com sobre-acento d\xE1 4,04:1 no claro, abaixo de 4,5:1 para texto comum; dura s\xF3 o clique."
  },
  {
    nome: "acento-suave",
    claro: "#fdeee2",
    escuro: "#3a2413",
    uso: 'Fundo do item de navega\xE7\xE3o atual, op\xE7\xE3o marcada, dica "Pr\xF3xima", zona de soltar arquivo e insight em foco.'
  },
  {
    nome: "acento-tinta",
    claro: "#a34c00",
    escuro: "#ffa260",
    uso: 'A \xFAnica forma de laranja usada como texto ou \xEDcone: item atual, "em foco" no r\xF3tulo do frame, marcas de confirma\xE7\xE3o. Em superficie e acento-suave.'
  },
  {
    nome: "sobre-acento",
    claro: "#1a1a1a",
    escuro: "#141414",
    uso: "Texto e \xEDcone sobre acento, acento-hover e acento-press, nos dois temas."
  },
  {
    nome: "nota-likert",
    claro: "#ffe7a0",
    escuro: "#e9d48b",
    uso: "Nota autoadesiva e chip de Fonte da Fonte Likert. S\xF3 isso."
  },
  {
    nome: "nota-voz",
    claro: "#ffd2c0",
    escuro: "#eeb8a3",
    uso: "Nota autoadesiva e chip de Fonte da Fonte Voz do Cliente. S\xF3 isso."
  },
  {
    nome: "nota-fullstory",
    claro: "#cdeed8",
    escuro: "#a7d9b9",
    uso: "Nota autoadesiva e chip de Fonte da Fonte FullStory. S\xF3 isso."
  },
  {
    nome: "nota-tinta",
    claro: "#29261d",
    escuro: "#1d1a11",
    uso: "Texto sobre nota-likert, nota-voz e nota-fullstory, nos dois temas."
  },
  {
    nome: "critico",
    claro: "#c4291c",
    escuro: "#d6392b",
    uso: "Impacto Alto (p\xEDlula cheia com texto branco), microfone gravando, tend\xEAncia de alta de uma Dor."
  },
  {
    nome: "critico-suave",
    claro: "#fdebe8",
    escuro: "#3c1814",
    uso: "Fundo de aviso de erro e de tela quente no mapa de onde d\xF3i."
  },
  {
    nome: "critico-tinta",
    claro: "#9c1f14",
    escuro: "#ffa69b",
    uso: "Texto de erro em critico-suave e superficie."
  },
  {
    nome: "atencao",
    claro: "#ffe08a",
    escuro: "#4a3b10",
    uso: "Fundo da p\xEDlula de impacto M\xE9dio."
  },
  {
    nome: "atencao-tinta",
    claro: "#614300",
    escuro: "#ffd66b",
    uso: "Texto da p\xEDlula de impacto M\xE9dio, em atencao."
  },
  {
    nome: "observar",
    claro: "#ececea",
    escuro: "#2c2c2a",
    uso: "Fundo da p\xEDlula de impacto Baixo e de p\xEDlulas neutras."
  },
  {
    nome: "observar-tinta",
    claro: "#4c4c47",
    escuro: "#cfcfc8",
    uso: "Texto em observar."
  },
  {
    nome: "ok",
    claro: "#1f8a5b",
    escuro: "#3cbf82",
    uso: "\xCDcone de passo conclu\xEDdo, achado resolvido e tend\xEAncia de queda."
  },
  {
    nome: "ok-suave",
    claro: "#e2f3e9",
    escuro: "#12301f",
    uso: 'Fundo de selo "Resolvido" e de passo conclu\xEDdo.'
  },
  {
    nome: "ok-tinta",
    claro: "#12633f",
    escuro: "#7fdcaa",
    uso: "Texto em ok-suave e superficie."
  },
  {
    nome: "toast",
    claro: "#1a1a1a",
    escuro: "#f2f2ee",
    uso: "Fundo invertido de toasts, dica do canvas e p\xEDlula da mira do Inserir."
  },
  {
    nome: "sobre-toast",
    claro: "#ffffff",
    escuro: "#141414",
    uso: "Texto sobre toast."
  },
  {
    nome: "graf-enfase",
    claro: "#ec7000",
    escuro: "#e36b00",
    uso: "A s\xE9rie ou categoria em foco de um gr\xE1fico; uma por gr\xE1fico. No escuro baixa para n\xE3o vibrar contra o fundo."
  },
  {
    nome: "graf-enfase-lavada",
    claro: "rgba(236, 112, 0, 0.38)",
    escuro: "rgba(227, 107, 0, 0.42)",
    uso: "O resto de uma barra partida quando um filtro de Dor recorta a categoria em foco."
  },
  {
    nome: "graf-contexto",
    claro: "#8f8f88",
    escuro: "#7a7a73",
    uso: "Todas as outras s\xE9ries e categorias de um gr\xE1fico: o cinza que recua."
  },
  {
    nome: "graf-area",
    claro: "rgba(236, 112, 0, 0.10)",
    escuro: "rgba(227, 107, 0, 0.14)",
    uso: "Lavagem sob a linha em foco (10% no claro, 14% no escuro)."
  },
  {
    nome: "aparelho",
    claro: "#0f0f0f",
    escuro: "#050505",
    uso: "Corpo da moldura de aparelho (390\xD7780, canto raio-aparelho) e a ilha da tela. No escuro ganha fio de 1px em borda."
  },
  {
    nome: "marca-claude",
    claro: "#d97757",
    uso: "Cor da logo oficial do Claude, s\xF3 dentro do ladrilho de logo. N\xE3o \xE9 acento e n\xE3o colore mais nada."
  }
];
var sombras = [
  {
    nome: "sombra-1",
    claro: "0 1px 2px rgba(24, 24, 18, 0.06), 0 1px 1px rgba(24, 24, 18, 0.04)",
    escuro: "0 1px 2px rgba(0, 0, 0, 0.4)",
    uso: "Repouso: bot\xE3o secund\xE1rio, pain\xE9is, cart\xF5es de frame, segmento ativo."
  },
  {
    nome: "sombra-2",
    claro: "0 8px 24px rgba(24, 24, 18, 0.08), 0 2px 6px rgba(24, 24, 18, 0.05)",
    escuro: "0 10px 28px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)",
    uso: "Flutuante: campo do chat, barras flutuantes do canvas, hover de cart\xE3o, dica do gr\xE1fico."
  },
  {
    nome: "sombra-3",
    claro: "0 28px 64px rgba(24, 24, 18, 0.16), 0 8px 20px rgba(24, 24, 18, 0.08)",
    escuro: "0 30px 70px rgba(0, 0, 0, 0.6), 0 8px 20px rgba(0, 0, 0, 0.35)",
    uso: "Sobreposto: menus, folhas laterais, pain\xE9is do modo ao vivo, bal\xF5es de coment\xE1rio, toasts."
  },
  {
    nome: "sombra-nota",
    claro: "0 1px 1px rgba(20, 20, 18, 0.08), 0 10px 18px -8px rgba(20, 20, 18, 0.26)",
    escuro: "0 1px 1px rgba(0, 0, 0, 0.3), 0 12px 20px -8px rgba(0, 0, 0, 0.6)",
    uso: "Papel colado: notas autoadesivas; no hover cresce e a nota sobe 3px."
  },
  {
    nome: "sombra-aparelho",
    claro: "0 30px 60px rgba(20, 20, 15, 0.18), 0 6px 16px rgba(20, 20, 15, 0.1)",
    escuro: "0 30px 70px rgba(0, 0, 0, 0.6), 0 0 0 1px #2e2e2c",
    uso: "Molduras de aparelho e janelas de desktop no canvas."
  }
];
var raios = [
  { nome: "raio-nota", valor: "3px", uso: "Nota autoadesiva: quase reta, como papel. A exce\xE7\xE3o deliberada aos cantos generosos." },
  { nome: "raio-s", valor: "8px", uso: "Ladrilho de logo do agente, chips pequenos, campos internos de painel." },
  { nome: "raio-m", valor: "10px", uso: "Bot\xE3o pequeno, item de navega\xE7\xE3o, ferramenta da barra flutuante, campos do painel flutuante." },
  { nome: "raio", valor: "12px", uso: "Bot\xF5es, campos de formul\xE1rio, seletor de Dor, vaga do Inserir, cart\xF5es pequenos." },
  { nome: "raio-painel", valor: "14px", uso: "Pain\xE9is do canvas, cart\xF5es de frame, evid\xEAncias, barras flutuantes, insight em foco." },
  { nome: "raio-l", valor: "18px", uso: "Pain\xE9is de p\xE1gina e painel flutuante do modo ao vivo; campo do chat compacto." },
  { nome: "raio-folha", valor: "22px", uso: "Folhas laterais." },
  { nome: "raio-xl", valor: "24px", uso: "Campo do chat do In\xEDcio." },
  { nome: "raio-aparelho", valor: "44px", uso: "Moldura de aparelho; a tela dentro dela usa 34px." },
  { nome: "raio-pill", valor: "999px", uso: "Seletores, chips, p\xEDlulas de impacto, toasts, r\xF3tulo do cursor do agente." }
];
var espacos = [
  { nome: "espaco-2xs", valor: "6px", uso: "Entre \xEDcone e texto em p\xEDlulas; folga m\xEDnima." },
  { nome: "espaco-xs", valor: "8px", uso: "Entre \xEDcone e r\xF3tulo em bot\xF5es; entre chips." },
  { nome: "espaco-sm", valor: "10px", uso: "Entre par\xE1grafos de mensagem; padding de linhas de lista." },
  { nome: "espaco-md", valor: "14px", uso: "Entre grupos de um painel; das barras flutuantes \xE0s bordas do canvas." },
  { nome: "espaco-lg", valor: "22px", uso: "Padding de folha lateral; gap da grade de notas." },
  { nome: "espaco-xl", valor: "36px", uso: "Respiro lateral das p\xE1ginas de lista." },
  { nome: "passo-ponto", valor: "22px", uso: "Passo do pontilhado do canvas, o mesmo das grades de notas." },
  { nome: "entre-frames", valor: "72px", uso: "Dist\xE2ncia entre frames de uma mesma linha no canvas." }
];
var layout = [
  { nome: "lat-w", valor: "264px", uso: "Largura da lateral aberta; recolhida tem 68px." },
  { nome: "lat-recolhida", valor: "68px", uso: "Largura da lateral recolhida, s\xF3 \xEDcones." },
  { nome: "conversa-min", valor: "340px", uso: "Largura m\xEDnima da conversa ao lado do canvas (300px at\xE9 1180px de janela)." },
  { nome: "conversa-max", valor: "400px", uso: "Largura m\xE1xima da conversa ao lado do canvas." },
  { nome: "conteudo-max", valor: "1200px", uso: "Cont\xEAiner das p\xE1ginas de lista." },
  { nome: "inicio-max", valor: "780px", uso: "Sauda\xE7\xE3o e campo do chat do In\xEDcio." },
  { nome: "aparelho-l", valor: "390px", uso: "Largura da moldura de aparelho (altura 780px)." },
  { nome: "painel-vivo", valor: "300px", uso: "Largura do painel flutuante do modo ao vivo." }
];
var arquivosDeFonte = [
  { familia: "Geist", arquivo: "fonts/geist-e09adc.woff2", peso: "400 700" },
  { familia: "Bricolage Grotesque", arquivo: "fonts/bricolage-grotesque-a97232.woff2", peso: "500 800" }
];
var familias = {
  ui: "'Geist', 'Segoe UI', system-ui, -apple-system, sans-serif",
  titulo: "'Bricolage Grotesque', 'Geist', 'Segoe UI', system-ui, sans-serif"
};
var estilosDeTexto = [
  { nome: "display", familia: "titulo", tamanho: "2.875rem", alturaDeLinha: 1.06, peso: 700, espacamento: "-0.025em", tamanhoOptico: 64, amostra: "Boa tarde, Marina", uso: "Sauda\xE7\xE3o do In\xEDcio. No app escala com clamp(2rem, 3.6vw, 2.875rem)." },
  { nome: "headline", familia: "titulo", tamanho: "2.125rem", alturaDeLinha: 1.08, peso: 700, espacamento: "-0.025em", amostra: "Prot\xF3tipos", uso: "T\xEDtulo de p\xE1gina (Prot\xF3tipos, Dores, Relat\xF3rios). 1.75rem no celular." },
  { nome: "title", familia: "titulo", tamanho: "1.625rem", alturaDeLinha: 1.15, peso: 700, espacamento: "-0.02em", amostra: "Relat\xF3rio de Fonte", uso: "T\xEDtulo de folha lateral." },
  { nome: "title-conversa", familia: "titulo", tamanho: "1.1875rem", alturaDeLinha: 1.25, peso: 700, espacamento: "-0.015em", amostra: "Remessa sem susto", uso: "Cabe\xE7alho da conversa; uma linha, corta com retic\xEAncias." },
  { nome: "body", familia: "ui", tamanho: "15px", alturaDeLinha: 1.5, peso: 400, amostra: "Pe\xE7a uma mudan\xE7a, cite uma Dor com @\u2026", uso: "Toda a interface, com numerais tabulares." },
  { nome: "body-lead", familia: "ui", tamanho: "1.0625rem", alturaDeLinha: 1.5, peso: 400, amostra: "Cole uma Dor, anexe um Relat\xF3rio ou descreva o que quer mudar.", uso: "Subt\xEDtulo da sauda\xE7\xE3o e texto do campo do chat no In\xEDcio." },
  { nome: "mensagem", familia: "ui", tamanho: "0.9375rem", alturaDeLinha: 1.6, peso: 400, amostra: "Inseri um aviso depois do bloco \u201CBenefici\xE1rio\u201D, na tela Revisar da Proposta A.", uso: "Mensagens do agente na conversa." },
  { nome: "narrativa", familia: "ui", tamanho: "1.0625rem", alturaDeLinha: 1.65, peso: 400, amostra: "A maior parte das liga\xE7\xF5es come\xE7a depois do estorno, n\xE3o antes.", uso: "Narrativa do Relat\xF3rio, no m\xE1ximo 66ch." },
  { nome: "botao", familia: "ui", tamanho: "0.9375rem", alturaDeLinha: 1.2, peso: 600, amostra: "Gerar Variantes", uso: "R\xF3tulo de bot\xE3o; 0.875rem no bot\xE3o pequeno." },
  { nome: "label", familia: "ui", tamanho: "0.75rem", alturaDeLinha: 1.25, peso: 600, espacamento: "0.01em", amostra: "Recentes", uso: "R\xF3tulos de se\xE7\xE3o, t\xEDtulos de menu, p\xEDlulas. Nunca em caixa-alta." },
  { nome: "nota", familia: "ui", tamanho: "0.9375rem", alturaDeLinha: 1.32, peso: 600, amostra: "Minha transa\xE7\xE3o de c\xE2mbio estornou e n\xE3o recebi nenhuma notifica\xE7\xE3o", uso: "T\xEDtulo da nota autoadesiva, at\xE9 3 linhas." },
  { nome: "nota-grande", familia: "ui", tamanho: "24px", alturaDeLinha: 1.3, peso: 600, amostra: "Rage click no bot\xE3o Confirmar remessa", uso: "T\xEDtulo da nota colada no canvas ao lado do frame." }
];
var curva = "cubic-bezier(0.16, 1, 0.3, 1)";
var paresDeContraste = [
  { frente: "tinta", fundo: "superficie", minimo: 4.5, onde: "texto principal em pain\xE9is" },
  { frente: "tinta", fundo: "quadro", minimo: 4.5, onde: "texto sobre o canvas" },
  { frente: "tinta", fundo: "elevada", minimo: 4.5, onde: "menus e barras flutuantes" },
  { frente: "tinta", fundo: "superficie-3", minimo: 4.5, onde: "aba e op\xE7\xE3o selecionadas" },
  { frente: "tinta-2", fundo: "superficie", minimo: 4.5, onde: "texto secund\xE1rio" },
  { frente: "tinta-2", fundo: "quadro", minimo: 4.5, onde: "texto secund\xE1rio no canvas" },
  { frente: "tinta-2", fundo: "superficie-2", minimo: 4.5, onde: "fundos recuados" },
  { frente: "tinta-3", fundo: "superficie", minimo: 4.5, onde: "metadados" },
  { frente: "tinta-3", fundo: "quadro", minimo: 4.5, onde: "r\xF3tulo de frame" },
  { frente: "tinta-3", fundo: "ponto", minimo: 4.5, onde: "r\xF3tulo de frame sobre o pontilhado" },
  { frente: "acento-tinta", fundo: "superficie", minimo: 4.5, onde: "laranja como texto" },
  { frente: "acento-tinta", fundo: "acento-suave", minimo: 4.5, onde: "item atual" },
  { frente: "sobre-acento", fundo: "acento", minimo: 4.5, onde: "r\xF3tulo do bot\xE3o prim\xE1rio" },
  { frente: "sobre-acento", fundo: "acento-hover", minimo: 4.5, onde: "bot\xE3o prim\xE1rio no hover" },
  { frente: "nota-tinta", fundo: "nota-likert", minimo: 4.5, onde: "nota Likert" },
  { frente: "nota-tinta", fundo: "nota-voz", minimo: 4.5, onde: "nota Voz do Cliente" },
  { frente: "nota-tinta", fundo: "nota-fullstory", minimo: 4.5, onde: "nota FullStory" },
  { frente: "critico-tinta", fundo: "critico-suave", minimo: 4.5, onde: "texto de erro" },
  { frente: "atencao-tinta", fundo: "atencao", minimo: 4.5, onde: "p\xEDlula M\xE9dio" },
  { frente: "observar-tinta", fundo: "observar", minimo: 4.5, onde: "p\xEDlula Baixo" },
  { frente: "ok-tinta", fundo: "ok-suave", minimo: 4.5, onde: "selo Resolvido" },
  { frente: "sobre-toast", fundo: "toast", minimo: 4.5, onde: "toast" },
  { frente: "acento", fundo: "superficie", minimo: 3, onde: "mira, vaga e contorno de sele\xE7\xE3o" },
  { frente: "graf-enfase", fundo: "superficie", minimo: 3, onde: "s\xE9rie em foco" },
  { frente: "graf-contexto", fundo: "superficie", minimo: 3, onde: "s\xE9ries de contexto" }
];
var excecoesDeContraste = [
  { frente: "sobre-acento", fundo: "acento-press", tema: "claro", medido: 4.04, motivo: "Dura s\xF3 o clique do bot\xE3o prim\xE1rio." },
  { frente: "borda-forte", fundo: "superficie", tema: "claro", medido: 1.57, motivo: "Abaixo do 3:1 de borda de controle; o bot\xE3o secund\xE1rio se apoia em sombra e r\xF3tulo." },
  { frente: "borda-forte", fundo: "superficie", tema: "escuro", medido: 1.71, motivo: "Abaixo do 3:1 de borda de controle; o bot\xE3o secund\xE1rio se apoia em sombra e r\xF3tulo." }
];

// src/tokens/contraste.ts
function luminancia(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`cor inv\xE1lida: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function razaoDeContraste(a, b) {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
}
function corNoTema(nome, tema) {
  const token = cores.find((c) => c.nome === nome);
  if (!token) throw new Error(`token de cor desconhecido: ${nome}`);
  return tema === "escuro" ? token.escuro ?? token.claro : token.claro;
}

// src/icones/icones.ts
var icones = {
  likert: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
  voz: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.4-1.6 2.4-4 2.4h-2"/>',
  fullstory: '<path d="M8 7l11 5.2-4.7 1.6-1.6 4.7z"/><path d="M14.5 14.5l4 4"/><path d="M6.2 5.2L4.6 3.6M10.2 4.4V2.4M4.4 10.2H2.4"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  setaE: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  enviar: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  sobe: '<path d="M7 17L17 7M9.5 7H17v7.5"/>',
  desce: '<path d="M7 7l10 10M17 9.5V17H9.5"/>',
  igual: '<path d="M5 12h14"/>',
  baixo: '<path d="M6 9l6 6 6-6"/>',
  cima: '<path d="M6 15l6-6 6 6"/>',
  dir: '<path d="M9 6l6 6-6 6"/>',
  esq: '<path d="M15 6l-6 6 6 6"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  clipe: '<path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alerta: '<path d="M12 9v4"/><path d="M12 16.5v.5"/><path d="M10.3 4L2.7 17.5A2 2 0 0 0 4.4 20.5h15.2a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z"/>',
  impMedio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.6v5.2"/><path d="M12 15.9v.4"/>',
  impBaixo: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  celular: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
  parar: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  arroba: '<circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1"/>',
  imagem: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  arquivo: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  relatorio: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 17v-3M12 17v-6M15 17v-4"/>',
  camadas: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  conversa: '<path d="M4.5 5.5h15v10h-9l-5 4z"/>',
  comentar: '<path d="M5 18.5V6.5A1.5 1.5 0 0 1 6.5 5h11A1.5 1.5 0 0 1 19 6.5v8a1.5 1.5 0 0 1-1.5 1.5H9z"/><path d="M9 10h6M9 13h3.5"/>',
  editar: '<path d="M4 20l1.2-4.8L15.5 4.9a2 2 0 0 1 2.8 0l.8.8a2 2 0 0 1 0 2.8L8.8 18.8z"/><path d="M13.5 7l3.5 3.5"/>',
  ajustar: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  testar: '<path d="M8 5.5v13l10.5-6.5z"/>',
  apresentar: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20l4-4 4 4"/>',
  compartilhar: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/>',
  historico: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>',
  lua: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  lateral: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9 4.5v15"/>',
  novo: '<path d="M12 20h8"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  busca: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  refazer: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/>',
  voltar: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  nuvem: '<path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.5A3.8 3.8 0 0 1 17.5 18z"/><path d="M12 11v5M9.8 13l2.2-2.2 2.2 2.2"/>',
  teste: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M8.5 13l2.5 2.5 4.5-5"/>',
  quadro: '<path d="M8 3v18M16 3v18M3 8h18M3 16h18"/>',
  externo: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  olho: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  zoomMais: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8.5 11h5M11 8.5v5"/>',
  zoomMenos: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8.5 11h5"/>',
  enquadrar: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>',
  pasta: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/>',
  raio: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  inicio: '<path d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  dor: '<path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/>',
  mais3: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
  selecionar: '<path d="M5 3.5l13 5.6-5.6 1.9-1.9 5.6z"/><path d="M13 13l6 6"/>',
  inserir: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8.5v7M8.5 12h7"/>',
  grafico: '<path d="M4 4v16h16"/><path d="M7.5 14.5l3.5-4 3 3 5-6"/>',
  tabela: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M3.5 14.5h17M9.5 10v9"/>'
};
var nomesDosIcones = Object.keys(icones);

// src/marcas/marcas.ts
var marcasDosAgentes = {
  claude: {
    nome: "Claude",
    viewBox: "0 0 248 248",
    cor: "#d97757",
    caminho: "M52.4285 162.873L98.7844 136.879L99.5485 134.602L98.7844 133.334H96.4921L88.7237 132.862L62.2346 132.153L39.3113 131.207L17.0249 130.026L11.4214 128.844L6.2 121.873L6.7094 118.447L11.4214 115.257L18.171 115.847L33.0711 116.911L55.485 118.447L71.6586 119.392L95.728 121.873H99.5485L100.058 120.337L98.7844 119.392L97.7656 118.447L74.5877 102.732L49.4995 86.1905L36.3823 76.62L29.3779 71.7757L25.8121 67.2858L24.2839 57.3608L30.6515 50.2716L39.3113 50.8623L41.4763 51.4531L50.2636 58.1879L68.9842 72.7209L93.4357 90.6804L97.0015 93.6343L98.4374 92.6652L98.6571 91.9801L97.0015 89.2625L83.757 65.2772L69.621 40.8192L63.2534 30.6579L61.5978 24.632C60.9565 22.1032 60.579 20.0111 60.579 17.4246L67.8381 7.49965L71.9133 6.19995L81.7193 7.49965L85.7946 11.0443L91.9074 24.9865L101.714 46.8451L116.996 76.62L121.453 85.4816L123.873 93.6343L124.764 96.1155H126.292V94.6976L127.566 77.9197L129.858 57.3608L132.15 30.8942L132.915 23.4505L136.608 14.4708L143.994 9.62643L149.725 12.344L154.437 19.0788L153.8 23.4505L150.998 41.6463L145.522 70.1215L141.957 89.2625H143.994L146.414 86.7813L156.093 74.0206L172.266 53.698L179.398 45.6635L187.803 36.802L193.152 32.5484H203.34L210.726 43.6549L207.415 55.1159L196.972 68.3492L188.312 79.5739L175.896 96.2095L168.191 109.585L168.882 110.689L170.738 110.53L198.755 104.504L213.91 101.787L231.994 98.7149L240.144 102.496L241.036 106.395L237.852 114.311L218.495 119.037L195.826 123.645L162.07 131.592L161.696 131.893L162.137 132.547L177.36 133.925L183.855 134.279H199.774L229.447 136.524L237.215 141.605L241.8 147.867L241.036 152.711L229.065 158.737L213.019 154.956L175.45 145.977L162.587 142.787H160.805V143.85L171.502 154.366L191.242 172.089L215.82 195.011L217.094 200.682L213.91 205.172L210.599 204.699L188.949 188.394L180.544 181.069L161.696 165.118H160.422V166.772L164.752 173.152L187.803 207.771L188.949 218.405L187.294 221.832L181.308 223.959L174.813 222.777L161.187 203.754L147.305 182.486L136.098 163.345L134.745 164.2L128.075 235.42L125.019 239.082L117.887 241.8L111.902 237.31L108.718 229.984L111.902 215.452L115.722 196.547L118.779 181.541L121.58 162.873L123.291 156.636L123.14 156.219L121.773 156.449L107.699 175.752L86.304 204.699L69.3663 222.777L65.291 224.431L58.2867 220.768L58.9235 214.27L62.8713 208.48L86.304 178.705L100.44 160.155L109.551 149.507L109.462 147.967L108.959 147.924L46.6977 188.512L35.6182 189.93L30.7788 185.44L31.4156 178.115L33.7079 175.752L52.4285 162.873Z"
  },
  devin: {
    nome: "Devin",
    viewBox: "0 0 425 425",
    cor: "currentColor",
    caminho: "M70 159.333V91.3471C70 88.3592 71.594 85.5983 74.1816 84.1044L133.043 50.1205C135.631 48.6265 138.819 48.6265 141.407 50.1205L200.269 84.1044C202.856 85.5983 204.45 88.3592 204.45 91.3471V126.068C204.708 137.606 210.806 148.734 221.531 154.926C232.256 161.117 244.942 160.834 255.063 155.289L285.132 137.929C287.719 136.435 290.907 136.435 293.495 137.929L352.357 171.913C354.944 173.406 356.538 176.167 356.538 179.155V247.123C356.538 250.111 354.944 252.872 352.357 254.366L293.495 288.35C290.907 289.844 287.719 289.844 285.132 288.35L255.306 271.13C245.146 265.456 232.344 265.117 221.534 271.358C210.809 277.55 204.711 288.678 204.453 300.215V334.926C204.453 337.914 202.859 340.675 200.271 342.169L141.41 376.153C138.822 377.647 135.634 377.647 133.046 376.153L74.1845 342.169C71.5969 340.675 70.0028 337.914 70.0028 334.926V266.959C70.0029 263.971 71.5969 261.21 74.1845 259.716L133.046 225.732C135.634 224.238 138.822 224.238 141.41 225.732L171.547 243.132C181.656 248.638 194.306 248.906 205.005 242.729C215.815 236.488 221.922 225.231 222.088 213.595C221.83 202.057 215.732 189.737 205.008 183.545C194.283 177.353 181.597 177.636 171.476 183.181L141.269 200.72C138.67 202.229 135.461 202.228 132.864 200.716L74.1576 166.562C71.5835 165.065 70 162.311 70 159.333Z"
  }
};

// src/utils/cx.ts
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

// src/components/Icone/Icone.tsx
import { jsx } from "react/jsx-runtime";
function Icone({ nome, tamanho = 18, rotulo, className }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: cx("dst-ic", className),
      viewBox: "0 0 24 24",
      width: tamanho,
      height: tamanho,
      fill: nome === "mais3" ? "currentColor" : "none",
      stroke: "currentColor",
      strokeWidth: 1.75,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      role: rotulo ? "img" : void 0,
      "aria-label": rotulo,
      "aria-hidden": rotulo ? void 0 : true,
      focusable: "false",
      dangerouslySetInnerHTML: { __html: icones[nome] }
    }
  );
}

// src/components/Sinal/Sinal.tsx
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
function Sinal({ tamanho = 30, rotulo, className }) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      className: cx("dst-sinal", className),
      viewBox: "0 0 32 32",
      width: tamanho,
      height: tamanho,
      role: rotulo ? "img" : void 0,
      "aria-label": rotulo,
      "aria-hidden": rotulo ? void 0 : true,
      focusable: "false",
      children: [
        /* @__PURE__ */ jsx2("rect", { x: "2", y: "2", width: "28", height: "28", rx: "9", fill: "var(--acento)" }),
        /* @__PURE__ */ jsx2("path", { d: "M10 21.5h7.5a5.5 5.5 0 0 0 0-11H10z", fill: "none", stroke: "var(--sobre-acento)", strokeWidth: "2.6", strokeLinejoin: "round" }),
        /* @__PURE__ */ jsx2("circle", { cx: "22.6", cy: "21.4", r: "2.1", fill: "var(--sobre-acento)" })
      ]
    }
  );
}
function Marca({ href, soSinal = false, className }) {
  const conteudo = /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx2(Sinal, {}),
    /* @__PURE__ */ jsx2("span", { className: cx(soSinal && "dst-sr"), children: "Design Studio" })
  ] });
  return href ? /* @__PURE__ */ jsx2("a", { className: cx("dst-marca", className), href, children: conteudo }) : /* @__PURE__ */ jsx2("span", { className: cx("dst-marca", className), children: conteudo });
}

// src/components/LogoDoAgente/LogoDoAgente.tsx
import { jsx as jsx3 } from "react/jsx-runtime";
function LogoDoAgente({ agente, tamanho = "normal", anunciar = false, className }) {
  const marca = marcasDosAgentes[agente];
  return /* @__PURE__ */ jsx3(
    "span",
    {
      className: cx("dst-logo-agente", `dst-logo-agente--${agente}`, tamanho !== "normal" && `dst-logo-agente--${tamanho}`, className),
      role: anunciar ? "img" : void 0,
      "aria-label": anunciar ? marca.nome : void 0,
      "aria-hidden": anunciar ? void 0 : true,
      children: /* @__PURE__ */ jsx3("svg", { viewBox: marca.viewBox, "aria-hidden": "true", focusable: "false", children: /* @__PURE__ */ jsx3("path", { d: marca.caminho, fill: marca.cor }) })
    }
  );
}

// src/components/Botao/Botao.tsx
import React from "react";
import { Fragment as Fragment2, jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
var Botao = React.forwardRef(function Botao2({ variante = "primario", tamanho = "normal", icone, href, className, children, type = "button", ...resto }, ref) {
  const classes = cx("dst-botao", `dst-botao--${variante}`, tamanho === "pequeno" && "dst-botao--pequeno", className);
  const conteudo = /* @__PURE__ */ jsxs2(Fragment2, { children: [
    icone && /* @__PURE__ */ jsx4(Icone, { nome: icone }),
    children
  ] });
  if (href) {
    return /* @__PURE__ */ jsx4("a", { ref, className: classes, href, ...resto, children: conteudo });
  }
  return /* @__PURE__ */ jsx4("button", { ref, type, className: classes, ...resto, children: conteudo });
});
var BotaoIcone = React.forwardRef(function BotaoIcone2({ rotulo, icone, className, ...resto }, ref) {
  return /* @__PURE__ */ jsx4("button", { ref, type: "button", className: cx("dst-botao-icone", className), "aria-label": rotulo, title: rotulo, ...resto, children: /* @__PURE__ */ jsx4(Icone, { nome: icone }) });
});
function BotaoEnviar({ rotulo = "Enviar", className, type = "button", ...resto }) {
  return /* @__PURE__ */ jsx4("button", { type, className: cx("dst-botao-enviar", className), "aria-label": rotulo, ...resto, children: /* @__PURE__ */ jsx4(Icone, { nome: "enviar" }) });
}

// src/components/Seletor/Seletor.tsx
import React2 from "react";
import { jsx as jsx5, jsxs as jsxs3 } from "react/jsx-runtime";
var Seletor = React2.forwardRef(function Seletor2({ valor, complemento, icone, agente, aberto, className, ...resto }, ref) {
  return /* @__PURE__ */ jsxs3("button", { ref, type: "button", className: cx("dst-seletor", className), "aria-haspopup": "menu", "aria-expanded": aberto, ...resto, children: [
    agente ? /* @__PURE__ */ jsx5(LogoDoAgente, { agente }) : icone && /* @__PURE__ */ jsx5(Icone, { nome: icone }),
    /* @__PURE__ */ jsxs3("span", { children: [
      valor,
      complemento && /* @__PURE__ */ jsxs3("span", { className: "dst-seletor__complemento", children: [
        " ",
        complemento
      ] })
    ] }),
    /* @__PURE__ */ jsx5(Icone, { nome: "baixo", className: "dst-seletor__seta" })
  ] });
});

// src/components/Segmentado/Segmentado.tsx
import { jsx as jsx6, jsxs as jsxs4 } from "react/jsx-runtime";
function Segmentado({ opcoes, valor, aoMudar, rotulo, forma = "padrao", className }) {
  return /* @__PURE__ */ jsx6("div", { className: cx("dst-segmentado", `dst-segmentado--${forma}`, className), role: "group", "aria-label": rotulo, children: opcoes.map((opcao) => /* @__PURE__ */ jsxs4(
    "button",
    {
      type: "button",
      "aria-pressed": opcao.valor === valor,
      title: opcao.soIcone ? opcao.rotulo : void 0,
      onClick: () => aoMudar(opcao.valor),
      children: [
        opcao.icone && /* @__PURE__ */ jsx6(Icone, { nome: opcao.icone }),
        /* @__PURE__ */ jsx6("span", { className: cx(opcao.soIcone && "dst-sr"), children: opcao.rotulo })
      ]
    },
    opcao.valor
  )) });
}

// src/components/Pilula/Pilula.tsx
import { Fragment as Fragment3, jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";
function Pilula({ tom, icone, className, children }) {
  return /* @__PURE__ */ jsxs5("span", { className: cx("dst-pilula", `dst-pilula--${tom}`, className), children: [
    icone && /* @__PURE__ */ jsx7(Icone, { nome: icone }),
    children
  ] });
}
var IMPACTO = {
  alto: { rotulo: "Alto", icone: "alerta" },
  medio: { rotulo: "M\xE9dio", icone: "impMedio" },
  baixo: { rotulo: "Baixo", icone: "impBaixo" }
};
function PilulaDeImpacto({ nivel, rotulo, className }) {
  const { rotulo: padrao, icone } = IMPACTO[nivel];
  return /* @__PURE__ */ jsx7(Pilula, { tom: nivel, icone, className, children: rotulo ?? padrao });
}
var PALAVRA = { sobe: "Alta de", desce: "Queda de", igual: "" };
function Tendencia({ direcao, valor, comparacao = "Comparado aos 90 dias anteriores", className }) {
  return /* @__PURE__ */ jsxs5("span", { className: cx("dst-tendencia", `dst-tendencia--${direcao}`, className), title: comparacao, children: [
    /* @__PURE__ */ jsx7(Icone, { nome: direcao }),
    direcao === "igual" ? "est\xE1vel" : /* @__PURE__ */ jsxs5(Fragment3, { children: [
      /* @__PURE__ */ jsxs5("span", { className: "dst-sr", children: [
        PALAVRA[direcao],
        " "
      ] }),
      valor
    ] })
  ] });
}

// src/components/ChipDeFonte/ChipDeFonte.tsx
import { jsx as jsx8, jsxs as jsxs6 } from "react/jsx-runtime";
var FONTES = {
  likert: { nome: "Likert", icone: "likert" },
  voz: { nome: "Voz do Cliente", icone: "voz" },
  fullstory: { nome: "FullStory", icone: "fullstory" }
};
function ChipDeFonte({ fonte, tamanho = "p", anunciar = false, className }) {
  return /* @__PURE__ */ jsx8(
    "span",
    {
      className: cx("dst-chip-fonte", `dst-chip-fonte--${fonte}`, tamanho !== "p" && `dst-chip-fonte--${tamanho}`, className),
      role: anunciar ? "img" : void 0,
      "aria-label": anunciar ? FONTES[fonte].nome : void 0,
      "aria-hidden": anunciar ? void 0 : true,
      children: /* @__PURE__ */ jsx8(Icone, { nome: FONTES[fonte].icone })
    }
  );
}
function ChipDeDor({ fonte, titulo, aoRemover, rotuloRemover = "Tirar a cita\xE7\xE3o", className }) {
  return /* @__PURE__ */ jsxs6("span", { className: cx("dst-chip-dor", className), title: titulo, children: [
    /* @__PURE__ */ jsx8(ChipDeFonte, { fonte }),
    /* @__PURE__ */ jsx8("span", { className: "dst-chip-dor__texto", children: titulo }),
    aoRemover && /* @__PURE__ */ jsx8("button", { type: "button", className: "dst-chip-dor__remover", "aria-label": `${rotuloRemover}: ${titulo}`, onClick: aoRemover, children: /* @__PURE__ */ jsx8(Icone, { nome: "fechar" }) })
  ] });
}

// src/components/SeloExemplo/SeloExemplo.tsx
import { jsx as jsx9 } from "react/jsx-runtime";
function SeloExemplo({ forma = "pill", texto = "Dados de exemplo", className }) {
  return /* @__PURE__ */ jsx9("span", { className: cx("dst-selo-exemplo", `dst-selo-exemplo--${forma}`, className), children: texto });
}

// src/components/CampoDoChat/CampoDoChat.tsx
import { useId } from "react";
import { jsx as jsx10, jsxs as jsxs7 } from "react/jsx-runtime";
function CampoDoChat({
  valor,
  aoMudar,
  aoEnviar,
  citacoes = [],
  aoRemoverCitacao,
  seletores,
  agente,
  aoAnexar,
  aoGravar,
  gravando = false,
  placeholder = "Pe\xE7a uma mudan\xE7a, cite uma Dor com @\u2026",
  rotulo = "Mensagem para o agente",
  tamanho = "inicio",
  className
}) {
  const id = useId();
  const podeEnviar = valor.trim().length > 0 || citacoes.length > 0;
  const enviar = () => {
    if (podeEnviar) aoEnviar({ texto: valor.trim(), citacoes });
  };
  return /* @__PURE__ */ jsxs7("div", { className: cx("dst-campo-chat", tamanho === "compacto" && "dst-campo-chat--compacto", className), children: [
    citacoes.length > 0 && /* @__PURE__ */ jsx10("div", { className: "dst-campo-chat__contexto", children: citacoes.map((c) => /* @__PURE__ */ jsx10(ChipDeDor, { fonte: c.fonte, titulo: c.titulo, aoRemover: aoRemoverCitacao ? () => aoRemoverCitacao(c.id) : void 0 }, c.id)) }),
    /* @__PURE__ */ jsx10("label", { className: "dst-sr", htmlFor: id, children: rotulo }),
    /* @__PURE__ */ jsx10(
      "textarea",
      {
        id,
        className: "dst-campo-chat__texto",
        value: valor,
        placeholder,
        rows: 2,
        onChange: (e) => aoMudar(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviar();
          }
        }
      }
    ),
    /* @__PURE__ */ jsxs7("div", { className: "dst-campo-chat__barra", children: [
      aoAnexar && /* @__PURE__ */ jsx10("button", { type: "button", className: "dst-campo-chat__redondo", "aria-label": "Anexar arquivo ou print", title: "Anexar arquivo ou print", onClick: aoAnexar, children: /* @__PURE__ */ jsx10(Icone, { nome: "mais" }) }),
      seletores,
      /* @__PURE__ */ jsx10("span", { className: "dst-campo-chat__espaco" }),
      agente,
      aoGravar && /* @__PURE__ */ jsx10(
        "button",
        {
          type: "button",
          className: cx("dst-campo-chat__redondo", gravando && "dst-campo-chat__redondo--gravando"),
          "aria-label": gravando ? "Parar de gravar" : "Falar com o agente",
          "aria-pressed": gravando,
          onClick: aoGravar,
          children: /* @__PURE__ */ jsx10(Icone, { nome: gravando ? "parar" : "mic" })
        }
      ),
      /* @__PURE__ */ jsx10(BotaoEnviar, { disabled: !podeEnviar, onClick: enviar })
    ] })
  ] });
}

// src/components/Lateral/Lateral.tsx
import { Fragment as Fragment4, jsx as jsx11, jsxs as jsxs8 } from "react/jsx-runtime";
function Item({ item, atual, aoNavegar, classe, recolhida }) {
  const props = {
    className: classe,
    "aria-current": item.id === atual ? "page" : void 0,
    title: item.rotulo,
    onClick: aoNavegar ? () => aoNavegar(item.id) : void 0
  };
  const conteudo = /* @__PURE__ */ jsxs8(Fragment4, { children: [
    /* @__PURE__ */ jsx11(Icone, { nome: item.icone }),
    /* @__PURE__ */ jsx11("span", { className: cx(recolhida && "dst-sr"), children: item.rotulo })
  ] });
  return item.href ? /* @__PURE__ */ jsx11("a", { href: item.href, ...props, children: conteudo }) : /* @__PURE__ */ jsx11("button", { type: "button", ...props, children: conteudo });
}
function Lateral({
  itens,
  atual,
  aoNavegar,
  novo,
  recentes = [],
  rodape = [],
  tema,
  aoMudarTema,
  conta,
  exemplo = true,
  recolhida = false,
  aoRecolher,
  className
}) {
  return /* @__PURE__ */ jsxs8("aside", { className: cx("dst-lateral", recolhida && "dst-lateral--recolhida", className), "aria-label": "Navega\xE7\xE3o", children: [
    /* @__PURE__ */ jsxs8("div", { className: "dst-lateral__topo", children: [
      /* @__PURE__ */ jsx11(Marca, { href: "#", soSinal: recolhida }),
      aoRecolher && /* @__PURE__ */ jsx11(BotaoIcone, { rotulo: recolhida ? "Abrir a barra lateral" : "Recolher a barra lateral", icone: "lateral", onClick: aoRecolher })
    ] }),
    novo && (novo.href ? /* @__PURE__ */ jsxs8("a", { className: "dst-lateral__novo", href: novo.href, onClick: novo.aoClicar, title: novo.rotulo, children: [
      /* @__PURE__ */ jsx11(Icone, { nome: "novo" }),
      /* @__PURE__ */ jsx11("span", { className: cx(recolhida && "dst-sr"), children: novo.rotulo })
    ] }) : /* @__PURE__ */ jsxs8("button", { type: "button", className: "dst-lateral__novo", onClick: novo.aoClicar, title: novo.rotulo, children: [
      /* @__PURE__ */ jsx11(Icone, { nome: "novo" }),
      /* @__PURE__ */ jsx11("span", { className: cx(recolhida && "dst-sr"), children: novo.rotulo })
    ] })),
    /* @__PURE__ */ jsx11("nav", { className: "dst-lateral__nav", children: itens.map((item) => /* @__PURE__ */ jsx11(Item, { item, atual, aoNavegar, classe: "dst-lateral__item", recolhida }, item.id)) }),
    recentes.length > 0 && !recolhida && /* @__PURE__ */ jsxs8("div", { className: "dst-lateral__secao", children: [
      /* @__PURE__ */ jsx11("p", { className: "dst-lateral__rotulo", children: "Recentes" }),
      /* @__PURE__ */ jsx11("div", { className: "dst-lateral__recentes", children: recentes.map((r) => {
        const corpo = /* @__PURE__ */ jsxs8(Fragment4, { children: [
          /* @__PURE__ */ jsx11("span", { className: "dst-lateral__rec-ic", children: /* @__PURE__ */ jsx11(Icone, { nome: r.icone }) }),
          /* @__PURE__ */ jsxs8("span", { className: "dst-lateral__rec-txt", children: [
            /* @__PURE__ */ jsx11("b", { children: r.titulo }),
            /* @__PURE__ */ jsx11("small", { children: r.subtitulo })
          ] })
        ] });
        const props = { className: "dst-lateral__recente", "aria-current": r.id === atual ? "page" : void 0, onClick: aoNavegar ? () => aoNavegar(r.id) : void 0 };
        return r.href ? /* @__PURE__ */ jsx11("a", { href: r.href, ...props, children: corpo }, r.id) : /* @__PURE__ */ jsx11("button", { type: "button", ...props, children: corpo }, r.id);
      }) })
    ] }),
    /* @__PURE__ */ jsxs8("div", { className: "dst-lateral__rodape", children: [
      tema && aoMudarTema && /* @__PURE__ */ jsx11(
        Segmentado,
        {
          forma: "pill",
          rotulo: "Tema",
          valor: tema,
          aoMudar: aoMudarTema,
          className: "dst-lateral__tema",
          opcoes: [
            { valor: "claro", rotulo: "Tema claro", icone: "sol", soIcone: true },
            { valor: "escuro", rotulo: "Tema escuro", icone: "lua", soIcone: true }
          ]
        }
      ),
      rodape.map((item) => /* @__PURE__ */ jsx11(Item, { item, atual, aoNavegar, classe: "dst-lateral__item", recolhida }, item.id)),
      conta && /* @__PURE__ */ jsxs8("div", { className: "dst-lateral__conta", children: [
        /* @__PURE__ */ jsx11("span", { className: "dst-lateral__avatar", "aria-hidden": "true", children: conta.iniciais }),
        /* @__PURE__ */ jsxs8("span", { className: cx("dst-lateral__rec-txt", recolhida && "dst-sr"), children: [
          /* @__PURE__ */ jsx11("b", { children: conta.nome }),
          /* @__PURE__ */ jsx11("small", { children: conta.papel })
        ] })
      ] }),
      exemplo && /* @__PURE__ */ jsx11(SeloExemplo, { forma: "linha", className: cx(recolhida && "dst-lateral__exemplo--recolhido") })
    ] })
  ] });
}

// src/components/AbasDeProposta/AbasDeProposta.tsx
import { useRef } from "react";
import { jsx as jsx12, jsxs as jsxs9 } from "react/jsx-runtime";
function AbasDeProposta({ propostas, selecionada, aoSelecionar, aoCriar, className }) {
  const lista = useRef(null);
  const mover = (e, indice) => {
    const n = propostas.length;
    const alvo = e.key === "ArrowRight" ? (indice + 1) % n : e.key === "ArrowLeft" ? (indice - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (alvo < 0) return;
    e.preventDefault();
    const proposta = propostas[alvo];
    aoSelecionar(proposta.id);
    lista.current?.querySelectorAll("[role='tab']")[alvo]?.focus();
  };
  return /* @__PURE__ */ jsxs9("div", { className: cx("dst-abas-proposta", className), children: [
    /* @__PURE__ */ jsx12("div", { ref: lista, className: "dst-abas-proposta__lista", role: "tablist", "aria-label": "Propostas", children: propostas.map((p, i) => /* @__PURE__ */ jsxs9(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": p.id === selecionada,
        tabIndex: p.id === selecionada ? 0 : -1,
        title: p.descricao,
        className: cx("dst-abas-proposta__aba", p.estado === "descartada" && "dst-abas-proposta__aba--descartada"),
        onClick: () => aoSelecionar(p.id),
        onKeyDown: (e) => mover(e, i),
        children: [
          p.estado === "ativa" && /* @__PURE__ */ jsx12("span", { className: "dst-abas-proposta__ponto", "aria-hidden": "true" }),
          /* @__PURE__ */ jsx12("span", { children: p.nome }),
          p.estado === "ativa" && /* @__PURE__ */ jsx12("span", { className: "dst-sr", children: " (ativa)" }),
          p.estado === "descartada" && /* @__PURE__ */ jsx12("span", { className: "dst-sr", children: " (descartada)" })
        ]
      },
      p.id
    )) }),
    aoCriar && /* @__PURE__ */ jsxs9("button", { type: "button", className: "dst-abas-proposta__nova", onClick: aoCriar, children: [
      /* @__PURE__ */ jsx12(Icone, { nome: "mais" }),
      "Nova"
    ] })
  ] });
}

// src/components/BarraDeFerramentas/BarraDeFerramentas.tsx
import { jsx as jsx13, jsxs as jsxs10 } from "react/jsx-runtime";
function BarraFlutuante({ rotulo, className, children }) {
  const andar = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const botoes = [...e.currentTarget.querySelectorAll("button:not(:disabled)")];
    const i = botoes.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const proximo = e.key === "ArrowRight" ? (i + 1) % botoes.length : (i - 1 + botoes.length) % botoes.length;
    botoes[proximo]?.focus();
  };
  return /* @__PURE__ */ jsx13("div", { className: cx("dst-barra-flutuante", className), role: "toolbar", "aria-label": rotulo, onKeyDown: andar, children });
}
function Ferramenta({ icone, rotulo, pressionada, destaque = false, soIcone = false, className, ...resto }) {
  return /* @__PURE__ */ jsxs10(
    "button",
    {
      type: "button",
      className: cx("dst-ferramenta", destaque && "dst-ferramenta--destaque", className),
      "aria-pressed": pressionada,
      title: rotulo,
      ...resto,
      children: [
        /* @__PURE__ */ jsx13(Icone, { nome: icone }),
        /* @__PURE__ */ jsx13("span", { className: cx(soIcone && "dst-sr"), children: rotulo })
      ]
    }
  );
}
function SeparadorDeFerramenta() {
  return /* @__PURE__ */ jsx13("span", { className: "dst-ferramenta-sep", "aria-hidden": "true" });
}

// src/components/NotaAutoadesiva/NotaAutoadesiva.tsx
import { Fragment as Fragment5, jsx as jsx14, jsxs as jsxs11 } from "react/jsx-runtime";
var NOME_DO_IMPACTO = { alto: "Alto", medio: "M\xE9dio", baixo: "Baixo" };
function NotaAutoadesiva({
  fonte,
  titulo,
  volume,
  impacto,
  tendencia,
  giro = 0,
  marcada = false,
  aoClicar,
  descricao,
  tamanho = "normal",
  className
}) {
  const r = Math.max(-1.8, Math.min(1.8, giro));
  const classes = cx("dst-nota", `dst-nota--${fonte}`, tamanho === "grande" && "dst-nota--grande", className);
  const corpo = /* @__PURE__ */ jsxs11(Fragment5, { children: [
    /* @__PURE__ */ jsx14("span", { className: "dst-nota__check", "aria-hidden": "true", children: /* @__PURE__ */ jsx14(Icone, { nome: "ok" }) }),
    /* @__PURE__ */ jsxs11("span", { className: "dst-nota__fonte", children: [
      /* @__PURE__ */ jsx14(ChipDeFonte, { fonte }),
      /* @__PURE__ */ jsxs11("span", { className: "dst-sr", children: [
        FONTES[fonte].nome,
        ": "
      ] })
    ] }),
    /* @__PURE__ */ jsx14("span", { className: "dst-nota__titulo", children: titulo }),
    (volume || impacto || tendencia) && /* @__PURE__ */ jsxs11("span", { className: "dst-nota__pe", children: [
      volume && /* @__PURE__ */ jsxs11("span", { className: "dst-nota__volume", children: [
        /* @__PURE__ */ jsx14(Icone, { nome: FONTES[fonte].icone }),
        /* @__PURE__ */ jsx14("span", { children: volume })
      ] }),
      impacto && /* @__PURE__ */ jsxs11("span", { className: cx("dst-nota__impacto", `dst-nota__impacto--${impacto}`), children: [
        /* @__PURE__ */ jsx14("span", { className: "dst-sr", children: "Impacto " }),
        NOME_DO_IMPACTO[impacto]
      ] }),
      tendencia && /* @__PURE__ */ jsx14(Tendencia, { direcao: tendencia.direcao, valor: tendencia.valor })
    ] })
  ] });
  const estilo = { "--r": `${r}deg` };
  return aoClicar ? /* @__PURE__ */ jsx14("button", { type: "button", className: classes, style: estilo, title: descricao, "aria-pressed": marcada, onClick: aoClicar, children: corpo }) : /* @__PURE__ */ jsx14("div", { className: classes, style: estilo, title: descricao, children: corpo });
}

// src/components/MolduraDeAparelho/MolduraDeAparelho.tsx
import { useId as useId2 } from "react";
import { jsx as jsx15, jsxs as jsxs12 } from "react/jsx-runtime";
function Esqueleto() {
  return /* @__PURE__ */ jsxs12("div", { className: "dst-moldura__esqueleto", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx15("i", { style: { width: "55%" } }),
    /* @__PURE__ */ jsx15("i", { className: "dst-moldura__esqueleto-alto" }),
    /* @__PURE__ */ jsx15("i", {}),
    /* @__PURE__ */ jsx15("i", { style: { width: "80%" } }),
    /* @__PURE__ */ jsx15("i", { className: "dst-moldura__esqueleto-alto" }),
    /* @__PURE__ */ jsx15("i", { style: { width: "40%" } })
  ] });
}
function MolduraDeAparelho({
  nome,
  emFoco = false,
  estado = "pronto",
  legenda,
  dispositivo = "celular",
  url = "prototipo.local",
  realce = false,
  children,
  className
}) {
  const id = useId2();
  const tela = estado === "criando" ? /* @__PURE__ */ jsx15(Esqueleto, {}) : children;
  const fila = estado === "na-fila";
  return /* @__PURE__ */ jsxs12(
    "figure",
    {
      className: cx("dst-moldura", `dst-moldura--${estado}`, realce && "dst-moldura--realce", className),
      "aria-busy": estado === "criando" || void 0,
      "aria-labelledby": id,
      children: [
        /* @__PURE__ */ jsxs12("figcaption", { id, className: "dst-moldura__rotulo", children: [
          /* @__PURE__ */ jsx15("b", { children: nome }),
          legenda ? /* @__PURE__ */ jsx15("span", { children: legenda }) : fila ? /* @__PURE__ */ jsx15("span", { children: "na fila" }) : emFoco ? /* @__PURE__ */ jsx15("span", { className: "dst-moldura__em-foco", children: "\xB7 em foco" }) : null
        ] }),
        dispositivo === "celular" ? /* @__PURE__ */ jsx15("div", { className: "dst-moldura__aparelho", children: /* @__PURE__ */ jsx15("div", { className: "dst-moldura__tela", children: tela }) }) : /* @__PURE__ */ jsxs12("div", { className: "dst-moldura__janela", children: [
          /* @__PURE__ */ jsxs12("div", { className: "dst-moldura__janela-barra", "aria-hidden": "true", children: [
            /* @__PURE__ */ jsx15("i", {}),
            /* @__PURE__ */ jsx15("i", {}),
            /* @__PURE__ */ jsx15("i", {}),
            /* @__PURE__ */ jsx15("span", { children: url })
          ] }),
          /* @__PURE__ */ jsx15("div", { className: "dst-moldura__tela dst-moldura__tela--janela", children: tela })
        ] })
      ]
    }
  );
}

// src/components/CursorDoAgente/CursorDoAgente.tsx
import { jsx as jsx16, jsxs as jsxs13 } from "react/jsx-runtime";
function CursorDoAgente({ nome, x = 0, y = 0, visivel = true, className }) {
  return /* @__PURE__ */ jsxs13("div", { className: cx("dst-cursor-agente", !visivel && "dst-cursor-agente--oculto", className), "aria-hidden": "true", style: { transform: `translate(${x}px, ${y}px)` }, children: [
    /* @__PURE__ */ jsx16("svg", { viewBox: "0 0 24 24", focusable: "false", children: /* @__PURE__ */ jsx16("path", { d: "M4 3l15 7-6.6 2.1L10 19z", fill: "var(--acento)", stroke: "#fff", strokeWidth: "1.6", strokeLinejoin: "round" }) }),
    /* @__PURE__ */ jsx16("span", { children: nome })
  ] });
}

// src/components/PainelFlutuante/PainelFlutuante.tsx
import { jsx as jsx17, jsxs as jsxs14 } from "react/jsx-runtime";
function PainelFlutuante({ rotulo, icone, titulo, subtitulo, aoFechar, rodape, className, style, children }) {
  return /* @__PURE__ */ jsxs14("section", { className: cx("dst-painel-flutuante", className), role: "dialog", "aria-label": rotulo, style, children: [
    /* @__PURE__ */ jsxs14("div", { className: "dst-painel-flutuante__cab", children: [
      icone && /* @__PURE__ */ jsx17(Icone, { nome: icone }),
      /* @__PURE__ */ jsxs14("strong", { children: [
        titulo,
        subtitulo && /* @__PURE__ */ jsx17("small", { children: subtitulo })
      ] }),
      aoFechar && /* @__PURE__ */ jsx17(BotaoIcone, { rotulo: "Fechar", icone: "fechar", onClick: aoFechar })
    ] }),
    /* @__PURE__ */ jsx17("div", { className: "dst-painel-flutuante__corpo", children }),
    rodape && /* @__PURE__ */ jsx17("div", { className: "dst-painel-flutuante__pe", children: rodape })
  ] });
}
function LinhaDoPainel({ rotulo, children }) {
  return /* @__PURE__ */ jsxs14("div", { className: "dst-painel-flutuante__linha", children: [
    /* @__PURE__ */ jsx17("span", { children: rotulo }),
    children
  ] });
}
function Sugestoes({ opcoes, valor, aoMudar, rotulo }) {
  return /* @__PURE__ */ jsx17("div", { className: "dst-sugestoes", role: "group", "aria-label": rotulo, children: opcoes.map((o) => /* @__PURE__ */ jsx17("button", { type: "button", "aria-pressed": o.valor === valor, onClick: () => aoMudar(o.valor), children: o.rotulo }, o.valor)) });
}
function NavegacaoDeVariantes({ atual, total, nome, aoAnterior, aoProxima }) {
  const uma = total < 2;
  return /* @__PURE__ */ jsxs14("div", { className: "dst-variantes", children: [
    /* @__PURE__ */ jsx17(BotaoIcone, { rotulo: "Variante anterior", icone: "esq", onClick: aoAnterior, disabled: uma }),
    /* @__PURE__ */ jsxs14("strong", { role: "status", children: [
      "Variante ",
      atual,
      " de ",
      total,
      /* @__PURE__ */ jsx17("span", { children: nome })
    ] }),
    /* @__PURE__ */ jsx17(BotaoIcone, { rotulo: "Pr\xF3xima Variante", icone: "dir", onClick: aoProxima, disabled: uma })
  ] });
}

// src/components/Inserir/Inserir.tsx
import { jsx as jsx18 } from "react/jsx-runtime";
function MiraDeInsercao({ rotulo, topo, esquerda, largura, className }) {
  return /* @__PURE__ */ jsx18("div", { className: cx("dst-mira", className), style: { top: topo, left: esquerda, width: largura }, "aria-hidden": "true", children: /* @__PURE__ */ jsx18("span", { children: rotulo }) });
}
function VagaDeInsercao({ tamanho = "m", gerando = false, children, className }) {
  return /* @__PURE__ */ jsx18("div", { className: cx("dst-vaga", `dst-vaga--${tamanho}`, gerando && "dst-vaga--gerando", className), role: "status", "aria-busy": gerando || void 0, children });
}
function PreviaDeInsercao({ children, className }) {
  return /* @__PURE__ */ jsx18("div", { className: cx("dst-previa", className), children });
}

// src/components/MensagemDoAgente/MensagemDoAgente.tsx
import { Fragment as Fragment6, jsx as jsx19, jsxs as jsxs15 } from "react/jsx-runtime";
function MensagemDoAgente({
  agente,
  nome = marcasDosAgentes[agente].nome,
  modelo,
  hora,
  children,
  carimbo,
  acoes = [],
  pontoDeRestauracao,
  aoAbrirPonto,
  className
}) {
  const ponto = pontoDeRestauracao && /* @__PURE__ */ jsxs15(Fragment6, { children: [
    /* @__PURE__ */ jsx19(Icone, { nome: "historico" }),
    "Ponto de restaura\xE7\xE3o \xB7 ",
    pontoDeRestauracao
  ] });
  return /* @__PURE__ */ jsxs15("article", { className: cx("dst-msg", className), "aria-label": `${nome}, ${hora}`, children: [
    /* @__PURE__ */ jsxs15("div", { className: "dst-msg__cab", children: [
      /* @__PURE__ */ jsx19(LogoDoAgente, { agente }),
      /* @__PURE__ */ jsx19("b", { children: nome }),
      modelo && /* @__PURE__ */ jsx19("span", { className: "dst-msg__modelo", children: modelo }),
      /* @__PURE__ */ jsx19("span", { className: "dst-msg__hora", children: hora })
    ] }),
    /* @__PURE__ */ jsx19("div", { className: "dst-msg__texto", children }),
    carimbo && /* @__PURE__ */ jsxs15("span", { className: "dst-msg__carimbo", children: [
      /* @__PURE__ */ jsx19(Icone, { nome: "ok" }),
      carimbo
    ] }),
    acoes.length > 0 && /* @__PURE__ */ jsx19("ul", { className: "dst-msg__acoes", "aria-label": "O que o agente fez", children: acoes.map((a) => /* @__PURE__ */ jsxs15("li", { children: [
      /* @__PURE__ */ jsx19(Icone, { nome: "ok" }),
      a
    ] }, a)) }),
    ponto && (aoAbrirPonto ? /* @__PURE__ */ jsx19("button", { type: "button", className: "dst-msg__ponto", onClick: aoAbrirPonto, children: ponto }) : /* @__PURE__ */ jsx19("span", { className: "dst-msg__ponto", children: ponto }))
  ] });
}

// src/components/MensagemDaPessoa/MensagemDaPessoa.tsx
import { jsx as jsx20, jsxs as jsxs16 } from "react/jsx-runtime";
function MensagemDaPessoa({ hora, origem, children, selecao, citacoes = [], className }) {
  return /* @__PURE__ */ jsxs16("article", { className: cx("dst-msg-pessoa", className), "aria-label": `Voc\xEA, ${hora}`, children: [
    selecao ? /* @__PURE__ */ jsxs16("div", { className: "dst-msg-pessoa__selecao", children: [
      /* @__PURE__ */ jsx20(Icone, { nome: selecao.icone ?? "inserir" }),
      /* @__PURE__ */ jsxs16("span", { children: [
        /* @__PURE__ */ jsx20("b", { children: selecao.elemento }),
        selecao.pedido && /* @__PURE__ */ jsx20("small", { children: selecao.pedido })
      ] })
    ] }) : /* @__PURE__ */ jsx20("div", { className: "dst-msg-pessoa__bolha", children }),
    citacoes.length > 0 && /* @__PURE__ */ jsx20("div", { className: "dst-msg-pessoa__citas", children: citacoes.map((c) => /* @__PURE__ */ jsx20(ChipDeDor, { fonte: c.fonte, titulo: c.titulo }, c.titulo)) }),
    /* @__PURE__ */ jsx20("span", { className: "dst-msg-pessoa__hora", children: origem ? `${origem} \xB7 ${hora}` : hora })
  ] });
}

// src/components/CartaoDeRevisao/CartaoDeRevisao.tsx
import { jsx as jsx21, jsxs as jsxs17 } from "react/jsx-runtime";
function CartaoDeRevisao({ titulo, achados, className }) {
  return /* @__PURE__ */ jsxs17("section", { className: cx("dst-revisao", className), "aria-label": titulo, children: [
    /* @__PURE__ */ jsx21("p", { className: "dst-revisao__titulo", children: titulo }),
    /* @__PURE__ */ jsx21("ul", { className: "dst-revisao__achados", children: achados.map((a) => /* @__PURE__ */ jsxs17("li", { className: "dst-revisao__achado", children: [
      a.nivel === "resolvido" ? /* @__PURE__ */ jsx21(Pilula, { tom: "ok", icone: "ok", children: "Resolvido" }) : /* @__PURE__ */ jsx21(PilulaDeImpacto, { nivel: a.nivel }),
      /* @__PURE__ */ jsx21("span", { children: a.texto })
    ] }, a.texto)) })
  ] });
}

// src/components/Toast/Toast.tsx
import { jsx as jsx22, jsxs as jsxs18 } from "react/jsx-runtime";
function Toast({ children, icone = "ok", saindo = false, className }) {
  return /* @__PURE__ */ jsxs18("div", { className: cx("dst-toast", saindo && "dst-toast--saindo", className), role: "status", children: [
    /* @__PURE__ */ jsx22(Icone, { nome: icone }),
    /* @__PURE__ */ jsx22("span", { children })
  ] });
}

// src/components/BarraDeProgresso/BarraDeProgresso.tsx
import { jsx as jsx23 } from "react/jsx-runtime";
function BarraDeProgresso({ valor, rotulo, className }) {
  const pct = Math.round(Math.max(0, Math.min(1, valor)) * 100);
  return /* @__PURE__ */ jsx23("div", { className: cx("dst-progresso", className), role: "progressbar", "aria-label": rotulo, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": pct, children: /* @__PURE__ */ jsx23("i", { style: { width: `${pct}%` } }) });
}

// src/components/Painel/Painel.tsx
import { jsx as jsx24, jsxs as jsxs19 } from "react/jsx-runtime";
function Painel({ titulo, subtitulo, acao, como = "section", idDoTitulo, className, children }) {
  const Elemento = como;
  return /* @__PURE__ */ jsxs19(Elemento, { className: cx("dst-painel", className), "aria-labelledby": titulo && idDoTitulo ? idDoTitulo : void 0, children: [
    (titulo || acao) && /* @__PURE__ */ jsxs19("div", { className: "dst-painel__cab", children: [
      /* @__PURE__ */ jsxs19("div", { children: [
        titulo && /* @__PURE__ */ jsx24("h2", { id: idDoTitulo, children: titulo }),
        subtitulo && /* @__PURE__ */ jsx24("p", { children: subtitulo })
      ] }),
      acao
    ] }),
    children
  ] });
}

// src/components/FiltroDeGraficos/FiltroDeGraficos.tsx
import { jsx as jsx25, jsxs as jsxs20 } from "react/jsx-runtime";
function FiltroDeGraficos({ periodos, periodo, aoMudarPeriodo, grupos, dor, aoMudarDor, aoLimpar, className }) {
  return /* @__PURE__ */ jsxs20("div", { className: cx("dst-filtro-graficos", className), role: "group", "aria-label": "Filtros dos gr\xE1ficos", children: [
    /* @__PURE__ */ jsx25(Segmentado, { rotulo: "Per\xEDodo", opcoes: periodos, valor: periodo, aoMudar: aoMudarPeriodo }),
    /* @__PURE__ */ jsxs20("label", { className: "dst-filtro-graficos__dor", children: [
      /* @__PURE__ */ jsx25("span", { children: "Dor" }),
      /* @__PURE__ */ jsxs20("select", { value: dor, onChange: (e) => aoMudarDor(e.target.value), children: [
        /* @__PURE__ */ jsx25("option", { value: "todas", children: "Todas as Dores" }),
        grupos.map((g) => /* @__PURE__ */ jsx25("optgroup", { label: g.rotulo, children: g.dores.map((d) => /* @__PURE__ */ jsx25("option", { value: d.id, children: d.titulo }, d.id)) }, g.rotulo))
      ] }),
      /* @__PURE__ */ jsx25(Icone, { nome: "baixo" })
    ] }),
    aoLimpar && dor !== "todas" && /* @__PURE__ */ jsx25(Botao, { variante: "terciario", icone: "fechar", onClick: aoLimpar, children: "Limpar filtro" })
  ] });
}

// src/components/GraficoDeBarras/GraficoDeBarras.tsx
import { useId as useId3, useState } from "react";

// src/utils/numeros.ts
var inteiro = new Intl.NumberFormat("pt-BR");
function formatarNumero(valor) {
  return inteiro.format(valor);
}
function porcentagem(parte, total) {
  return total > 0 ? Math.round(parte / total * 100) : 0;
}

// src/components/GraficoDeBarras/GraficoDeBarras.tsx
import { Fragment as Fragment7, jsx as jsx26, jsxs as jsxs21 } from "react/jsx-runtime";
function GraficoDeBarras({
  categorias,
  emFoco,
  recorte,
  aoFocar,
  titulo = "Dores por categoria",
  subtitulo = "Liga\xE7\xF5es no per\xEDodo. Toque numa categoria para destac\xE1-la.",
  unidade = "Liga\xE7\xF5es",
  className
}) {
  const id = useId3();
  const [tabela, setTabela] = useState(false);
  const soma = categorias.reduce((s, c) => s + c.volume, 0);
  const maximo = Math.max(1, ...categorias.map((c) => c.volume));
  const largura = (v) => `${(v / maximo * 74).toFixed(2)}%`;
  return /* @__PURE__ */ jsx26(
    Painel,
    {
      como: "figure",
      idDoTitulo: id,
      titulo,
      subtitulo,
      className: cx("dst-graf-barras", className),
      acao: /* @__PURE__ */ jsx26(Botao, { variante: "terciario", tamanho: "pequeno", icone: tabela ? "grafico" : "tabela", onClick: () => setTabela((t) => !t), children: tabela ? "Ver gr\xE1fico" : "Ver tabela" }),
      children: tabela ? /* @__PURE__ */ jsxs21("table", { className: "dst-graf-tabela", children: [
        /* @__PURE__ */ jsx26("caption", { className: "dst-sr", children: titulo }),
        /* @__PURE__ */ jsx26("thead", { children: /* @__PURE__ */ jsxs21("tr", { children: [
          /* @__PURE__ */ jsx26("th", { scope: "col", children: "Categoria" }),
          /* @__PURE__ */ jsx26("th", { scope: "col", className: "num", children: unidade }),
          /* @__PURE__ */ jsx26("th", { scope: "col", className: "num", children: "Participa\xE7\xE3o" }),
          /* @__PURE__ */ jsx26("th", { scope: "col", className: "num", children: "Dores" })
        ] }) }),
        /* @__PURE__ */ jsx26("tbody", { children: categorias.map((c) => /* @__PURE__ */ jsxs21("tr", { children: [
          /* @__PURE__ */ jsx26("th", { scope: "row", children: c.nome }),
          /* @__PURE__ */ jsx26("td", { className: "num", children: formatarNumero(c.volume) }),
          /* @__PURE__ */ jsxs21("td", { className: "num", children: [
            porcentagem(c.volume, soma),
            "%"
          ] }),
          /* @__PURE__ */ jsx26("td", { className: "num", children: c.dores ?? "\u2014" })
        ] }, c.id)) })
      ] }) : /* @__PURE__ */ jsxs21(Fragment7, { children: [
        /* @__PURE__ */ jsx26("div", { className: "dst-graf-barras__linhas", children: categorias.map((c) => {
          const enfase = c.id === emFoco;
          const partido = enfase && recorte && recorte.volume < c.volume;
          const valor = `${formatarNumero(c.volume)} \xB7 ${porcentagem(c.volume, soma)}%`;
          const conteudo = /* @__PURE__ */ jsxs21(Fragment7, { children: [
            /* @__PURE__ */ jsx26("span", { className: "dst-graf-barras__rotulo", children: c.nome }),
            /* @__PURE__ */ jsxs21("span", { className: "dst-graf-barras__trilho", children: [
              partido ? /* @__PURE__ */ jsxs21(Fragment7, { children: [
                /* @__PURE__ */ jsx26("span", { className: "dst-graf-barras__barra dst-graf-barras__barra--parte", style: { width: largura(recorte.volume) } }),
                /* @__PURE__ */ jsx26("span", { className: "dst-graf-barras__barra dst-graf-barras__barra--resto", style: { width: largura(c.volume - recorte.volume) } })
              ] }) : /* @__PURE__ */ jsx26("span", { className: "dst-graf-barras__barra", style: { width: largura(c.volume) } }),
              /* @__PURE__ */ jsx26("span", { className: "dst-graf-barras__valor", children: valor })
            ] })
          ] });
          const classe = cx("dst-graf-barras__linha", enfase && "dst-graf-barras__linha--enfase");
          return aoFocar ? /* @__PURE__ */ jsx26("button", { type: "button", className: classe, "aria-pressed": enfase, onClick: () => aoFocar(c.id), children: conteudo }, c.id) : /* @__PURE__ */ jsx26("div", { className: classe, children: conteudo }, c.id);
        }) }),
        recorte && /* @__PURE__ */ jsxs21("ul", { className: "dst-graf-legenda", children: [
          /* @__PURE__ */ jsxs21("li", { children: [
            /* @__PURE__ */ jsx26("i", { className: "dst-graf-chave dst-graf-chave--enfase", "aria-hidden": "true" }),
            recorte.rotulo
          ] }),
          /* @__PURE__ */ jsxs21("li", { children: [
            /* @__PURE__ */ jsx26("i", { className: "dst-graf-chave dst-graf-chave--lavada", "aria-hidden": "true" }),
            "Resto da categoria"
          ] })
        ] })
      ] })
    }
  );
}

// src/components/GraficoDeLinha/GraficoDeLinha.tsx
import { useId as useId4, useRef as useRef2, useState as useState3 } from "react";

// src/utils/escala.ts
function escalaBonita(maximo) {
  const bruto = Math.max(maximo, 1) / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(1, bruto))));
  const passo = ([1, 2, 2.5, 5, 10].find((m) => m * magnitude >= bruto) ?? 10) * magnitude;
  return { passo, topo: Math.max(passo, Math.ceil(maximo / passo) * passo) };
}
function passoDosRotulos(quantidade, larguraUtil) {
  return Math.max(1, Math.ceil(quantidade / Math.max(2, Math.floor(larguraUtil / 52))));
}

// src/utils/useLarguraDoConteiner.ts
import { useEffect, useState as useState2 } from "react";
function useLarguraDoConteiner(ref, fixa, padrao = 520) {
  const [medida, setMedida] = useState2(padrao);
  useEffect(() => {
    if (fixa !== void 0 || !ref.current || typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver((entradas) => {
      const largura = entradas[0]?.contentRect.width;
      if (largura && largura > 0) setMedida(Math.round(largura));
    });
    observador.observe(ref.current);
    return () => observador.disconnect();
  }, [ref, fixa]);
  return fixa ?? medida;
}

// src/components/GraficoDeLinha/GraficoDeLinha.tsx
import { Fragment as Fragment8, jsx as jsx27, jsxs as jsxs22 } from "react/jsx-runtime";
var ALTURA = 236;
var M = { e: 52, d: 64, t: 12, b: 30 };
function GraficoDeLinha({
  serie,
  nomeDaSerie,
  titulo = "Recorr\xEAncia semana a semana",
  subtitulo,
  unidade = "liga\xE7\xF5es",
  largura,
  className
}) {
  const id = useId4();
  const caixa = useRef2(null);
  const [tabela, setTabela] = useState3(false);
  const [sel, setSel] = useState3(null);
  const W = Math.max(280, useLarguraDoConteiner(caixa, largura));
  const n = serie.length;
  const pw = W - M.e - M.d;
  const ph = ALTURA - M.t - M.b;
  const { passo, topo } = escalaBonita(Math.max(0, ...serie.map((p) => p.valor)));
  const X = (i) => M.e + (n <= 1 ? pw / 2 : i / (n - 1) * pw);
  const Y = (v) => M.t + ph - v / topo * ph;
  const traco = serie.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.valor).toFixed(1)}`).join(" ");
  const area = n ? `${traco} L${X(n - 1).toFixed(1)} ${Y(0).toFixed(1)} L${X(0).toFixed(1)} ${Y(0).toFixed(1)} Z` : "";
  const ticks = [];
  for (let v = 0; v <= topo + 1e-3; v += passo) ticks.push(v);
  const passoX = passoDosRotulos(n, pw);
  const ultimo = serie[n - 1];
  const atual = sel === null ? null : serie[sel] ?? null;
  const mostrar = (i) => setSel(Math.max(0, Math.min(n - 1, i)));
  const teclas = (e) => {
    const base = sel ?? n - 1;
    const destino = e.key === "ArrowRight" ? base + 1 : e.key === "ArrowLeft" ? base - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (destino !== null) {
      e.preventDefault();
      mostrar(destino);
    } else if (e.key === "Escape") setSel(null);
  };
  const aoMover = (e) => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    if (!Number.isFinite(x) || n === 0) return;
    mostrar(Math.round((x - M.e) / pw * (n - 1)));
  };
  const contexto = (p) => p.total ? `${porcentagem(p.valor, p.total)}% das ${formatarNumero(p.total)} ${unidade} do Relat\xF3rio nesta semana` : null;
  const ctxAtual = atual ? contexto(atual) : null;
  const leitura = atual ? [`Semana de ${atual.rotulo}: ${formatarNumero(atual.valor)} ${unidade}, ${nomeDaSerie}.`, ctxAtual && `${ctxAtual}.`].filter(Boolean).join(" ") : "";
  const dicaEsquerda = sel === null ? 0 : X(sel) + 14 + 220 > W ? X(sel) - 14 - 220 : X(sel) + 14;
  return /* @__PURE__ */ jsx27(
    Painel,
    {
      como: "figure",
      idDoTitulo: id,
      titulo,
      subtitulo: subtitulo ?? `${nomeDaSerie}, semana a semana.`,
      className: cx("dst-graf-linha", className),
      acao: /* @__PURE__ */ jsx27(Botao, { variante: "terciario", tamanho: "pequeno", icone: tabela ? "grafico" : "tabela", onClick: () => setTabela((t) => !t), children: tabela ? "Ver gr\xE1fico" : "Ver tabela" }),
      children: tabela ? /* @__PURE__ */ jsxs22("table", { className: "dst-graf-tabela", children: [
        /* @__PURE__ */ jsx27("caption", { className: "dst-sr", children: titulo }),
        /* @__PURE__ */ jsx27("thead", { children: /* @__PURE__ */ jsxs22("tr", { children: [
          /* @__PURE__ */ jsx27("th", { scope: "col", children: "Semana de" }),
          /* @__PURE__ */ jsx27("th", { scope: "col", className: "num", children: nomeDaSerie }),
          /* @__PURE__ */ jsx27("th", { scope: "col", className: "num", children: "Todas as Dores" }),
          /* @__PURE__ */ jsx27("th", { scope: "col", className: "num", children: "Participa\xE7\xE3o" })
        ] }) }),
        /* @__PURE__ */ jsx27("tbody", { children: serie.map((p) => /* @__PURE__ */ jsxs22("tr", { children: [
          /* @__PURE__ */ jsx27("th", { scope: "row", children: p.rotulo }),
          /* @__PURE__ */ jsx27("td", { className: "num", children: formatarNumero(p.valor) }),
          /* @__PURE__ */ jsx27("td", { className: "num", children: p.total !== void 0 ? formatarNumero(p.total) : "\u2014" }),
          /* @__PURE__ */ jsx27("td", { className: "num", children: p.total ? `${porcentagem(p.valor, p.total)}%` : "\u2014" })
        ] }, p.rotulo)) })
      ] }) : /* @__PURE__ */ jsxs22(
        "div",
        {
          ref: caixa,
          className: "dst-graf-linha__caixa",
          tabIndex: 0,
          role: "group",
          "aria-label": `${nomeDaSerie}, ${n} semanas. Use as setas para ler semana a semana.`,
          onKeyDown: teclas,
          onFocus: () => sel === null && n > 0 && mostrar(n - 1),
          onBlur: () => setSel(null),
          onPointerMove: aoMover,
          onPointerLeave: () => setSel(null),
          children: [
            /* @__PURE__ */ jsxs22("svg", { width: W, height: ALTURA, viewBox: `0 0 ${W} ${ALTURA}`, "aria-hidden": "true", children: [
              ticks.map((v) => /* @__PURE__ */ jsxs22("g", { children: [
                /* @__PURE__ */ jsx27("line", { className: "dst-gl-grade", x1: M.e, x2: W - M.d, y1: Y(v), y2: Y(v) }),
                /* @__PURE__ */ jsx27("text", { className: "dst-gl-tick", x: M.e - 8, y: Y(v) + 4, textAnchor: "end", children: formatarNumero(v) })
              ] }, v)),
              /* @__PURE__ */ jsx27("line", { className: "dst-gl-eixo", x1: M.e, x2: W - M.d, y1: Y(0), y2: Y(0) }),
              serie.map(
                (p, i) => i % passoX === 0 ? /* @__PURE__ */ jsx27("text", { className: "dst-gl-tick", x: X(i), y: ALTURA - 8, textAnchor: "middle", children: p.rotulo }, p.rotulo) : null
              ),
              n > 0 && /* @__PURE__ */ jsx27("path", { className: "dst-gl-area", d: area }),
              n > 0 && /* @__PURE__ */ jsx27("path", { className: "dst-gl-linha", d: traco }),
              ultimo && /* @__PURE__ */ jsxs22(Fragment8, { children: [
                /* @__PURE__ */ jsx27("circle", { className: "dst-gl-ponto", cx: X(n - 1), cy: Y(ultimo.valor), r: 4 }),
                /* @__PURE__ */ jsx27("text", { className: "dst-gl-fim", x: X(n - 1) + 10, y: Y(ultimo.valor) + 4, children: formatarNumero(ultimo.valor) })
              ] }),
              atual && sel !== null && /* @__PURE__ */ jsxs22(Fragment8, { children: [
                /* @__PURE__ */ jsx27("line", { className: "dst-gl-cruz", x1: X(sel), x2: X(sel), y1: M.t, y2: Y(0) }),
                /* @__PURE__ */ jsx27("circle", { className: "dst-gl-ponto", cx: X(sel), cy: Y(atual.valor), r: 4 })
              ] })
            ] }),
            atual && /* @__PURE__ */ jsxs22("div", { className: "dst-graf-dica", style: { left: Math.max(0, dicaEsquerda), top: M.t + 6 }, "aria-hidden": "true", children: [
              /* @__PURE__ */ jsxs22("p", { className: "dst-graf-dica__titulo", children: [
                "Semana de ",
                atual.rotulo
              ] }),
              /* @__PURE__ */ jsxs22("p", { className: "dst-graf-dica__linha", children: [
                /* @__PURE__ */ jsx27("i", { className: "dst-graf-chave dst-graf-chave--linha" }),
                /* @__PURE__ */ jsx27("b", { children: formatarNumero(atual.valor) }),
                /* @__PURE__ */ jsx27("span", { children: nomeDaSerie })
              ] }),
              ctxAtual && /* @__PURE__ */ jsx27("p", { className: "dst-graf-dica__ctx", children: ctxAtual })
            ] }),
            /* @__PURE__ */ jsx27("p", { className: "dst-sr", "aria-live": "polite", children: leitura })
          ]
        }
      )
    }
  );
}

// src/components/Insight/Insight.tsx
import { jsx as jsx28, jsxs as jsxs23 } from "react/jsx-runtime";
function Insight({ titulo, numeros, agente, nomeDoAgente = marcasDosAgentes[agente].nome, children, proximoPasso, dores = [], acoes, foco = false, className }) {
  return /* @__PURE__ */ jsxs23("article", { className: cx("dst-insight", foco && "dst-insight--foco", className), "aria-label": titulo, children: [
    /* @__PURE__ */ jsxs23("div", { className: "dst-insight__lado", children: [
      /* @__PURE__ */ jsx28("h3", { children: titulo }),
      /* @__PURE__ */ jsx28("dl", { className: "dst-insight__numeros", children: numeros.map((n) => /* @__PURE__ */ jsxs23("div", { children: [
        /* @__PURE__ */ jsx28("dt", { children: n.rotulo }),
        /* @__PURE__ */ jsx28("dd", { children: n.valor })
      ] }, n.rotulo)) })
    ] }),
    /* @__PURE__ */ jsxs23("div", { className: "dst-insight__corpo", children: [
      /* @__PURE__ */ jsxs23("p", { className: "dst-insight__autor", children: [
        /* @__PURE__ */ jsx28(LogoDoAgente, { agente, tamanho: "pequeno" }),
        /* @__PURE__ */ jsx28("span", { children: nomeDoAgente })
      ] }),
      /* @__PURE__ */ jsx28("div", { className: "dst-insight__texto", children }),
      proximoPasso && /* @__PURE__ */ jsxs23("p", { className: "dst-insight__passo", children: [
        /* @__PURE__ */ jsx28("b", { children: "Pr\xF3ximo passo:" }),
        " ",
        proximoPasso
      ] }),
      dores.length > 0 && /* @__PURE__ */ jsx28("div", { className: "dst-insight__dores", children: dores.map((d) => /* @__PURE__ */ jsx28(ChipDeDor, { fonte: d.fonte, titulo: d.titulo }, d.titulo)) }),
      acoes && /* @__PURE__ */ jsx28("div", { className: "dst-insight__acoes", children: acoes })
    ] })
  ] });
}
function PainelDeInsights({ titulo = "Insights por categoria", subtitulo, children, className }) {
  return /* @__PURE__ */ jsx28(Painel, { titulo, subtitulo, idDoTitulo: "dst-insights-titulo", className: cx("dst-insights", className), children: /* @__PURE__ */ jsx28("div", { className: "dst-insights__lista", children }) });
}
export {
  AbasDeProposta,
  BarraDeProgresso,
  BarraFlutuante,
  Botao,
  BotaoEnviar,
  BotaoIcone,
  CampoDoChat,
  CartaoDeRevisao,
  ChipDeDor,
  ChipDeFonte,
  CursorDoAgente,
  FONTES,
  Ferramenta,
  FiltroDeGraficos,
  GraficoDeBarras,
  GraficoDeLinha,
  Icone,
  Insight,
  Lateral,
  LinhaDoPainel,
  LogoDoAgente,
  Marca,
  MensagemDaPessoa,
  MensagemDoAgente,
  MiraDeInsercao,
  MolduraDeAparelho,
  NavegacaoDeVariantes,
  NotaAutoadesiva,
  Painel,
  PainelDeInsights,
  PainelFlutuante,
  Pilula,
  PilulaDeImpacto,
  PreviaDeInsercao,
  Segmentado,
  Seletor,
  SeloExemplo,
  SeparadorDeFerramenta,
  Sinal,
  Sugestoes,
  Tendencia,
  Toast,
  VagaDeInsercao,
  arquivosDeFonte,
  corNoTema,
  cores,
  curva,
  cx,
  escalaBonita,
  espacos,
  estilosDeTexto,
  excecoesDeContraste,
  familias,
  formatarNumero,
  icones,
  layout,
  marcasDosAgentes,
  nomesDosIcones,
  paresDeContraste,
  passoDosRotulos,
  porcentagem,
  raios,
  razaoDeContraste,
  sombras
};
//# sourceMappingURL=ds-bundle.js.map
