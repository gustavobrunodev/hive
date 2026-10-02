/* Design Studio — núcleo: utilidades, ícones, estado, navegação, barra
   lateral, tema, menus flutuantes e avisos. */
window.DS = window.DS || {};

(function () {
  'use strict';
  var D = DS.data;
  var A = (DS.app = { D: D });

  /* ---------------------------------------------------------------- */
  /* Utilidades                                                         */
  /* ---------------------------------------------------------------- */
  A.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  A.fmt = function (n) { return Number(n).toLocaleString('pt-BR'); };
  A.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  A.guardar = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };
  A.ler = function (k, padrao) {
    try { var v = localStorage.getItem(k); return v == null ? padrao : JSON.parse(v); } catch (e) { return padrao; }
  };
  A.agora = function () {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };
  A.plural = function (n, um, varios) { return n + ' ' + (n === 1 ? um : varios); };
  var GENERO = { atalhos: 'os', compras: 'as', datas: 'as', etapas: 'as', caixa: 'a', faixa: 'a', linha: 'a', lista: 'a', 'notificação': 'a', tabela: 'a' };
  A.refBloco = function (rotulo) {
    rotulo = rotulo || 'bloco';
    var art = GENERO[rotulo.split(' ')[0].toLowerCase()] || 'o';
    return 'd' + art + ' ' + rotulo.charAt(0).toLowerCase() + rotulo.slice(1);
  };
  A.saudacao = function () {
    var h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  };

  /* ---------------------------------------------------------------- */
  /* Ícones: traço único de 1,75, desenhados para o produto             */
  /* ---------------------------------------------------------------- */
  var P = {
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
    tabela: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M3.5 14.5h17M9.5 10v9"/>',
  };
  /* Marcas oficiais dos agentes (favicon.svg de claude.ai e de devin.ai,
     baixados em 2026-10-02). A do Devin é monocromática: segue a tinta do tema. */
  var MARCAS = {
    claude: { vb: '0 0 248 248', d: 'M52.4285 162.873L98.7844 136.879L99.5485 134.602L98.7844 133.334H96.4921L88.7237 132.862L62.2346 132.153L39.3113 131.207L17.0249 130.026L11.4214 128.844L6.2 121.873L6.7094 118.447L11.4214 115.257L18.171 115.847L33.0711 116.911L55.485 118.447L71.6586 119.392L95.728 121.873H99.5485L100.058 120.337L98.7844 119.392L97.7656 118.447L74.5877 102.732L49.4995 86.1905L36.3823 76.62L29.3779 71.7757L25.8121 67.2858L24.2839 57.3608L30.6515 50.2716L39.3113 50.8623L41.4763 51.4531L50.2636 58.1879L68.9842 72.7209L93.4357 90.6804L97.0015 93.6343L98.4374 92.6652L98.6571 91.9801L97.0015 89.2625L83.757 65.2772L69.621 40.8192L63.2534 30.6579L61.5978 24.632C60.9565 22.1032 60.579 20.0111 60.579 17.4246L67.8381 7.49965L71.9133 6.19995L81.7193 7.49965L85.7946 11.0443L91.9074 24.9865L101.714 46.8451L116.996 76.62L121.453 85.4816L123.873 93.6343L124.764 96.1155H126.292V94.6976L127.566 77.9197L129.858 57.3608L132.15 30.8942L132.915 23.4505L136.608 14.4708L143.994 9.62643L149.725 12.344L154.437 19.0788L153.8 23.4505L150.998 41.6463L145.522 70.1215L141.957 89.2625H143.994L146.414 86.7813L156.093 74.0206L172.266 53.698L179.398 45.6635L187.803 36.802L193.152 32.5484H203.34L210.726 43.6549L207.415 55.1159L196.972 68.3492L188.312 79.5739L175.896 96.2095L168.191 109.585L168.882 110.689L170.738 110.53L198.755 104.504L213.91 101.787L231.994 98.7149L240.144 102.496L241.036 106.395L237.852 114.311L218.495 119.037L195.826 123.645L162.07 131.592L161.696 131.893L162.137 132.547L177.36 133.925L183.855 134.279H199.774L229.447 136.524L237.215 141.605L241.8 147.867L241.036 152.711L229.065 158.737L213.019 154.956L175.45 145.977L162.587 142.787H160.805V143.85L171.502 154.366L191.242 172.089L215.82 195.011L217.094 200.682L213.91 205.172L210.599 204.699L188.949 188.394L180.544 181.069L161.696 165.118H160.422V166.772L164.752 173.152L187.803 207.771L188.949 218.405L187.294 221.832L181.308 223.959L174.813 222.777L161.187 203.754L147.305 182.486L136.098 163.345L134.745 164.2L128.075 235.42L125.019 239.082L117.887 241.8L111.902 237.31L108.718 229.984L111.902 215.452L115.722 196.547L118.779 181.541L121.58 162.873L123.291 156.636L123.14 156.219L121.773 156.449L107.699 175.752L86.304 204.699L69.3663 222.777L65.291 224.431L58.2867 220.768L58.9235 214.27L62.8713 208.48L86.304 178.705L100.44 160.155L109.551 149.507L109.462 147.967L108.959 147.924L46.6977 188.512L35.6182 189.93L30.7788 185.44L31.4156 178.115L33.7079 175.752L52.4285 162.873Z', cor: '#D97757' },
    devin: { vb: '0 0 425 425', d: 'M70 159.333V91.3471C70 88.3592 71.594 85.5983 74.1816 84.1044L133.043 50.1205C135.631 48.6265 138.819 48.6265 141.407 50.1205L200.269 84.1044C202.856 85.5983 204.45 88.3592 204.45 91.3471V126.068C204.708 137.606 210.806 148.734 221.531 154.926C232.256 161.117 244.942 160.834 255.063 155.289L285.132 137.929C287.719 136.435 290.907 136.435 293.495 137.929L352.357 171.913C354.944 173.406 356.538 176.167 356.538 179.155V247.123C356.538 250.111 354.944 252.872 352.357 254.366L293.495 288.35C290.907 289.844 287.719 289.844 285.132 288.35L255.306 271.13C245.146 265.456 232.344 265.117 221.534 271.358C210.809 277.55 204.711 288.678 204.453 300.215V334.926C204.453 337.914 202.859 340.675 200.271 342.169L141.41 376.153C138.822 377.647 135.634 377.647 133.046 376.153L74.1845 342.169C71.5969 340.675 70.0028 337.914 70.0028 334.926V266.959C70.0029 263.971 71.5969 261.21 74.1845 259.716L133.046 225.732C135.634 224.238 138.822 224.238 141.41 225.732L171.547 243.132C181.656 248.638 194.306 248.906 205.005 242.729C215.815 236.488 221.922 225.231 222.088 213.595C221.83 202.057 215.732 189.737 205.008 183.545C194.283 177.353 181.597 177.636 171.476 183.181L141.269 200.72C138.67 202.229 135.461 202.228 132.864 200.716L74.1576 166.562C71.5835 165.065 70 162.311 70 159.333Z', cor: 'currentColor' },
  };
  A.logoAgente = function (id, cls) {
    var m = MARCAS[id] || MARCAS.claude;
    return '<span class="ag-logo ag-' + id + (cls ? ' ' + cls : '') + '" aria-hidden="true"><svg viewBox="' + m.vb + '"><path d="' + m.d + '" fill="' + m.cor + '"/></svg></span>';
  };
  A.ic = function (nome, cls) {
    var fill = nome === 'mais3' ? ' fill="currentColor"' : ' fill="none"';
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"' + fill + ' stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + (P[nome] || '') + '</svg>';
  };

  /* ---------------------------------------------------------------- */
  /* Domínio                                                            */
  /* ---------------------------------------------------------------- */
  var doresPorId = {};
  D.dores.forEach(function (d) { doresPorId[d.id] = d; });
  A.dor = function (id) { return doresPorId[id]; };
  A.produto = function (id) { return D.produtos.filter(function (p) { return p.id === id; })[0]; };
  A.fonte = function (id) { return D.fontes[id]; };
  A.FONTES = ['likert', 'voz', 'fullstory'];
  A.relatorio = function (produto, fonte) { return D.relatorios.filter(function (r) { return r.produto === produto && r.fonte === fonte; })[0]; };
  A.relatorioPorId = function (id) { return D.relatorios.filter(function (r) { return r.id === id; })[0]; };
  A.doresDe = function (produto, fonte) {
    return D.dores.filter(function (d) { return d.produto === produto && (!fonte || d.fonte === fonte); }).sort(function (a, b) { return a.rank - b.rank; });
  };
  A.estacao = function (produto, id) {
    var p = A.produto(produto);
    return p.estacoes.filter(function (e) { return e.id === id; })[0] || { id: id, nome: id };
  };
  A.agente = function (id) { return D.agentes.filter(function (a) { return a.id === id; })[0]; };
  A.modelo = function (agente, id) { var a = A.agente(agente); return (a.modelos.filter(function (m) { return m.id === id; })[0]) || a.modelos[0]; };
  A.ordemImpacto = { alto: 0, medio: 1, baixo: 2 };
  A.nomeImpacto = { alto: 'Impacto alto', medio: 'Impacto médio', baixo: 'Impacto baixo' };

  /* ---------------------------------------------------------------- */
  /* Estado                                                             */
  /* ---------------------------------------------------------------- */
  var gerados = {};
  D.relatorios.forEach(function (r) { gerados[r.produto] = gerados[r.produto] || {}; if (!r.guiado) gerados[r.produto][r.fonte] = true; });
  var prefTema = A.ler('ds.tema', null);
  A.S = {
    tema: prefTema || 'claro',
    lateral: A.ler('ds.lateral', true),
    rota: { v: 'inicio', p: null },
    gerados: gerados,
    prototipos: A.clone(D.prototipos),
    conversas: {},          /* chat de cada Protótipo */
    livres: {},             /* conversas sem Protótipo */
    trabalho: {},           /* estado do canvas por Protótipo */
    folha: null,
    pop: null,
    apr: null,
    publicado: {},
    agentePadrao: 'claude',
    modeloPadrao: { claude: 'sonnet', devin: 'auto' },
    filtroDores: { produto: 'cambio', fonte: 'todas' },
    filtroProtos: 'todos',
  };
  A.S.prototipos.forEach(function (p) { A.S.conversas[p.id] = { msgs: A.clone(D.conversas[p.id] || []), ocupado: false }; });
  A.S.livres['conv-cambio'] = { id: 'conv-cambio', titulo: 'Dores que se repetem em Câmbio', produto: 'cambio', msgs: A.clone(D.conversaProduto.cambio || []), ocupado: false, quando: 'ontem' };

  A.proto = function (id) { return A.S.prototipos.filter(function (p) { return p.id === id; })[0]; };
  A.ativa = function (proto) {
    return proto.propostas.filter(function (p) { return p.estado === 'ativa'; })[0] || proto.propostas[proto.propostas.length - 1];
  };

  /* ---------------------------------------------------------------- */
  /* Tema                                                               */
  /* ---------------------------------------------------------------- */
  A.aplicarTema = function () {
    document.documentElement.setAttribute('data-theme', A.S.tema === 'escuro' ? 'dark' : 'light');
  };
  A.aplicarTema();

  /* ---------------------------------------------------------------- */
  /* Navegação por âncora simples (#vista ou #vista.param)              */
  /* ---------------------------------------------------------------- */
  A.lerRota = function () {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return { v: 'inicio', p: null };
    var i = h.indexOf('.');
    return i < 0 ? { v: h, p: null } : { v: h.slice(0, i), p: h.slice(i + 1) };
  };
  A.ir = function (hash) { if (location.hash === hash) A.rotear(); else location.hash = hash; };
  A.limparToasts = function () { var b = document.getElementById('toasts'); if (b) b.innerHTML = ''; };
  A.rotear = function () {
    var r = A.lerRota();
    A.S.pop = null;
    A.limparToasts();
    if (r.v === 'dor' && A.dor(r.p)) {
      if (['dores', 'relatorio', 'trabalho', 'conversa', 'inicio'].indexOf(A.S.rota.v) < 0) A.S.rota = { v: 'dores', p: null };
      A.S.folha = { tipo: 'dor', id: r.p };
      A.render();
      return;
    }
    if (r.v === 'apresentar' && A.proto(r.p)) { A.S.apr = { protoId: r.p, slide: 0, evid: 0 }; A.render(); return; }
    if (r.v === 'graficos') { A.S.relVista = 'graficos'; r = { v: 'relatorio', p: r.p }; }
    A.S.folha = null; A.S.apr = null;
    A.S.rota = r;
    A.render();
    var m = document.getElementById('main'); if (m) m.scrollTop = 0;
  };

  /* ---------------------------------------------------------------- */
  /* Barra lateral                                                      */
  /* ---------------------------------------------------------------- */
  A.marca = function () {
    return '<svg class="marca-sinal" viewBox="0 0 32 32" aria-hidden="true">' +
      '<rect x="2" y="2" width="28" height="28" rx="9" fill="var(--acento)"/>' +
      '<path d="M10 21.5h7.5a5.5 5.5 0 0 0 0-11H10z" fill="none" stroke="var(--sobre-acento)" stroke-width="2.6" stroke-linejoin="round"/>' +
      '<circle cx="22.6" cy="21.4" r="2.1" fill="var(--sobre-acento)"/></svg>';
  };
  A.recentes = function () {
    var S = A.S;
    var itens = S.prototipos.map(function (p) { return { tipo: 'proto', id: p.id, titulo: p.nome, sub: A.produto(p.produto).nome, quando: p.atualizado, ordem: p.recemCriado || p.atualizado === 'agora' ? 0 : p.id === 'remessa' ? 1 : p.id === 'historico' ? 2 : 3 }; });
    Object.keys(S.livres).forEach(function (k) { var c = S.livres[k]; itens.push({ tipo: 'livre', id: c.id, titulo: c.titulo, sub: A.produto(c.produto).nome, quando: c.quando, ordem: c.quando === 'agora' ? 0 : 2.5 }); });
    return itens.sort(function (a, b) { return a.ordem - b.ordem; });
  };
  A.lateralAberta = function () {
    var S = A.S;
    if (S.rota.v === 'trabalho' && window.innerWidth > 820) return S.lateralTrabalho != null ? S.lateralTrabalho : S.lateral && window.innerWidth >= 1600;
    return S.lateral;
  };
  A.lateral = function () {
    var S = A.S, r = S.rota;
    var nav = [['inicio', 'Início', 'inicio'], ['prototipos', 'Protótipos', 'camadas'], ['dores', 'Dores', 'dor'], ['relatorios', 'Relatórios', 'relatorio']].map(function (n) {
      var on = r.v === n[0] || (n[0] === 'relatorios' && r.v === 'relatorio');
      return '<a class="lat-item" href="#' + n[0] + '"' + (on ? ' aria-current="page"' : '') + ' title="' + n[1] + '">' + A.ic(n[2]) + '<span>' + n[1] + '</span></a>';
    }).join('');
    var rec = A.recentes().slice(0, 7).map(function (it) {
      var hash = it.tipo === 'proto' ? '#trabalho.' + it.id : '#conversa.' + it.id;
      var on = (r.v === 'trabalho' || r.v === 'conversa') && r.p === it.id;
      return '<a class="lat-recente" href="' + hash + '"' + (on ? ' aria-current="page"' : '') + '>' +
        '<span class="lat-rec-ic">' + A.ic(it.tipo === 'proto' ? 'camadas' : 'conversa') + '</span>' +
        '<span class="lat-rec-txt"><b>' + A.esc(it.titulo) + '</b><small>' + A.esc(it.sub) + ' · ' + A.esc(it.quando) + '</small></span></a>';
    }).join('');
    return '<aside class="lateral" aria-label="Navegação">' +
      '<div class="lat-topo"><a class="marca" href="#inicio">' + A.marca() + '<span>Design Studio</span></a>' +
      '<button class="btn-icone lat-recolher" data-act="lateral" aria-label="' + (A.lateralAberta() ? 'Recolher' : 'Abrir') + ' a barra lateral" title="' + (A.lateralAberta() ? 'Recolher' : 'Abrir') + ' a barra lateral">' + A.ic('lateral') + '</button></div>' +
      '<a class="lat-novo" href="#inicio" data-act="nova-conversa">' + A.ic('novo') + '<span>Nova conversa</span></a>' +
      '<nav class="lat-nav">' + nav + '</nav>' +
      '<div class="lat-secao"><p class="lat-rotulo">Recentes</p><div class="lat-recentes">' + rec + '</div></div>' +
      '<div class="lat-rodape">' +
        '<div class="tema-troca" role="group" aria-label="Tema"><button data-act="tema" data-t="claro" aria-pressed="' + (S.tema === 'claro') + '" title="Tema claro">' + A.ic('sol') + '<span class="sr">Claro</span></button><button data-act="tema" data-t="escuro" aria-pressed="' + (S.tema === 'escuro') + '" title="Tema escuro">' + A.ic('lua') + '<span class="sr">Escuro</span></button></div>' +
        '<a class="lat-item" href="#config"' + (r.v === 'config' ? ' aria-current="page"' : '') + ' title="Configurações">' + A.ic('config') + '<span>Configurações</span></a>' +
        '<div class="lat-conta"><span class="avatar">MA</span><span class="lat-rec-txt"><b>Marina Alves</b><small>Product Manager · exemplo</small></span></div>' +
        '<p class="lat-exemplo" title="Dados de exemplo">Dados de exemplo</p>' +
      '</div></aside>';
  };

  /* ---------------------------------------------------------------- */
  /* Menus flutuantes (popovers)                                        */
  /* ---------------------------------------------------------------- */
  A.pops = {};
  A.abrirPop = function (el, tipo, extra) {
    if (A.S.pop && A.S.pop.tipo === tipo && A.S.pop.ancora === el) { A.fecharPop(); return; }
    A.S.pop = { tipo: tipo, extra: extra || {}, ancora: el, ancoraId: el.id || null };
    A.renderCamadas();
    var p = document.querySelector('.pop');
    var foco = p && p.querySelector('[aria-checked="true"], [aria-selected="true"], button, a'); if (foco) foco.focus();
  };
  A.posicionarPop = function () {
    var pop = A.S.pop, p = document.querySelector('.pop');
    if (!pop || !p) return;
    var el = document.body.contains(pop.ancora) ? pop.ancora : pop.ancoraId && document.getElementById(pop.ancoraId);
    if (!el) { A.S.pop = null; p.remove(); return; }
    pop.ancora = el;
    var r = el.getBoundingClientRect();
    p.style.maxHeight = '';
    var pr = p.getBoundingClientRect();
    var abaixo = window.innerHeight - r.bottom - 20, acima = r.top - 20;
    var emCima = pop.extra.acima ? (pr.height <= acima || acima > abaixo) : (pr.height > abaixo && acima > abaixo);
    var lim = emCima ? acima : abaixo;
    if (pr.height > lim) { p.style.maxHeight = Math.max(160, lim) + 'px'; pr = p.getBoundingClientRect(); }
    var top = emCima ? r.top - pr.height - 8 : r.bottom + 8;
    var left = pop.extra.alinhar === 'direita' ? r.right - pr.width : r.left;
    left = Math.max(12, Math.min(left, window.innerWidth - pr.width - 12));
    p.style.left = left + 'px'; p.style.top = Math.max(12, top) + 'px';
  };
  A.fecharPop = function () {
    var anc = A.S.pop && A.S.pop.ancora;
    A.S.pop = null; A.renderCamadas();
    if (anc && document.body.contains(anc)) anc.focus();
  };
  function popHtml() {
    var p = A.S.pop;
    if (!p || !A.pops[p.tipo]) return '';
    return '<div class="pop pop-' + p.tipo + '" role="menu">' + A.pops[p.tipo](p.extra) + '</div>';
  }

  /* ---------------------------------------------------------------- */
  /* Avisos                                                             */
  /* ---------------------------------------------------------------- */
  /* Selo que acompanha a página quando a barra lateral (que já diz
     "Dados de exemplo") está recolhida ou no celular */
  A.seloExemplo = function () { return '<span class="selo-exemplo">Dados de exemplo</span>'; };
  A.toast = function (texto, icone) {
    var box = document.getElementById('toasts');
    if (!box) return;
    /* na vista de trabalho o aviso fica centrado no quadro, logo acima das
       ferramentas (e da barra de comentários, quando ela existe) */
    var cv = document.getElementById('canvas'), r = cv && cv.getBoundingClientRect();
    if (r && r.width > 0 && r.height > 0) {
      box.classList.add('no-quadro');
      box.style.left = Math.round(r.left + r.width / 2) + 'px';
      box.style.bottom = Math.round(window.innerHeight - r.bottom + 74 + (cv.querySelector('.comentarios-barra') ? 58 : 0)) + 'px';
    } else { box.classList.remove('no-quadro'); box.style.left = ''; box.style.bottom = ''; }
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = A.ic(icone || 'ok') + '<span>' + A.esc(texto) + '</span>';
    box.appendChild(t);
    setTimeout(function () { t.classList.add('sai'); }, 3000);
    setTimeout(function () { t.remove(); }, 3400);
  };

  /* ---------------------------------------------------------------- */
  /* Renderização                                                       */
  /* ---------------------------------------------------------------- */
  A.vistas = {};
  A.folhas = {};
  A.depois = [];
  A.render = function () {
    var S = A.S;
    var ativo = document.activeElement && document.activeElement.id;
    var app = document.getElementById('app');
    var lat = A.lateralAberta() ? 'aberta' : 'fechada';
    if (app.getAttribute('data-lateral') !== lat && !A._animarLateral) {
      app.style.transition = 'none';
      app.setAttribute('data-lateral', lat);
      void app.offsetWidth;
      setTimeout(function () { app.style.transition = ''; }, 0);
    } else app.setAttribute('data-lateral', lat);
    A._animarLateral = false;
    app.setAttribute('data-vista', S.rota.v);
    document.getElementById('lateral-slot').innerHTML = A.lateral();
    var vista = A.vistas[S.rota.v] || A.vistas.inicio;
    document.getElementById('main').innerHTML = vista();
    A.renderCamadas();
    document.title = (A.titulos[S.rota.v] ? A.titulos[S.rota.v]() + ' · ' : '') + 'Design Studio';
    var fila = A.depois; A.depois = [];
    fila.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    if (ativo) { var el = document.getElementById(ativo); if (el && !document.querySelector('.folha, .apresentar')) el.focus({ preventScroll: true }); }
  };
  A.titulos = {
    inicio: function () { return 'Início'; },
    prototipos: function () { return 'Protótipos'; },
    dores: function () { return 'Dores'; },
    relatorios: function () { return 'Relatórios'; },
    config: function () { return 'Configurações'; },
    trabalho: function () { var p = A.proto(A.S.rota.p); return p ? p.nome : 'Protótipo'; },
    conversa: function () { var c = A.S.livres[A.S.rota.p]; return c ? c.titulo : 'Conversa'; },
  };
  A.renderCamadas = function () {
    var S = A.S, html = '';
    if (S.folha && A.folhas[S.folha.tipo]) html += A.folhas[S.folha.tipo](S.folha);
    if (S.apr && A.apresentarHtml) html += A.apresentarHtml();
    html += popHtml();
    document.getElementById('camadas').innerHTML = html;
    if (S.pop) A.posicionarPop();
  };
  A.fecharFolha = function () {
    var f = A.S.folha;
    A.S.folha = null;
    if (A.lerRota().v === 'dor') history.replaceState(null, '', '#' + A.S.rota.v + (A.S.rota.p ? '.' + A.S.rota.p : ''));
    A.renderCamadas();
    if (f && f.retornoEl && document.body.contains(f.retornoEl)) f.retornoEl.focus();
    else if (f && f.retorno) { var el = document.getElementById(f.retorno); if (el) el.focus(); }
  };

  /* ---------------------------------------------------------------- */
  /* Ações (delegação de eventos)                                       */
  /* ---------------------------------------------------------------- */
  A.acoes = {
    ir: function (el) { A.S.pop = null; A.ir(el.dataset.hash); },
    pop: function (el) { A.abrirPop(el, el.dataset.pop, Object.assign({}, el.dataset)); },
    'fechar-folha': function () { A.fecharFolha(); },
    'fechar-pop': function () { A.fecharPop(); },
    lateral: function () {
      if (A.S.rota.v === 'trabalho' && window.innerWidth > 820) A.S.lateralTrabalho = !A.lateralAberta();
      else { A.S.lateral = !A.S.lateral; A.guardar('ds.lateral', A.S.lateral); }
      A._animarLateral = true;
      A.render();
      if (A.reenquadrar) setTimeout(A.reenquadrar, 260);
    },
    tema: function (el) { A.S.tema = el.dataset.t; A.guardar('ds.tema', A.S.tema); A.aplicarTema(); A.render(); },
    pular: function () { var m = document.getElementById('main'); if (m) m.focus(); },
  };
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (A.S.pop && !ev.target.closest('.pop') && !(el && el.dataset.act === 'pop')) { A.S.pop = null; A.renderCamadas(); }
    if (!el) return;
    var fn = A.acoes[el.dataset.act];
    if (fn) { ev.preventDefault(); fn(el, ev); }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if (A.S.pop) { A.fecharPop(); return; }
      if (A.S.apr) { A.acoes['sair-apresentar'](); return; }
      if (A.S.folha) { A.fecharFolha(); return; }
      if (A.escapeTrabalho && A.escapeTrabalho()) return;
    }
    if (A.S.apr && A.teclaApresentar) A.teclaApresentar(ev);
  });
  window.addEventListener('hashchange', A.rotear);
  window.addEventListener('resize', function () { if (A.S.pop) A.posicionarPop(); if (A.aoRedimensionar) A.aoRedimensionar(); });
  A.iniciar = function () { A.rotear(); };
})();
