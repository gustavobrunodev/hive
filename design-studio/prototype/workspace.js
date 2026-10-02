/* Design Studio — vista de trabalho: chat na lateral e o Protótipo no
   quadro, com o agente trabalhando como um cursor com nome. */
(function () {
  'use strict';
  var A = DS.app, D = A.D, S = A.S, ic = A.ic, esc = A.esc;

  var FRAME_W = { celular: 390, desktop: 1040 }, FRAME_H = { celular: 780, desktop: 680 };
  var GAP = 72, LINHA_GAP = 170, NOTAS_W = 300, NOTAS_GAP = 110; /* NOTAS_*: coluna do Pedido (Produto novo) */
  var NOTA_W = 250, NOTA_H = 220, NOTA_VAO = 26, NOTA_GAP = 76;    /* Dores coladas ao lado da tela onde doem */
  var GIROS_Q = ['-1.6deg', '1.2deg', '-0.8deg', '1.6deg'];
  var ALIAS_TELA = { lista: 'extrato' }, ALIAS_ESTACAO = { extrato: 'lista' };
  var TOPO = 70 + 56, BASE = 84; /* barra de cima + rótulos (em px de tela) e barra de ferramentas */
  var VARIANTES_GENERICAS = [
    { n: 1, nome: 'Mais compacto', nota: 'Menos espaço interno, o mesmo conteúdo.' },
    { n: 2, nome: 'Mais destaque', nota: 'Peso e contorno maiores para chamar atenção.' },
    { n: 3, nome: 'Mais respiro', nota: 'Mais espaço em volta; leitura mais calma.' },
    { n: 4, nome: 'Mais discreto', nota: 'Cor e peso reduzidos para não competir.' },
  ];
  /* Cores de ação do próprio IDS: o ajuste não tira o Protótipo do design system */
  var CORES = [['#FF6200', 'Laranja (ação primária)'], ['#E55800', 'Laranja escuro'], ['#000066', 'Azul-marinho (ação secundária)'], ['#3B3B3B', 'Grafite (ação neutra)']];

  /* ---------------------------------------------------------------- */
  /* Estado do canvas por Protótipo                                     */
  /* ---------------------------------------------------------------- */
  A.trab = function (proto) {
    var t = S.trabalho[proto.id];
    if (!t) {
      var at = A.ativa(proto);
      var ag = proto.agente || S.agentePadrao;
      t = S.trabalho[proto.id] = {
        proposta: at ? at.id : null, tela: proto.telaInicial, device: 'celular', ferramenta: null,
        zoom: 0.5, x: 40, y: 80, enquadrado: false, comentarios: [], bolha: null, picked: null, live: null,
        estado: {}, aceitas: {}, tweaks: null, painel: null, aqui: proto.pontos.length ? proto.pontos[proto.pontos.length - 1].id : null,
        agente: ag, modelo: S.modeloPadrao[ag] || A.agente(ag).modeloPadrao, testar: false, testarTela: proto.telaInicial,
        vista: window.innerWidth <= 820 ? 'chat' : 'canvas', criando: null, destaque: null, pendente: null, cursor: null, confirmaVolta: null,
        ins: null, inseridos: {},
      };
    }
    return t;
  };
  function proposta(proto, id) { return proto.propostas.filter(function (p) { return p.id === id; })[0]; }
  function linhas(proto, t) {
    var ls = [];
    var atual = proposta(proto, 'atual');
    if (atual) ls.push(atual);
    var sel = proposta(proto, t.proposta);
    if (sel && sel.id !== 'atual') ls.push(sel);
    if (!sel || sel.id === 'atual') { var at = A.ativa(proto); if (at && at.id !== 'atual' && ls.indexOf(at) < 0) ls.push(at); }
    return ls;
  }
  /* A tela do Protótipo onde a Dor acontece; sem tela própria, a mais
     próxima na jornada do Produto */
  function telaDaDor(proto, d) {
    var tl = ALIAS_TELA[d.estacao] || d.estacao;
    if (proto.telas.indexOf(tl) >= 0) return tl;
    var ordem = A.produto(proto.produto).estacoes.map(function (e) { return e.id; });
    var i = ordem.indexOf(d.estacao), melhor = proto.telas[0], dist = Infinity;
    proto.telas.forEach(function (x) {
      var j = ordem.indexOf(ALIAS_ESTACAO[x] || x);
      if (i >= 0 && j >= 0 && Math.abs(j - i) < dist) { dist = Math.abs(j - i); melhor = x; }
    });
    return melhor;
  }
  function doresPorTela(proto) {
    var mapa = {};
    if (proto.tipo === 'novo') return mapa;
    proto.dores.forEach(function (id) { var d = A.dor(id); if (d) { var tl = telaDaDor(proto, d); (mapa[tl] = mapa[tl] || []).push(id); } });
    return mapa;
  }
  function geometria(proto, t) {
    var fw = FRAME_W[t.device], fh = FRAME_H[t.device];
    var x0 = proto.tipo === 'novo' && proto.briefing ? NOTAS_W + NOTAS_GAP : 0;
    var ls = linhas(proto, t), rows = Math.max(1, ls.length);
    var mapa = doresPorTela(proto), colX = {}, notasX = {}, x = x0;
    proto.telas.forEach(function (tl) {
      colX[tl] = x; x += fw;
      if (mapa[tl]) { notasX[tl] = x + NOTA_GAP; x += NOTA_GAP + NOTA_W; }
      x += GAP;
    });
    return {
      fw: fw, fh: fh, x0: x0, ls: ls, mapa: mapa, colX: colX, notasX: notasX,
      largura: x - GAP, altura: rows * fh + (rows - 1) * LINHA_GAP,
      rowY: function (r) { return r * (fh + LINHA_GAP); },
    };
  }
  function cabe(cv) { return cv && cv.clientWidth > 80 && cv.clientHeight > 80; }
  function enquadrar(proto, t, el) {
    var cv = el || document.getElementById('canvas');
    if (!cabe(cv)) return false;
    var g = geometria(proto, t);
    var w = cv.clientWidth, h = cv.clientHeight;
    var z = Math.max(0.12, Math.min((w - 80) / g.largura, (h - TOPO - BASE) / g.altura, 0.9));
    t.zoom = z;
    t.x = (w - g.largura * z) / 2;
    t.y = TOPO + Math.max(0, (h - TOPO - BASE - g.altura * z) / 2);
    t.enquadrado = true;
    return true;
  }
  /* Aproxima uma tela (duplo clique, Ver no canvas, Editar) */
  function focarFrame(proto, t, propId, tela) {
    var cv = document.getElementById('canvas');
    if (!cabe(cv)) return false;
    var g = geometria(proto, t);
    var r = Math.max(0, g.ls.map(function (p) { return p && p.id; }).indexOf(propId));
    var fx = g.colX[tela] != null ? g.colX[tela] : g.x0, fy = g.rowY(r);
    var w = cv.clientWidth, h = cv.clientHeight;
    var z = Math.min(0.95, (h - TOPO - BASE) / g.fh, (w - 140) / g.fw);
    t.zoom = z;
    t.x = w / 2 - (fx + g.fw / 2) * z;
    t.y = TOPO + (h - TOPO - BASE - g.fh * z) / 2 - fy * z;
    t.enquadrado = true;
    return true;
  }
  A.reenquadrar = function () {
    var proto = A.proto(S.rota.p);
    if (!proto || S.rota.v !== 'trabalho') return;
    if (enquadrar(proto, A.trab(proto))) aplicarTransform(true);
  };

  /* ---------------------------------------------------------------- */
  /* Vista                                                              */
  /* ---------------------------------------------------------------- */
  A.vistas.trabalho = function () {
    var proto = A.proto(S.rota.p);
    if (!proto) return '<div class="pagina"><div class="vazio"><h3>Protótipo não encontrado</h3><a class="btn btn-sec" href="#prototipos">Ver Protótipos</a></div></div>';
    var t = A.trab(proto);
    A.cmp(proto.id);
    if (proto.recemCriado) A.depois.push(function () { A.bootProto(proto); });
    if (t.pendente) { var pend = t.pendente; t.pendente = null; A.depois.push(function () { A.respostaLivreProto(proto, pend.texto, { anexos: pend.anexos }); }); }
    A.depois.push(function () { if (!t.enquadrado) { if (window.innerWidth > 820 || !focarFrame(proto, t, t.proposta, t.tela)) enquadrar(proto, t); } aplicarTransform(); ligarCanvas(); A.rolarFim(); posicionarOverlays(); marcarPicked(proto, t); A.posicionarCursor(); ajustarAbas(); });
    return '<div class="trabalho" data-vista="' + t.vista + '">' +
      '<div class="troca-vista" role="group" aria-label="Ver"><button class="btn btn-p ' + (t.vista === 'chat' ? 'btn-pri' : 'btn-sec') + '" data-act="vista" data-v="chat">' + ic('conversa') + 'Conversa</button><button class="btn btn-p ' + (t.vista === 'canvas' ? 'btn-pri' : 'btn-sec') + '" data-act="vista" data-v="canvas">' + ic('camadas') + 'Quadro</button></div>' +
      '<aside class="chat" aria-label="Conversa">' + chatCab(proto, t) +
      '<div id="chat-corpo"><div class="msgs" id="msgs" role="log" aria-live="polite">' + S.conversas[proto.id].msgs.map(A.msgHtml).join('') + (S.conversas[proto.id].ocupado ? A.DIGITANDO : '') + '</div></div>' +
      '<div class="chat-pe"><div class="atalhos" role="group" aria-label="Atalhos">' + D.atalhos.map(function (a) { return '<button class="atalho" data-act="atalho" data-id="' + a.id + '" title="' + esc(a.dica) + '">' + esc(a.rotulo) + '</button>'; }).join('') + '</div>' +
      A.composerHtml(proto.id, 'compacto') + '</div></aside>' +
      '<section class="canvas quadro-fundo" id="canvas" aria-label="Quadro do Protótipo" data-ferramenta="' + (t.ferramenta || '') + '">' + canvasHtml(proto, t) + '</section></div>';
  };
  function chatCab(proto, t) {
    var p = A.produto(proto.produto);
    return '<header class="chat-cab" id="chat-cab"><div class="chat-cab-linha"><h1>' + esc(proto.nome) + '</h1>' +
      '<button class="btn-icone hist-btn" id="btn-hist" data-act="pop" data-pop="historico" data-proto="' + proto.id + '" data-alinhar="direita" aria-label="Histórico: ' + A.plural(proto.pontos.length, 'Ponto de restauração', 'Pontos de restauração') + '" title="Histórico">' + ic('historico') + '<span class="hist-badge" aria-hidden="true">' + proto.pontos.length + '</span></button></div>' +
      '<div class="chat-contexto"><span class="ctx-chip">' + ic('celular') + p.nome + '</span>' +
      (proto.dores.length ? '<button class="ctx-chip" id="ctx-dores" data-act="pop" data-pop="dores-ctx" data-proto="' + proto.id + '">' + ic('dor') + A.plural(proto.dores.length, 'Dor', 'Dores') + '</button>' : (proto.tipo === 'novo' ? '<span class="ctx-chip">' + ic('novo') + 'Produto novo</span>' : '')) +
      (proto.referencias && proto.referencias.length ? '<span class="ctx-chip">' + ic('clipe') + A.plural(proto.referencias.length, 'Referência', 'Referências') + '</span>' : '') + A.seloExemplo() + '</div></header>';
  }

  /* ---------------------------------------------------------------- */
  /* Canvas                                                             */
  /* ---------------------------------------------------------------- */
  function estadoRender(proto, t, propId) {
    var st = A.clone(t.estado);
    var acc = t.aceitas[propId] || {};
    st.variante = Object.assign({}, acc.conhecidas || {});
    if (t.live && t.live.fase === 'ciclo' && t.picked && t.picked.prop === propId && DS.protos.variantes[t.picked.id]) st.variante[t.picked.id] = varianteAtual(t).n;
    st.notif = false;
    return st;
  }
  function estiloTweaks(t) {
    if (!t.tweaks) return '';
    var w = t.tweaks;
    return '--pt-primary:' + w.cor + ';--pt-primary-hover:' + w.cor + ';--pt-radius:' + w.cantos + 'px;--tw-dens:' + w.densidade + ';--tw-texto:' + w.texto + ';';
  }
  function frameHtml(proto, t, prop, tela, i, g, criandoLinha, y) {
    var nome = DS.protos.nomeTela(tela);
    var pos = 'left:' + g.colX[tela] + 'px;top:' + y + 'px';
    var estado = '', conteudo;
    if (criandoLinha) {
      var etapa = t.criando.etapa;
      if (i >= etapa) {
        estado = ' criando';
        conteudo = '<div class="esqueleto" aria-hidden="true"><i style="width:55%"></i><i class="alto"></i><i></i><i style="width:80%"></i><i class="alto"></i><i style="width:40%"></i></div>';
        if (i > etapa) return '<div class="frame" style="' + pos + ';opacity:.35" data-tela="' + tela + '"><span class="frame-rotulo"><b>' + nome + '</b><span>na fila</span></span><div class="' + (t.device === 'celular' ? 'aparelho' : 'janela') + '"><div class="' + (t.device === 'celular' ? 'aparelho-tela' : 'janela-tela') + '">' + conteudo + '</div></div></div>';
      }
    }
    if (!conteudo) {
      var flags = prop ? prop.flags : {};
      var cls = (t.ferramenta === 'editar' ? 'editando' : t.ferramenta === 'inserir' ? 'inserindo' : '') + (t.tweaks && prop && prop.id !== 'atual' ? ' pt-ajustado' : '');
      conteudo = A.ptHtml(proto.app, tela, flags, estadoRender(proto, t, prop ? prop.id : 'atual'), cls, prop && prop.id !== 'atual' ? estiloTweaks(t) : '', 'quadro', insercoesDe(proto, t, prop, tela));
    }
    /* o frame que o agente acabou de mudar pulsa uma vez (só no primeiro render) */
    var destaque = t.destaque && !t.destaque.feito && t.destaque.ate > Date.now() && prop && prop.id === t.proposta && (t.destaque.tela === tela || t.destaque.tela === '*') ? ' realce' : '';
    var entra = t.entra && t.entra[prop ? prop.id : 'x'] ? ' entra' : '';
    var pins = (t.comentarios || []).map(function (c, k) {
      if (!prop || c.prop !== prop.id || c.tela !== tela) return '';
      return '<button class="pin' + (c.resolvido ? ' resolvido' : '') + '" style="left:' + c.px + '%;top:' + c.py + '%" data-act="abrir-pin" data-i="' + k + '" aria-label="Comentário ' + (k + 1) + ': ' + esc(c.texto) + '">' + (c.resolvido ? ic('ok') : k + 1) + '</button>';
    }).join('');
    var ativoTela = prop && prop.id === t.proposta && t.tela === tela;
    return '<div class="frame' + estado + destaque + entra + '" style="' + pos + '" data-tela="' + tela + '" data-prop="' + (prop ? prop.id : '') + '">' +
      '<span class="frame-rotulo"><b>' + nome + '</b>' + (estado ? '<span>' + A.agente(t.agente).nome + ' está desenhando…</span>' : ativoTela ? '<span class="em-foco">· em foco</span>' : '') + '</span>' +
      '<div class="' + (t.device === 'celular' ? 'aparelho' : 'janela') + '">' +
        (t.device === 'celular' ? '<div class="aparelho-tela">' : '<div class="janela-barra" aria-hidden="true"><i></i><i></i><i></i><span>prototipo.local/' + proto.id + '/' + tela + '</span></div><div class="janela-tela">') +
        conteudo + pins + '</div></div></div>';
  }
  function mundoHtml(proto, t) {
    var g = geometria(proto, t);
    var html = '';
    if (g.x0) {
      html += '<div class="notas-canvas pedido" style="left:0;top:0"><span class="notas-canvas-rotulo">Pedido</span>' +
        '<div class="nota nota-likert" style="--r:-1.4deg"><span class="nota-titulo" style="-webkit-line-clamp:9">' + esc(proto.briefing) + '</span><span class="nota-pe"><span class="nota-vol">' + ic('novo') + '<span>Produto novo</span></span></span></div></div>';
    }
    var ls = g.ls.slice();
    var criandoLinha = !!t.criando;
    if (criandoLinha && !ls.length) ls = [null];
    ls.forEach(function (prop, r) {
      var y = g.rowY(r);
      var rot = prop ? (prop.id === 'atual' ? 'Atual <small>a tela de hoje</small>' : (prop.estado === 'ativa' ? '<span class="ponto-ativa" aria-hidden="true"></span>' : '') + esc(prop.nome) + (prop.titulo ? ' <small>' + esc(prop.titulo) + (prop.estado === 'ativa' ? ' · ativa' : prop.estado === 'descartada' ? ' · descartada' : '') + '</small>' : '')) : (proto.tipo === 'novo' ? 'Proposta A <small>sendo criada</small>' : 'Atual <small>recriando a tela de hoje</small>');
      html += '<div class="linha-rotulo" style="left:' + g.x0 + 'px;top:' + y + 'px">' + rot + '</div>';
      html += proto.telas.map(function (tela, i) {
        return frameHtml(proto, t, prop, tela, i, g, criandoLinha && (prop === null || prop.id === 'atual' || proto.tipo === 'novo'), y);
      }).join('');
    });
    /* Cada Dor fica colada ao lado da tela onde dói, na linha da Proposta
       (a que resolve); antes da Proposta existir, ao lado do Atual */
    var yAlvo = g.rowY(Math.max(0, Math.min(ls.length, 2) - 1)), fios = '', k = 0;
    Object.keys(g.mapa).forEach(function (tela) {
      var nx = g.notasX[tela], borda = g.colX[tela] + g.fw;
      html += '<div class="notas-canvas" style="left:' + nx + 'px;top:' + yAlvo + 'px">' + g.mapa[tela].map(function (id, j) {
        var cy = yAlvo + j * (NOTA_H + NOTA_VAO) + 70;
        fios += '<line x1="' + borda + '" y1="' + cy + '" x2="' + (nx + 6) + '" y2="' + cy + '"/><circle cx="' + borda + '" cy="' + cy + '" r="9"/>';
        return A.notaHtml(A.dor(id), { acao: 'abrir-dor', giro: GIROS_Q[k++ % GIROS_Q.length] });
      }).join('') + '</div>';
    });
    if (fios) html = '<svg class="conectores" width="' + g.largura + '" height="' + g.altura + '" aria-hidden="true">' + fios + '</svg>' + html;
    if (t.destaque && !t.destaque.feito && html.indexOf(' realce') >= 0) t.destaque.feito = true;
    return html;
  }
  function canvasHtml(proto, t) {
    var props = proto.propostas.map(function (p) {
      var rot = p.id === 'atual' ? 'Atual' : esc(p.nome.replace('Proposta ', '')) + (p.titulo ? ' · ' + esc(p.titulo) : '');
      return '<button class="prop-aba' + (p.estado === 'descartada' ? ' descartada' : '') + '" role="tab" data-act="proposta" data-id="' + p.id + '" aria-selected="' + (t.proposta === p.id) + '" title="' + esc(p.resumo || '') + '">' + (p.estado === 'ativa' ? '<span class="ponto-ativa" aria-hidden="true"></span>' : '') + rot + '</button>';
    }).join('');
    var sel = proposta(proto, t.proposta);
    var acaoProp = sel && sel.estado === 'rascunho' ? '<button class="ferr" data-act="tornar-ativa" title="Tornar ativa" aria-label="Tornar ' + esc(sel.nome) + ' a Proposta ativa">' + ic('ok') + '<span class="ferr-txt">Tornar ativa</span></button>' : '';
    var topo = '<div class="canvas-topo">' +
      (proto.propostas.length ? '<div class="propostas" id="abas-propostas" role="tablist" aria-label="Propostas">' + props + '</div>' +
        '<button class="prop-nova" data-act="nova-proposta" title="Pedir outra abordagem ao agente" aria-label="Nova Proposta">' + ic('mais') + '<span class="ferr-txt">Nova</span></button>' : '') +
      '<span class="espaco"></span>' +
      '<div class="barra-flutua">' + acaoProp +
        '<button class="ferr" data-act="device" data-d="celular" aria-pressed="' + (t.device === 'celular') + '" title="Celular" aria-label="Ver no celular">' + ic('celular') + '</button>' +
        '<button class="ferr" data-act="device" data-d="desktop" aria-pressed="' + (t.device === 'desktop') + '" title="Desktop" aria-label="Ver no desktop">' + ic('monitor') + '</button>' +
        '<span class="ferr-sep"></span>' +
        '<button class="ferr" data-act="ir" data-hash="#apresentar.' + proto.id + '" title="Apresentar" aria-label="Apresentar">' + ic('apresentar') + '<span class="ferr-txt">Apresentar</span></button>' +
        '<button class="ferr" id="btn-compartilhar" data-act="pop" data-pop="compartilhar" data-proto="' + proto.id + '" data-alinhar="direita" title="Compartilhar" aria-label="Compartilhar">' + ic('compartilhar') + '<span class="ferr-txt">Compartilhar</span></button>' +
      '</div></div>';
    var ferr = function (id, icone, rot) { return '<button class="ferr" data-act="ferramenta" data-f="' + id + '" aria-pressed="' + (t.ferramenta === id) + '" title="' + rot + '">' + ic(icone) + '<span class="ferr-txt">' + rot + '</span></button>'; };
    var ferramentas = '<div class="ferramentas barra-flutua" role="toolbar" aria-label="Ferramentas do quadro">' +
      ferr('mover', 'selecionar', 'Mover') + ferr('comentar', 'comentar', 'Comentar') + ferr('editar', 'editar', 'Editar') + ferr('inserir', 'inserir', 'Inserir') + ferr('ajustar', 'ajustar', 'Ajustar') +
      '<span class="ferr-sep"></span><button class="ferr pri" data-act="testar" title="Navegar como cliente">' + ic('testar') + 'Testar</button><span class="ferr-sep"></span>' +
      '<button class="ferr" data-act="zoom" data-d="-1" aria-label="Diminuir zoom">' + ic('zoomMenos') + '</button><span class="ferr ferr-zoom" id="zoom-txt" aria-live="polite">' + Math.round(t.zoom * 100) + '%</span><button class="ferr" data-act="zoom" data-d="1" aria-label="Aumentar zoom">' + ic('zoomMais') + '</button>' +
      '<button class="ferr" data-act="enquadrar" title="Enquadrar tudo" aria-label="Enquadrar tudo">' + ic('enquadrar') + '</button></div>';
    var dica = '';
    if (t.ferramenta === 'comentar') dica = '<div class="dica-canvas">' + ic('comentar') + 'Clique numa tela para deixar um comentário <kbd>Esc</kbd></div>';
    if (t.ferramenta === 'editar' && !t.picked) dica = '<div class="dica-canvas">' + ic('editar') + 'Clique num elemento da Proposta para ver Variantes <kbd>Esc</kbd></div>';
    if (t.ferramenta === 'inserir' && !t.ins) dica = '<div class="dica-canvas">' + ic('inserir') + 'Aponte entre dois blocos de uma Proposta e clique onde quer inserir <kbd>Esc</kbd></div>';
    var pendentes = (t.comentarios || []).filter(function (c) { return !c.resolvido; }).length;
    var barraComent = pendentes ? '<div class="comentarios-barra">' + ic('comentar') + '<span>' + A.plural(pendentes, 'comentário', 'comentários') + ' na tela</span><button class="btn btn-pri btn-p" data-act="enviar-comentarios">Enviar ao agente</button></div>' : '';
    return topo + '<div class="mundo" id="mundo">' + mundoHtml(proto, t) + '</div>' +
      '<div class="cursor-agente' + (cursorVisivel ? '' : ' oculto') + '" id="cursor-agente" aria-hidden="true" style="transform:' + cursorPos + '"><svg viewBox="0 0 24 24"><path d="M4 3l15 7-6.6 2.1L10 19z" fill="var(--acento)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><span>' + A.agente(t.agente).nome + '</span></div>' +
      dica + barraComent + overlaysHtml(proto, t) + ferramentas + '<span class="selo-exemplo selo-quadro">Dados de exemplo</span>' + (t.testar ? testarHtml(proto, t) : '');
  }
  /* Abas de Proposta: rolam com a borda esmaecida quando não cabem, e a aba
     escolhida fica sempre à vista */
  function ajustarAbas() {
    var a = document.getElementById('abas-propostas');
    if (!a) return;
    var rola = a.scrollWidth > a.clientWidth + 1;
    a.classList.toggle('rola', rola);
    var sel = rola && a.querySelector('[aria-selected="true"]');
    if (!sel) return;
    var l = sel.offsetLeft - a.offsetLeft, r = l + sel.offsetWidth;
    if (r > a.scrollLeft + a.clientWidth) a.scrollLeft = r - a.clientWidth + 28;
    else if (l < a.scrollLeft) a.scrollLeft = Math.max(0, l - 8);
  }
  function overlaysHtml(proto, t) {
    var html = '';
    if (t.bolha) {
      var c = t.comentarios[t.bolha.i];
      html += '<div class="pin-bolha" id="pin-bolha" style="left:0;top:0"><b style="font-size:.875rem">Comentário ' + (t.bolha.i + 1) + ' · ' + DS.protos.nomeTela(c.tela) + '</b>' +
        (c.salvo ? '<p style="font-size:.9375rem">' + esc(c.texto) + '</p><div class="pin-bolha-pe"><button class="btn btn-ter btn-p" data-act="apagar-pin">Apagar</button><button class="btn btn-sec btn-p" data-act="fechar-pin">Fechar</button></div>'
          : '<label class="sr" for="txt-pin">Comentário</label><textarea id="txt-pin" placeholder="O que mudar aqui?">' + esc(c.texto) + '</textarea><div class="pin-bolha-pe"><button class="btn btn-ter btn-p" data-act="apagar-pin">Cancelar</button><button class="btn btn-pri btn-p" data-act="salvar-pin">Comentar</button></div>') + '</div>';
    }
    if (t.ferramenta === 'ajustar') html += ajustarHtml(t);
    if (t.picked && t.live) html += vivoHtml(proto, t);
    if (t.ins) html += insHtml(proto, t);
    if (t.ferramenta === 'inserir') html += '<div class="mira-ins" id="mira-ins" hidden><span></span></div>';
    return html;
  }
  function ajustarHtml(t) {
    var w = t.tweaks || { densidade: 1, texto: 1, cantos: 16, cor: '#FF6200' };
    return '<div class="painel-flutua" id="painel-ajustar" style="right:14px;top:70px"><div class="pf-cab">' + ic('ajustar') + '<strong>Ajustes da Proposta<small>Mudam ao vivo, em todas as telas</small></strong><button class="btn-icone" data-act="ferramenta" data-f="ajustar" aria-label="Fechar">' + ic('fechar') + '</button></div>' +
      '<div class="pf-corpo">' +
        '<div class="ajuste"><span class="ajuste-topo"><label for="tw-densidade">Densidade</label><output id="out-densidade">' + Math.round(w.densidade * 100) + '%</output></span><input type="range" id="tw-densidade" data-tweak="densidade" min="0.7" max="1.4" step="0.05" value="' + w.densidade + '"></div>' +
        '<div class="ajuste"><span class="ajuste-topo"><label for="tw-texto">Tamanho do texto</label><output id="out-texto">' + Math.round(w.texto * 100) + '%</output></span><input type="range" id="tw-texto" data-tweak="texto" min="0.9" max="1.25" step="0.05" value="' + w.texto + '"></div>' +
        '<div class="ajuste"><span class="ajuste-topo"><label for="tw-cantos">Cantos</label><output id="out-cantos">' + w.cantos + ' px</output></span><input type="range" id="tw-cantos" data-tweak="cantos" min="4" max="26" step="1" value="' + w.cantos + '"></div>' +
        '<div class="ajuste"><span>Cor da ação principal</span><div class="amostras">' + CORES.map(function (c) { return '<button class="amostra" style="background:' + c[0] + '" data-act="tweak-cor" data-cor="' + c[0] + '" aria-pressed="' + (w.cor === c[0]) + '" aria-label="' + c[1] + '" title="' + c[1] + '"></button>'; }).join('') + '</div></div>' +
      '</div><div class="pf-pe"><button class="btn btn-sec btn-p" data-act="tweak-reset">Desfazer</button><button class="btn btn-pri btn-p" data-act="tweak-aplicar">Pedir ao agente</button></div></div>';
  }
  function variantesDe(t) { return (DS.protos.variantes[t.picked.id] || VARIANTES_GENERICAS).slice(0, t.live.qtd); }
  function varianteAtual(t) { var l = variantesDe(t); return l[t.live.idx] || l[0]; }
  function vivoHtml(proto, t) {
    var L = t.live, corpo, pe;
    if (L.fase === 'config') {
      corpo = '<div class="acoes-vivo" role="group" aria-label="O que fazer">' + D.acoesLive.map(function (a) { return '<button class="acao-vivo" data-act="vivo-acao" data-id="' + a.id + '" aria-pressed="' + (L.acao === a.id) + '">' + a.rotulo + '</button>'; }).join('') + '</div>' +
        '<div class="linha-vivo">Quantas Variantes<div class="qtd" role="group" aria-label="Quantidade">' + [1, 2, 3, 4].map(function (n) { return '<button data-act="vivo-qtd" data-n="' + n + '" aria-pressed="' + (L.qtd === n) + '">' + n + '</button>'; }).join('') + '</div></div>' +
        '<label class="sr" for="vivo-pedido">O que você quer</label><input type="text" id="vivo-pedido" placeholder="Diga o que você quer (opcional)" value="' + esc(L.pedido) + '">';
      pe = '<button class="btn btn-pri btn-p" data-act="vivo-gerar">' + ic('raio') + 'Gerar Variantes</button>';
    } else if (L.fase === 'gerando') {
      corpo = '<div class="gerando-vivo" role="status"><span>Gerando ' + A.plural(L.qtd, 'Variante', 'Variantes') + ' para ' + esc(t.picked.label) + '…</span><span class="barra-prog"><i style="width:' + Math.round((L.progresso / L.qtd) * 100) + '%"></i></span><span style="color:var(--tinta-3);font-size:.8125rem">A Skill de UX segue o estilo do Protótipo e confere contraste e espaçamento.</span></div>';
      pe = '<button class="btn btn-sec btn-p" data-act="vivo-fechar">Cancelar</button>';
    } else {
      var v = varianteAtual(t), n = variantesDe(t).length;
      corpo = '<div class="var-nav"><button class="btn-icone" data-act="vivo-ant" aria-label="Variante anterior"' + (n < 2 ? ' disabled' : '') + '>' + ic('esq') + '</button><strong role="status">Variante ' + (L.idx + 1) + ' de ' + n + '<span>' + esc(v.nome) + '</span></strong><button class="btn-icone" data-act="vivo-prox" aria-label="Próxima Variante"' + (n < 2 ? ' disabled' : '') + '>' + ic('dir') + '</button></div>' +
        '<p style="font-size:.875rem;color:var(--tinta-2)">' + esc(v.nota) + '</p>';
      pe = '<button class="btn btn-sec btn-p" data-act="vivo-descartar">Descartar</button><button class="btn btn-pri btn-p" data-act="vivo-aceitar">' + ic('ok') + 'Aceitar</button>';
    }
    return '<div class="painel-flutua" id="painel-vivo" role="dialog" aria-label="Mudar ' + esc(t.picked.label) + '" style="left:0;top:0"><div class="pf-cab">' + ic('editar') + '<strong>' + esc(t.picked.label) + '<small>' + DS.protos.nomeTela(t.picked.tela) + ' · ' + esc((proposta(proto, t.picked.prop) || {}).nome || '') + '</small></strong><button class="btn-icone" data-act="vivo-fechar" aria-label="Fechar">' + ic('fechar') + '</button></div><div class="pf-corpo">' + corpo + '</div><div class="pf-pe">' + pe + '</div></div>';
  }
  /* ---------------------------------------------------------------- */
  /* Inserir (modo ao vivo): âncora + posição + pedido → Variantes      */
  /* ---------------------------------------------------------------- */
  var FRASE = { aviso: 'um aviso', ajuda: 'um texto de ajuda', botao: 'um botão', campo: 'um campo', etapas: 'as etapas', resumo: 'um resumo' };
  function varianteIns(I) { var l = A.inserir.variantes(I.tipo, I.qtd); return l[I.idx] || l[0]; }
  function insercoesDe(proto, t, prop, tela, soAceitas) {
    if (!prop || prop.id === 'atual') return [];
    var lista = (((t.inseridos || {})[prop.id] || {})[tela] || []).map(function (x) {
      return { ancora: x.ancora, pos: x.pos, html: A.inserir.html(x.tipo, x.n, proto.app, x.id, tela) };
    });
    var I = t.ins;
    if (!soAceitas && I && I.prop === prop.id && I.tela === tela) {
      lista.push({ ancora: I.ancora, pos: I.pos, html: I.fase === 'ciclo'
        ? '<div class="ins-previa">' + A.inserir.html(I.tipo, varianteIns(I).n, proto.app, null, tela) + '</div>'
        : '<div class="ins-vaga tam-' + I.tam + (I.fase === 'gerando' ? ' gerando' : '') + '"><span>' + (I.fase === 'gerando' ? 'Gerando ' + A.plural(I.qtd, 'Variante', 'Variantes') + '…' : 'O novo elemento entra aqui') + '</span></div>' });
    }
    return lista;
  }
  function insHtml(proto, t) {
    var I = t.ins, corpo, pe;
    var onde = (I.pos === 'antes' ? 'Antes ' : 'Depois ') + A.refBloco(I.ancoraLabel);
    if (I.fase === 'config') {
      corpo = '<div class="linha-vivo">Onde<div class="qtd" role="group" aria-label="Posição"><button data-act="ins-pos" data-p="antes" aria-pressed="' + (I.pos === 'antes') + '" style="width:auto;padding:0 10px">Antes</button><button data-act="ins-pos" data-p="depois" aria-pressed="' + (I.pos === 'depois') + '" style="width:auto;padding:0 10px">Depois</button></div></div>' +
        '<label class="sr" for="ins-pedido">O que inserir</label><textarea id="ins-pedido" rows="2" placeholder="O que entra aqui? Ex.: um aviso explicando o estorno">' + esc(I.pedido) + '</textarea>' +
        '<div class="acoes-vivo" role="group" aria-label="Sugestões">' + A.inserir.SUGESTOES.map(function (s) { return '<button class="acao-vivo" data-act="ins-sugestao" data-tipo="' + s[0] + '" aria-pressed="' + (I.pedido === s[2]) + '">' + s[1] + '</button>'; }).join('') + '</div>' +
        '<div class="linha-vivo">Tamanho<div class="qtd" role="group" aria-label="Tamanho sugerido">' + [['p', 'P'], ['m', 'M'], ['g', 'G']].map(function (x) { return '<button data-act="ins-tam" data-t="' + x[0] + '" aria-pressed="' + (I.tam === x[0]) + '" aria-label="Tamanho ' + x[1] + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="linha-vivo">Quantas Variantes<div class="qtd" role="group" aria-label="Quantidade">' + [1, 2, 3, 4].map(function (n) { return '<button data-act="ins-qtd" data-n="' + n + '" aria-pressed="' + (I.qtd === n) + '">' + n + '</button>'; }).join('') + '</div></div>';
      pe = '<button class="btn btn-pri btn-p" id="ins-gerar" data-act="ins-gerar"' + (I.pedido.trim() ? '' : ' disabled') + '>' + ic('raio') + 'Gerar Variantes</button>';
    } else if (I.fase === 'gerando') {
      corpo = '<div class="gerando-vivo" role="status"><span>Gerando ' + A.plural(I.qtd, 'Variante', 'Variantes') + ' de ' + A.inserir.TIPOS[I.tipo].nome.toLowerCase() + '…</span><span class="barra-prog"><i style="width:' + Math.round((I.progresso / I.qtd) * 100) + '%"></i></span><span style="color:var(--tinta-3);font-size:.8125rem">A Skill de UX monta com os componentes e os tokens do design system do Protótipo.</span></div>';
      pe = '<button class="btn btn-sec btn-p" data-act="ins-fechar">Cancelar</button>';
    } else {
      var v = varianteIns(I), n = A.inserir.variantes(I.tipo, I.qtd).length;
      corpo = '<div class="var-nav"><button class="btn-icone" data-act="ins-ant" aria-label="Variante anterior"' + (n < 2 ? ' disabled' : '') + '>' + ic('esq') + '</button><strong role="status">Variante ' + (I.idx + 1) + ' de ' + n + '<span>' + esc(A.inserir.TIPOS[I.tipo].nome + ' · ' + v.nome) + '</span></strong><button class="btn-icone" data-act="ins-prox" aria-label="Próxima Variante"' + (n < 2 ? ' disabled' : '') + '>' + ic('dir') + '</button></div>' +
        '<p style="font-size:.875rem;color:var(--tinta-2)">' + esc(v.nota) + '</p>';
      pe = '<button class="btn btn-sec btn-p" data-act="ins-descartar">Descartar</button><button class="btn btn-pri btn-p" data-act="ins-aceitar">' + ic('ok') + 'Inserir</button>';
    }
    return '<div class="painel-flutua" id="painel-ins" role="dialog" aria-label="Inserir na tela ' + esc(DS.protos.nomeTela(I.tela)) + '" style="left:0;top:0"><div class="pf-cab">' + ic('inserir') + '<strong>' + esc(onde) + '<small>' + DS.protos.nomeTela(I.tela) + ' · ' + esc((proposta(proto, I.prop) || {}).nome || '') + '</small></strong><button class="btn-icone" data-act="ins-fechar" aria-label="Fechar">' + ic('fechar') + '</button></div><div class="pf-corpo">' + corpo + '</div><div class="pf-pe">' + pe + '</div></div>';
  }
  /* O bloco de primeiro nível sob o ponteiro e a metade em que ele está */
  function pontoInsercao(ev) {
    var tela = ev.target.closest && ev.target.closest('#mundo .aparelho-tela, #mundo .janela-tela');
    if (!tela) return null;
    var frame = tela.closest('.frame');
    if (!frame || frame.classList.contains('criando')) return null;
    if (frame.dataset.prop === 'atual') return { atual: true };
    var el = ev.target.closest('[data-pick]');
    while (el) {
      var pai = el.parentElement;
      if (!pai || pai.matches('.pt-body, .pt-foot')) break;
      var acima = pai.closest('[data-pick]');
      if (!acima || !tela.contains(acima)) break;
      el = acima;
    }
    var pos;
    if (!el || !tela.contains(el)) {
      var blocos = tela.querySelectorAll('.pt-body > [data-pick]');
      el = blocos[blocos.length - 1];
      if (!el) return null;
      pos = 'depois';
    } else {
      var r = el.getBoundingClientRect();
      pos = ev.clientY < r.top + r.height / 2 ? 'antes' : 'depois';
    }
    return { el: el, pos: pos, prop: frame.dataset.prop, tela: frame.dataset.tela };
  }
  function testarHtml(proto, t) {
    var prop = proposta(proto, t.proposta) || A.ativa(proto);
    var pt = A.ptHtml(proto.app, t.testarTela, prop ? prop.flags : {}, Object.assign({}, estadoRender(proto, t, prop ? prop.id : 'atual'), { notif: t.estado.notif }), '', prop && prop.id !== 'atual' ? estiloTweaks(t) : '', null, insercoesDe(proto, t, prop, t.testarTela, true));
    var frame = t.device === 'celular' ? '<div class="aparelho" id="aparelho-testar"><div class="aparelho-tela" id="testar-tela">' + pt + '</div></div>'
      : '<div class="janela" id="aparelho-testar"><div class="janela-barra" aria-hidden="true"><i></i><i></i><i></i><span>prototipo.local/' + proto.id + '</span></div><div class="janela-tela" id="testar-tela">' + pt + '</div></div>';
    return '<div class="testar quadro-fundo" role="dialog" aria-label="Testar como cliente"><div class="testar-topo"><span class="barra-flutua" style="padding:6px 12px;font-weight:600;font-size:.875rem">' + ic('testar') + '&nbsp;Testando · ' + esc(prop ? prop.nome : '') + '</span><span class="espaco"></span><button class="btn btn-sec btn-p" data-act="sair-testar">' + ic('fechar') + 'Sair <kbd style="font-family:inherit;opacity:.7">Esc</kbd></button></div>' +
      '<div class="testar-palco" id="testar-palco">' + frame + '</div>' +
      '<div class="telas-trilho" role="group" aria-label="Telas">' + proto.telas.map(function (tela) { return '<button class="ferr" data-act="testar-tela" data-t="' + tela + '" aria-pressed="' + (t.testarTela === tela) + '">' + DS.protos.nomeTela(tela) + '</button>'; }).join('') + '</div></div>';
  }

  /* Renderizações parciais */
  A.renderCanvas = function () {
    var proto = A.proto(S.rota.p), cv = document.getElementById('canvas');
    if (!proto || !cv) return;
    var t = A.trab(proto);
    var animar = false;
    if (t.novaProposta) { t.entra = {}; t.entra[t.novaProposta] = true; t.novaProposta = null; animar = enquadrar(proto, t); }
    cv.setAttribute('data-ferramenta', t.ferramenta || '');
    var foco = document.activeElement && document.activeElement.id;
    cv.innerHTML = canvasHtml(proto, t);
    rolarAteInsercao(t);
    aplicarTransform(animar); posicionarOverlays(); marcarPicked(proto, t); A.posicionarCursor(); ajustarAbas();
    ajustarTestar();
    if (foco) { var el = document.getElementById(foco); if (el && cv.contains(el)) el.focus({ preventScroll: true }); }
    if (t.entra) setTimeout(function () { t.entra = null; }, 500);
  };
  A.renderTrabalhoParcial = function () {
    var proto = A.proto(S.rota.p);
    if (!proto || !document.getElementById('canvas')) { A.render(); return; }
    var cab = document.getElementById('chat-cab');
    if (cab) { var tmp = document.createElement('div'); tmp.innerHTML = chatCab(proto, A.trab(proto)); cab.replaceWith(tmp.firstChild); }
    A.renderMsgs(); A.renderCanvas();
    document.getElementById('lateral-slot').innerHTML = A.lateral();
  };
  var fimAnima = null;
  function aplicarTransform(animar) {
    var proto = A.proto(S.rota.p), m = document.getElementById('mundo');
    if (!proto || !m) return;
    var t = A.trab(proto);
    clearTimeout(fimAnima);
    m.classList.toggle('anima', !!animar);
    m.style.transform = 'translate(' + t.x + 'px,' + t.y + 'px) scale(' + t.zoom + ')';
    /* rótulos e pinos ficam em tamanho de tela até 42%; abaixo disso encolhem com o quadro */
    m.style.setProperty('--z', Math.max(t.zoom, 0.42).toFixed(4));
    var z = document.getElementById('zoom-txt'); if (z) z.textContent = Math.round(t.zoom * 100) + '%';
    if (animar) fimAnima = setTimeout(function () { m.classList.remove('anima'); posicionarOverlays(); A.posicionarCursor(); }, 470);
  }
  function posicionarOverlays() {
    var proto = A.proto(S.rota.p), cv = document.getElementById('canvas');
    if (!proto || !cv) return;
    var t = A.trab(proto), cr = cv.getBoundingClientRect();
    var b = document.getElementById('pin-bolha');
    if (b && t.bolha) {
      var pins = cv.querySelectorAll('.pin'), alvo = null;
      Array.prototype.forEach.call(pins, function (p) { if (Number(p.dataset.i) === t.bolha.i) alvo = p; });
      if (alvo) {
        var r = alvo.getBoundingClientRect();
        b.style.left = Math.min(cr.width - 312, Math.max(12, r.right - cr.left + 10)) + 'px';
        b.style.top = Math.min(cr.height - b.offsetHeight - 12, Math.max(70, r.top - cr.top - 10)) + 'px';
      }
    }
    var v = document.getElementById('painel-vivo');
    if (v && t.picked) {
      var el = elementoPicked(proto, t);
      if (el) {
        var er = el.getBoundingClientRect();
        var left = er.right - cr.left + 18;
        if (left + 300 > cr.width - 12) left = er.left - cr.left - 318;
        left = Math.max(12, Math.min(left, cr.width - 312));
        v.style.left = left + 'px';
        v.style.top = Math.max(70, Math.min(er.top - cr.top - 20, cr.height - v.offsetHeight - 80)) + 'px';
      }
    }
    posicionarPainelIns(t, cv, cr);
  }
  function rolarAteInsercao(t) {
    if (!t.ins) return;
    var el = document.querySelector('#mundo .ins-vaga, #mundo .ins-previa');
    var tela = el && el.closest('.pt');
    if (!tela || tela.scrollHeight <= tela.clientHeight) return;
    var cab = tela.querySelector('.pt-bar'), presa = cab ? cab.offsetTop + cab.offsetHeight : 0;
    tela.scrollTop = Math.max(0, el.offsetTop - presa - (tela.clientHeight - presa) * 0.3);
  }
  function posicionarPainelIns(t, cv, cr) {
    var p = document.getElementById('painel-ins');
    if (!p || !t.ins) return;
    var el = document.querySelector('#mundo .ins-vaga, #mundo .ins-previa');
    if (!el) return;
    var er = el.getBoundingClientRect();
    var left = er.right - cr.left + 18;
    if (left + 300 > cr.width - 12) left = er.left - cr.left - 318;
    p.style.left = Math.max(12, Math.min(left, cr.width - 312)) + 'px';
    p.style.top = Math.max(70, Math.min(er.top - cr.top - 20, cr.height - p.offsetHeight - 80)) + 'px';
  }
  function elementoPicked(proto, t) {
    if (!t.picked) return null;
    var fr = document.querySelector('#mundo .frame[data-prop="' + t.picked.prop + '"][data-tela="' + t.picked.tela + '"]');
    return fr ? fr.querySelector('[data-pick="' + t.picked.id + '"]') : null;
  }
  function marcarPicked(proto, t) {
    Object.keys(t.aceitas).forEach(function (pid) {
      var gen = (t.aceitas[pid] || {}).genericas || {};
      Object.keys(gen).forEach(function (id) {
        document.querySelectorAll('#mundo .frame[data-prop="' + pid + '"] [data-pick="' + id + '"]').forEach(function (el) { el.setAttribute('data-var', gen[id]); });
      });
    });
    var el = elementoPicked(proto, t);
    if (!el) return;
    el.classList.add('is-picked');
    if (t.live && t.live.fase === 'gerando') el.classList.add('is-generating');
    if (t.live && t.live.fase === 'ciclo' && !DS.protos.variantes[t.picked.id]) el.setAttribute('data-var', varianteAtual(t).n);
  }

  /* Cursor do agente: segue o que ele está criando ou mudando */
  var vaguear = null, cursorPos = 'translate(0px,0px)', cursorVisivel = false;
  A.posicionarCursor = function () {
    var proto = A.proto(S.rota.p), cur = document.getElementById('cursor-agente'), cv = document.getElementById('canvas');
    if (!proto || !cur || !cv) return;
    var t = A.trab(proto);
    var ocupado = S.conversas[proto.id].ocupado || (t.cursor && (t.cursor.ativo || (t.cursor.ate && t.cursor.ate > Date.now()))) || t.criando;
    if (!ocupado) { cur.classList.add('oculto'); cursorVisivel = false; return; }
    var cr = cv.getBoundingClientRect(), alvo = null;
    if (t.criando) {
      alvo = document.querySelectorAll('#mundo .frame.criando')[0] || document.querySelector('#mundo .frame');
      if (alvo) alvo = alvo.querySelector('.esqueleto i.alto') || alvo;
    } else if (t.ins && t.ins.fase !== 'config' && document.querySelector('#mundo .ins-vaga, #mundo .ins-previa')) {
      alvo = document.querySelector('#mundo .ins-vaga, #mundo .ins-previa');
    } else {
      var fr = document.querySelector('#mundo .frame[data-prop="' + t.proposta + '"][data-tela="' + t.tela + '"]') || document.querySelector('#mundo .frame[data-prop="' + t.proposta + '"]');
      if (fr) {
        var picks = fr.querySelectorAll('[data-pick]');
        alvo = t.picked && elementoPicked(proto, t) ? elementoPicked(proto, t) : picks.length ? picks[(t.cursor && t.cursor.idx || 0) % picks.length] : fr;
      }
    }
    if (!alvo) { cur.classList.add('oculto'); cursorVisivel = false; return; }
    var r = alvo.getBoundingClientRect();
    var x = r.left - cr.left + Math.min(r.width * 0.62, 160), y = r.top - cr.top + Math.min(r.height * 0.55, 60);
    cursorPos = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    cur.style.transform = cursorPos;
    cur.querySelector('span').textContent = A.agente(t.agente).nome;
    cur.classList.remove('oculto');
    cursorVisivel = true;
  };
  var falaOriginal = A.agenteFala;
  A.agenteFala = function (alvo, msg, opts) {
    if (alvo.tipo !== 'proto') return falaOriginal(alvo, msg, opts);
    var proto = A.proto(alvo.id), t = A.trab(proto);
    opts = opts || {};
    t.cursor = { ativo: true, idx: 0 };
    clearInterval(vaguear);
    vaguear = setInterval(function () { if (t.cursor && t.cursor.ativo) { t.cursor.idx = (t.cursor.idx || 0) + 1; A.posicionarCursor(); } }, 950);
    setTimeout(A.posicionarCursor, 60);
    var depois = opts.depois;
    var novo = Object.assign({}, opts, {
      depois: function () {
        if (depois) depois();
        clearInterval(vaguear);
        t.cursor = { ativo: false, ate: Date.now() + 1300, idx: t.cursor ? t.cursor.idx : 0 };
        setTimeout(A.posicionarCursor, 1400);
      },
    });
    return falaOriginal(alvo, msg, novo);
  };

  /* ---------------------------------------------------------------- */
  /* Interação no canvas: arrastar, zoom, comentar, editar              */
  /* ---------------------------------------------------------------- */
  function ligarCanvas() {
    var cv = document.getElementById('canvas');
    if (!cv || cv._ligado) return;
    cv._ligado = true;
    var arrasto = null;
    cv.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.canvas-topo, .ferramentas, .painel-flutua, .pin-bolha, .comentarios-barra, .testar, .pin, .nota, button')) return;
      var proto = A.proto(S.rota.p), t = A.trab(proto);
      var naTela = ev.target.closest('.aparelho-tela, .janela-tela');
      if (naTela && (t.ferramenta === 'comentar' || t.ferramenta === 'editar' || t.ferramenta === 'inserir') && ev.button === 0) return;
      if (ev.button !== 0 && ev.button !== 1) return;
      arrasto = { x: ev.clientX, y: ev.clientY, tx: t.x, ty: t.y, moveu: false, id: ev.pointerId };
    });
    cv.addEventListener('pointermove', function (ev) {
      if (!arrasto) return;
      var proto = A.proto(S.rota.p), t = A.trab(proto);
      var dx = ev.clientX - arrasto.x, dy = ev.clientY - arrasto.y;
      if (!arrasto.moveu && Math.abs(dx) + Math.abs(dy) < 4) return;
      /* só captura o ponteiro quando o arraste começa: um clique simples
         precisa chegar à tela que está embaixo dele */
      if (!arrasto.moveu) { try { cv.setPointerCapture(arrasto.id); } catch (e) { /* ponteiro já solto */ } }
      arrasto.moveu = true; cv.classList.add('arrastando');
      t.x = arrasto.tx + dx; t.y = arrasto.ty + dy;
      aplicarTransform(); posicionarOverlays(); A.posicionarCursor();
    });
    cv.addEventListener('pointermove', function (ev) {
      var mira = document.getElementById('mira-ins');
      if (!mira) return;
      var proto = A.proto(S.rota.p), t = A.trab(proto);
      var p = (!t.ins || t.ins.fase === 'config') && !(arrasto && arrasto.moveu) ? pontoInsercao(ev) : null;
      if (!p || p.atual) { mira.hidden = true; return; }
      var r = p.el.getBoundingClientRect(), cr = cv.getBoundingClientRect();
      mira.hidden = false;
      mira.style.left = (r.left - cr.left) + 'px';
      mira.style.width = r.width + 'px';
      mira.style.top = ((p.pos === 'antes' ? r.top : r.bottom) - cr.top) + 'px';
      mira.querySelector('span').textContent = 'Inserir ' + (p.pos === 'antes' ? 'antes ' : 'depois ') + A.refBloco(p.el.dataset.pickLabel);
    });
    var fim = function () {
      if (!arrasto) return;
      if (arrasto.moveu) { cv._acabouDeArrastar = true; setTimeout(function () { cv._acabouDeArrastar = false; }, 0); }
      arrasto = null; cv.classList.remove('arrastando');
    };
    cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim);
    cv.addEventListener('wheel', function (ev) {
      if (ev.target.closest('.painel-flutua, .pin-bolha, .testar, .canvas-topo')) return;
      var proto = A.proto(S.rota.p), t = A.trab(proto);
      if (ev.target.closest('.aparelho-tela, .janela-tela') && !ev.ctrlKey && !ev.metaKey && t.ferramenta !== 'mover') return;
      ev.preventDefault();
      if (ev.ctrlKey || ev.metaKey) {
        var cr = cv.getBoundingClientRect(), mx = ev.clientX - cr.left, my = ev.clientY - cr.top;
        zoomEm(t, t.zoom * Math.exp(-ev.deltaY * 0.0022), mx, my);
      } else { t.x -= ev.deltaX; t.y -= ev.deltaY; }
      aplicarTransform(); posicionarOverlays(); A.posicionarCursor();
    }, { passive: false });
  }
  function zoomEm(t, z, mx, my) {
    z = Math.max(0.12, Math.min(1.6, z));
    var wx = (mx - t.x) / t.zoom, wy = (my - t.y) / t.zoom;
    t.zoom = z; t.x = mx - wx * z; t.y = my - wy * z;
  }
  document.addEventListener('click', function (ev) {
    if (S.rota.v !== 'trabalho') return;
    var proto = A.proto(S.rota.p);
    if (!proto) return;
    var t = A.trab(proto);
    var testarTela = ev.target.closest && ev.target.closest('#testar-tela');
    if (testarTela) { interagirTestar(proto, t, ev); return; }
    var tela = ev.target.closest && ev.target.closest('#mundo .aparelho-tela, #mundo .janela-tela');
    if (!tela) return;
    var frame = tela.closest('.frame');
    if (!frame || frame.classList.contains('criando')) return;
    var cvEl = document.getElementById('canvas');
    if (cvEl && cvEl._acabouDeArrastar) { ev.preventDefault(); ev.stopPropagation(); return; }
    var propId = frame.dataset.prop, nomeTela = frame.dataset.tela;
    if (t.ferramenta === 'comentar') {
      ev.preventDefault(); ev.stopPropagation();
      if (ev.target.closest('.pin')) return;
      var r = tela.getBoundingClientRect();
      var px = ((ev.clientX - r.left) / r.width) * 100, py = ((ev.clientY - r.top) / r.height) * 100;
      t.comentarios.push({ prop: propId, tela: nomeTela, px: px, py: py, texto: '', salvo: false });
      t.bolha = { i: t.comentarios.length - 1 };
      A.renderCanvas();
      var txt = document.getElementById('txt-pin'); if (txt) txt.focus();
      return;
    }
    if (t.ferramenta === 'inserir') {
      ev.preventDefault(); ev.stopPropagation();
      if (t.ins && t.ins.fase !== 'config') return;
      var pi = pontoInsercao(ev);
      if (!pi) return;
      if (pi.atual) { A.toast('O Atual é a tela de hoje. Insira numa Proposta.', 'info'); return; }
      var ant = t.ins;
      t.ins = { fase: 'config', prop: pi.prop, tela: pi.tela, ancora: pi.el.dataset.pick, ancoraLabel: pi.el.dataset.pickLabel || 'bloco', pos: pi.pos, pedido: ant ? ant.pedido : '', qtd: ant ? ant.qtd : 3, tam: ant ? ant.tam : 'm', idx: 0, progresso: 0, tipo: null };
      t.proposta = pi.prop; t.tela = pi.tela;
      A.renderCanvas();
      var campoIns = document.getElementById('ins-pedido'); if (campoIns) campoIns.focus();
      return;
    }
    if (t.ferramenta === 'editar') {
      ev.preventDefault(); ev.stopPropagation();
      if (t.live && t.live.fase !== 'config') return;
      if (propId === 'atual') { A.toast('O Atual é a tela de hoje. Edite uma Proposta.', 'info'); return; }
      var alvo = ev.target.closest('[data-pick]');
      if (!alvo) return;
      t.picked = { id: alvo.dataset.pick, label: alvo.dataset.pickLabel, prop: propId, tela: nomeTela };
      t.proposta = propId; t.tela = nomeTela;
      t.live = { fase: 'config', acao: /Botão|Caixa|Seletor|Rótulo|Campo/.test(alvo.dataset.pickLabel) ? 'clarify' : 'layout', qtd: 3, pedido: '', idx: 0, progresso: 0 };
      A.renderCanvas();
      return;
    }
    ev.preventDefault();
    if (t.proposta === propId && t.tela === nomeTela) return;
    if (propId) { t.proposta = propId; }
    t.tela = nomeTela;
    A.renderCanvas();
    if (!S._dicaTestar) { S._dicaTestar = true; A.toast('Duplo clique aproxima a tela. Para tocar nos botões como cliente, use Testar.', 'testar'); }
  }, true);
  document.addEventListener('dblclick', function (ev) {
    if (S.rota.v !== 'trabalho') return;
    var fr = ev.target.closest && ev.target.closest('#mundo .frame[data-prop]');
    if (!fr) return;
    var proto = A.proto(S.rota.p), t = A.trab(proto);
    if (t.ferramenta === 'comentar' || t.ferramenta === 'editar' || t.ferramenta === 'inserir') return;
    t.proposta = fr.dataset.prop; t.tela = fr.dataset.tela;
    if (focarFrame(proto, t, t.proposta, t.tela)) { A.renderCanvas(); aplicarTransform(true); }
  });
  function interagirTestar(proto, t, ev) {
    var ir = ev.target.closest('[data-goto]');
    if (ir && !ir.disabled) { t.testarTela = ir.dataset.goto; t.estado.guia = false; atualizarTestar(proto, t); return; }
    var a = ev.target.closest('[data-act]');
    if (!a) return;
    var act = a.dataset.act;
    if (act === 'termos') { t.estado.termos = a.checked; if (a.checked) t.estado.guia = false; setTimeout(function () { atualizarTestar(proto, t); }, 0); }
    else if (act === 'guia') { t.estado.guia = true; atualizarTestar(proto, t); }
    else if (act === 'periodo') { t.estado.periodo = a.dataset.valor; atualizarTestar(proto, t); }
    else if (act === 'mes') { t.estado.periodo = a.dataset.mes === 'Abr' ? 'Abril de 2026' : 'Últimos 90 dias'; atualizarTestar(proto, t); }
    else if (act === 'notif') { t.estado.notif = false; atualizarTestar(proto, t); }
    else if (act === 'colar') { t.estado.colado = true; atualizarTestar(proto, t); }
  }
  function atualizarTestar(proto, t) {
    var cv = document.getElementById('canvas'), box = cv && cv.querySelector('.testar');
    if (!box) return;
    var tmp = document.createElement('div'); tmp.innerHTML = testarHtml(proto, t);
    box.replaceWith(tmp.firstChild);
    ajustarTestar();
  }
  function ajustarTestar() {
    var ap = document.getElementById('aparelho-testar'), palco = document.getElementById('testar-palco');
    if (!ap || !palco) return;
    ap.style.zoom = 1;
    var z = Math.min(1, (palco.clientWidth - 24) / ap.offsetWidth, (palco.clientHeight - 12) / ap.offsetHeight);
    ap.style.zoom = Math.max(0.4, z).toFixed(3);
  }
  A.aoRedimensionar = function () { if (S.rota.v === 'trabalho') { posicionarOverlays(); A.posicionarCursor(); ajustarTestar(); ajustarAbas(); } };

  /* ---------------------------------------------------------------- */
  /* Menus da vista de trabalho                                         */
  /* ---------------------------------------------------------------- */
  A.pops.historico = function (x) {
    var proto = A.proto(x.proto), t = A.trab(proto);
    return '<p class="pop-titulo">Pontos de restauração · voltar não apaga nada</p><div class="historico-lista">' + proto.pontos.slice().reverse().map(function (p) {
      var aqui = p.id === t.aqui;
      return '<div class="hist-item' + (aqui ? ' aqui' : '') + '"><span class="hist-marca" aria-hidden="true"></span><div class="hist-corpo"><b>' + esc(p.titulo) + (aqui ? ' · você está aqui' : '') + '</b><small>' + esc(p.quando) + (p.detalhe ? ' · ' + esc(p.detalhe) : '') + '</small>' +
        (!aqui ? (t.confirmaVolta === p.id ? '<span style="display:flex;gap:6px;margin-top:4px"><button class="btn btn-pri btn-p" data-act="volta-confirmar" data-id="' + p.id + '">Voltar para cá</button><button class="btn btn-ter btn-p" data-act="volta-cancelar">Cancelar</button></span>' : '<button class="btn btn-ter btn-p" style="padding-inline:0" data-act="volta-pedir" data-id="' + p.id + '">' + ic('voltar') + 'Voltar para este ponto</button>') : '') + '</div></div>';
    }).join('') + '</div>';
  };
  A.pops['dores-ctx'] = function (x) {
    var proto = A.proto(x.proto);
    return '<p class="pop-titulo">Dores ligadas a este Protótipo</p>' + proto.dores.map(A.dor).map(function (d) {
      return '<button class="pop-item" data-act="abrir-dor" data-id="' + d.id + '"><span class="chip-fonte f-' + d.fonte + '">' + ic(d.fonte) + '</span><span class="pop-txt"><b>' + esc(d.titulo) + '</b><small>' + A.fonte(d.fonte).nome + ' · ' + A.volumeTxt(d) + '</small></span></button>';
    }).join('');
  };
  A.pops.compartilhar = function (x) {
    return '<p class="pop-titulo">Levar a Proposta adiante</p>' +
      '<button class="pop-item" data-act="abrir-roadmap" data-tipo="publicar"><span class="pop-novo-ic">' + ic('nuvem') + '</span><span class="pop-txt"><b>Publicar para teste</b><small>Gera o endereço para o teste com clientes</small></span>' + A.proximaTag() + '</button>' +
      '<button class="pop-item" data-act="abrir-roadmap" data-tipo="testar"><span class="pop-novo-ic">' + ic('teste') + '</span><span class="pop-txt"><b>Testar com clientes</b><small>Hipótese, ferramenta e resultado</small></span>' + A.proximaTag() + '</button>' +
      '<button class="pop-item" data-act="abrir-roadmap" data-tipo="figma"><span class="pop-novo-ic">' + ic('quadro') + '</span><span class="pop-txt"><b>Enviar ao Figma</b><small>As telas viram camadas editáveis</small></span>' + A.proximaTag() + '</button>' +
      '<hr><button class="pop-item" data-act="ir" data-hash="#apresentar.' + x.proto + '"><span class="pop-novo-ic">' + ic('apresentar') + '</span><span class="pop-txt"><b>Apresentar</b><small>A história Dor → Relatório → Proposta</small></span></button>';
  };

  /* ---------------------------------------------------------------- */
  /* Ações                                                              */
  /* ---------------------------------------------------------------- */
  var AC = A.acoes;
  function cur() { var p = A.proto(S.rota.p); return { proto: p, t: A.trab(p) }; }
  AC.vista = function (el) {
    var c = cur(); c.t.vista = el.dataset.v;
    if (c.t.vista === 'canvas') c.t.enquadrado = false;
    A.render();
  };
  AC.ferramenta = function (el) {
    var c = cur(), f = el.dataset.f;
    A.limparToasts();
    c.t.ferramenta = c.t.ferramenta === f ? null : f;
    if (c.t.ferramenta !== 'editar') { c.t.picked = null; c.t.live = null; }
    if (c.t.ferramenta !== 'inserir') c.t.ins = null;
    var aoVivo = c.t.ferramenta === 'editar' || c.t.ferramenta === 'inserir';
    if (aoVivo && c.t.proposta === 'atual') { var at = A.ativa(c.proto); if (at && at.id !== 'atual') c.t.proposta = at.id; }
    c.t.bolha = null;
    A.renderCanvas();
    if (aoVivo && c.t.zoom < 0.55 && focarFrame(c.proto, c.t, c.t.proposta, c.t.tela)) aplicarTransform(true);
  };
  AC.proposta = function (el) { var c = cur(); c.t.proposta = el.dataset.id; c.t.picked = null; c.t.live = null; c.t.entra = {}; c.t.entra[el.dataset.id] = true; A.renderCanvas(); };
  AC['tornar-ativa'] = function () {
    var c = cur(), p = proposta(c.proto, c.t.proposta);
    c.proto.propostas.forEach(function (x) { if (x.estado === 'ativa') x.estado = 'rascunho'; });
    p.estado = 'ativa';
    A.addPonto(c.proto, p.nome + ' virou a ativa', p.titulo || '');
    A.renderTrabalhoParcial(); A.toast(p.nome + ' é a Proposta ativa');
  };
  AC['nova-proposta'] = function () { var c = cur(); S.conversas[c.proto.id].msgs.push({ tipo: 'usuario', texto: 'Nova Proposta', quando: A.agora(), atalho: true }); A.renderMsgs(); A.respostaAtalho(c.proto, 'nova'); };
  AC.atalho = function (el) {
    var c = cur(), conv = S.conversas[c.proto.id];
    if (conv.ocupado) { A.toast('Espere o agente terminar a resposta', 'info'); return; }
    conv.msgs.push({ tipo: 'usuario', texto: el.textContent.trim(), quando: A.agora(), atalho: true });
    A.renderMsgs(); A.respostaAtalho(c.proto, el.dataset.id);
  };
  AC.device = function (el) { var c = cur(); c.t.device = el.dataset.d; c.t.picked = null; c.t.live = null; enquadrar(c.proto, c.t); A.renderCanvas(); };
  AC.zoom = function (el) {
    var c = cur(), cv = document.getElementById('canvas');
    zoomEm(c.t, c.t.zoom * (el.dataset.d === '1' ? 1.25 : 1 / 1.25), cv.clientWidth / 2, cv.clientHeight / 2);
    aplicarTransform(true);
  };
  AC.enquadrar = function () { var c = cur(); if (enquadrar(c.proto, c.t)) aplicarTransform(true); };
  AC.testar = function () {
    var c = cur();
    c.t.testar = true; c.t.testarTela = c.t.tela || c.proto.telaInicial; c.t.estado.notif = undefined;
    if (c.t.proposta === 'atual') { /* testar o Atual também vale */ }
    A.renderCanvas();
  };
  AC['sair-testar'] = function () { var c = cur(); c.t.testar = false; A.renderCanvas(); };
  AC['testar-tela'] = function (el) { var c = cur(); c.t.testarTela = el.dataset.t; atualizarTestar(c.proto, c.t); };
  AC['ver-canvas'] = function (el) {
    var c = cur(), mobile = window.innerWidth <= 820;
    c.t.proposta = el.dataset.proposta; c.t.tela = el.dataset.tela; c.t.vista = 'canvas';
    c.t.destaque = { tela: el.dataset.tela, ate: Date.now() + 2600 };
    if (mobile) { c.t.enquadrado = true; A.render(); } else A.renderCanvas();
    if (focarFrame(c.proto, c.t, c.t.proposta, c.t.tela)) aplicarTransform(!mobile);
  };
  AC['ver-historico'] = function () { var b = document.getElementById('btn-hist'); if (b) A.abrirPop(b, 'historico', { proto: S.rota.p, alinhar: 'direita' }); };
  AC['volta-pedir'] = function (el) { var c = cur(); c.t.confirmaVolta = el.dataset.id; A.renderCamadas(); };
  AC['volta-cancelar'] = function () { var c = cur(); c.t.confirmaVolta = null; A.renderCamadas(); };
  AC['volta-confirmar'] = function (el) {
    var c = cur(), p = c.proto.pontos.filter(function (x) { return x.id === el.dataset.id; })[0];
    c.t.aqui = p.id; c.t.confirmaVolta = null; S.pop = null;
    var idx = c.proto.pontos.indexOf(p);
    if (c.proto.id === 'remessa' && idx <= 1) c.t.proposta = 'atual';
    A.renderCamadas(); A.renderTrabalhoParcial();
    A.toast('Voltou para “' + p.titulo + '”. Os pontos depois dele continuam guardados.', 'voltar');
  };
  /* Comentários */
  AC['abrir-pin'] = function (el) { var c = cur(); c.t.bolha = { i: Number(el.dataset.i) }; A.renderCanvas(); };
  AC['salvar-pin'] = function () {
    var c = cur(), txt = document.getElementById('txt-pin'), cm = c.t.comentarios[c.t.bolha.i];
    if (!txt.value.trim()) { txt.focus(); return; }
    cm.texto = txt.value.trim(); cm.salvo = true; c.t.bolha = null;
    A.renderCanvas();
  };
  AC['apagar-pin'] = function () { var c = cur(); c.t.comentarios.splice(c.t.bolha.i, 1); c.t.bolha = null; A.renderCanvas(); };
  AC['fechar-pin'] = function () { var c = cur(); c.t.bolha = null; A.renderCanvas(); };
  AC['enviar-comentarios'] = function () {
    var c = cur(), conv = S.conversas[c.proto.id];
    var lista = c.t.comentarios.filter(function (x) { return x.salvo && !x.resolvido; }).map(function (x) { return { texto: x.texto, tela: DS.protos.nomeTela(x.tela) }; });
    if (!lista.length) return;
    conv.msgs.push({ tipo: 'usuario', texto: 'Aplique estes comentários:', comentarios: lista, quando: A.agora() });
    c.t.ferramenta = null;
    A.renderTrabalhoParcial();
    A.respostaLivreProto(c.proto, '', { comentarios: lista });
  };
  document.addEventListener('keydown', function (ev) {
    if (ev.target && ev.target.id === 'txt-pin' && ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); AC['salvar-pin'](); }
    if (ev.target && ev.target.id === 'vivo-pedido' && ev.key === 'Enter') { ev.preventDefault(); AC['vivo-gerar'](); }
    if (ev.target && ev.target.id === 'ins-pedido' && ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); AC['ins-gerar'](); }
  });
  /* Ajustes */
  document.addEventListener('input', function (ev) {
    var k = ev.target.dataset && ev.target.dataset.tweak;
    if (!k || S.rota.v !== 'trabalho') return;
    var c = cur();
    c.t.tweaks = c.t.tweaks || { densidade: 1, texto: 1, cantos: 16, cor: '#FF6200' };
    c.t.tweaks[k] = Number(ev.target.value);
    var out = document.getElementById('out-' + k);
    if (out) out.textContent = k === 'cantos' ? ev.target.value + ' px' : Math.round(ev.target.value * 100) + '%';
    var estilo = estiloTweaks(c.t);
    document.querySelectorAll('#mundo .frame[data-prop]:not([data-prop="atual"]) .pt').forEach(function (pt) { pt.setAttribute('style', estilo); pt.classList.add('pt-ajustado'); });
  });
  AC['tweak-cor'] = function (el) { var c = cur(); c.t.tweaks = c.t.tweaks || { densidade: 1, texto: 1, cantos: 16, cor: '#FF6200' }; c.t.tweaks.cor = el.dataset.cor; A.renderCanvas(); };
  AC['tweak-reset'] = function () { var c = cur(); c.t.tweaks = null; A.renderCanvas(); };
  AC['tweak-aplicar'] = function () {
    var c = cur(), conv = S.conversas[c.proto.id], w = c.t.tweaks;
    if (!w) { A.toast('Mexa num ajuste primeiro', 'info'); return; }
    conv.msgs.push({ tipo: 'usuario', texto: 'Aplicar os ajustes: densidade ' + Math.round(w.densidade * 100) + '%, texto ' + Math.round(w.texto * 100) + '%, cantos ' + w.cantos + ' px.', quando: A.agora() });
    c.t.ferramenta = null; A.renderTrabalhoParcial();
    A.agenteFala({ tipo: 'proto', id: c.proto.id }, { texto: ['Apliquei os ajustes em todas as telas da ' + (proposta(c.proto, c.t.proposta) || {}).nome + ' e conferi o contraste da nova cor da ação principal.'], acoes: ['Atualizou estilos de ' + A.plural(c.proto.telas.length, 'tela', 'telas'), 'Conferiu o Protótipo: abre sem erros'] },
      { depois: function () { c.t.destaque = { tela: '*', ate: Date.now() + 2400 }; A.addPonto(c.proto, 'Ajustes aplicados', 'Densidade, texto, cantos e cor'); } });
  };
  /* Editar: Variantes */
  AC['vivo-fechar'] = function () { var c = cur(); clearInterval(c.t._gerando); c.t.picked = null; c.t.live = null; A.renderCanvas(); };
  AC['vivo-acao'] = function (el) { var c = cur(); c.t.live.acao = el.dataset.id; lerPedido(c.t); A.renderCanvas(); };
  AC['vivo-qtd'] = function (el) { var c = cur(); c.t.live.qtd = Number(el.dataset.n); lerPedido(c.t); A.renderCanvas(); };
  function lerPedido(t) { var i = document.getElementById('vivo-pedido'); if (i && t.live) t.live.pedido = i.value; }
  AC['vivo-gerar'] = function () {
    var c = cur(), t = c.t;
    if (!t.live) return;
    lerPedido(t);
    t.live.fase = 'gerando'; t.live.progresso = 0;
    t.cursor = { ativo: true, idx: 0 }; A.renderCanvas(); A.posicionarCursor();
    t._gerando = setInterval(function () {
      if (!t.live) { clearInterval(t._gerando); return; }
      t.live.progresso += 1;
      progressoNoLugar('#painel-vivo', t.live.progresso / t.live.qtd);
      if (t.live.progresso >= t.live.qtd) {
        clearInterval(t._gerando);
        setTimeout(function () { if (!t.live) return; t.live.fase = 'ciclo'; t.live.idx = Math.min(1, t.live.qtd - 1); t.cursor = { ativo: false, ate: Date.now() + 800 }; A.renderCanvas(); }, 300);
      }
    }, 480);
  };
  AC['vivo-ant'] = function () { var c = cur(), n = variantesDe(c.t).length; c.t.live.idx = (c.t.live.idx - 1 + n) % n; A.renderCanvas(); };
  AC['vivo-prox'] = function () { var c = cur(), n = variantesDe(c.t).length; c.t.live.idx = (c.t.live.idx + 1) % n; A.renderCanvas(); };
  AC['vivo-descartar'] = function () { var c = cur(); c.t.picked = null; c.t.live = null; A.renderCanvas(); A.toast('Variantes descartadas. Nada mudou.', 'info'); };
  AC['vivo-aceitar'] = function () {
    var c = cur(), t = c.t, v = varianteAtual(t), pk = t.picked, conv = S.conversas[c.proto.id];
    var acao = D.acoesLive.filter(function (a) { return a.id === t.live.acao; })[0];
    var acc = t.aceitas[pk.prop] = t.aceitas[pk.prop] || { conhecidas: {}, genericas: {} };
    if (DS.protos.variantes[pk.id]) acc.conhecidas[pk.id] = v.n; else acc.genericas[pk.id] = v.n;
    conv.msgs.push({ tipo: 'selecao', elemento: pk.label, acao: acao ? acao.rotulo : 'Livre', pedido: t.live.pedido, quando: A.agora() });
    conv.msgs.push({ tipo: 'agente', agente: t.agente, modelo: t.modelo, quando: A.agora(), texto: ['Apliquei a Variante ' + v.n + ' (' + v.nome.toLowerCase() + ') em ' + pk.label + ', na ' + (proposta(c.proto, pk.prop) || {}).nome + '.'], carimbo: 'Variante ' + v.n + ' aceita', acoes: ['Editou a tela ' + DS.protos.nomeTela(pk.tela), 'Conferiu o Protótipo: abre sem erros'] });
    A.addPonto(c.proto, 'Variante ' + v.n + ' aceita', pk.label);
    t.destaque = { tela: pk.tela, ate: Date.now() + 2200 };
    t.picked = null; t.live = null; t.ferramenta = null;
    A.renderTrabalhoParcial();
    A.toast('Variante aceita · Ponto de restauração criado');
  };
  function progressoNoLugar(painel, frac) {
    var i = document.querySelector(painel + ' .barra-prog i');
    if (i) i.style.width = Math.round(Math.min(1, frac) * 100) + '%';
  }
  /* Inserir: ações do painel */
  function insAtual() { return cur().t.ins; }
  AC['ins-pos'] = function (el) { var I = insAtual(); if (!I) return; I.pos = el.dataset.p; A.renderCanvas(); };
  AC['ins-sugestao'] = function (el) {
    var I = insAtual(); if (!I) return;
    var s = A.inserir.SUGESTOES.filter(function (x) { return x[0] === el.dataset.tipo; })[0];
    I.pedido = s[2];
    A.renderCanvas();
    var b = document.getElementById('ins-gerar'); if (b) b.focus();
  };
  AC['ins-tam'] = function (el) { var I = insAtual(); if (!I) return; I.tam = el.dataset.t; A.renderCanvas(); };
  AC['ins-qtd'] = function (el) { var I = insAtual(); if (!I) return; I.qtd = Number(el.dataset.n); A.renderCanvas(); };
  AC['ins-gerar'] = function () {
    var c = cur(), t = c.t, I = t.ins;
    if (!I) return;
    if (!I.pedido.trim()) { var campo = document.getElementById('ins-pedido'); if (campo) campo.focus(); return; }
    var sug = A.inserir.SUGESTOES.filter(function (x) { return x[2] === I.pedido; })[0];
    I.tipo = sug ? sug[0] : A.inserir.tipoDoPedido(I.pedido);
    I.fase = 'gerando'; I.progresso = 0;
    t.cursor = { ativo: true, idx: 0 };
    A.renderCanvas(); A.posicionarCursor();
    clearInterval(t._gerandoIns);
    t._gerandoIns = setInterval(function () {
      if (!t.ins || t.ins.fase !== 'gerando') { clearInterval(t._gerandoIns); return; }
      t.ins.progresso += 1;
      progressoNoLugar('#painel-ins', t.ins.progresso / t.ins.qtd);
      var rot = document.querySelector('#mundo .ins-vaga span');
      if (rot) rot.textContent = 'Gerando Variante ' + Math.min(t.ins.progresso + 1, t.ins.qtd) + ' de ' + t.ins.qtd + '…';
      if (t.ins.progresso >= t.ins.qtd) {
        clearInterval(t._gerandoIns);
        setTimeout(function () { if (!t.ins) return; t.ins.fase = 'ciclo'; t.ins.idx = 0; t.cursor = { ativo: false, ate: Date.now() + 900 }; A.renderCanvas(); }, 300);
      }
    }, 520);
  };
  AC['ins-ant'] = function () { var I = insAtual(), n = A.inserir.variantes(I.tipo, I.qtd).length; I.idx = (I.idx - 1 + n) % n; A.renderCanvas(); };
  AC['ins-prox'] = function () { var I = insAtual(), n = A.inserir.variantes(I.tipo, I.qtd).length; I.idx = (I.idx + 1) % n; A.renderCanvas(); };
  AC['ins-fechar'] = function () { var c = cur(); clearInterval(c.t._gerandoIns); c.t.ins = null; A.renderCanvas(); };
  AC['ins-descartar'] = function () { AC['ins-fechar'](); A.toast('Variantes descartadas. Nada foi inserido.', 'info'); };
  AC['ins-aceitar'] = function () {
    var c = cur(), t = c.t, I = t.ins, v = varianteIns(I), conv = S.conversas[c.proto.id];
    var id = 'ins-' + String(Date.now()).slice(-6), tipoNome = A.inserir.TIPOS[I.tipo].nome;
    var porTela = (t.inseridos[I.prop] = t.inseridos[I.prop] || {});
    (porTela[I.tela] = porTela[I.tela] || []).push({ id: id, ancora: I.ancora, pos: I.pos, tipo: I.tipo, n: v.n, pedido: I.pedido });
    var nomeTela = DS.protos.nomeTela(I.tela), nomeProp = (proposta(c.proto, I.prop) || {}).nome || 'Proposta';
    conv.msgs.push({ tipo: 'insercao', posicao: I.pos, ancora: I.ancoraLabel, tipoNome: tipoNome, pedido: I.pedido, quando: A.agora() });
    conv.msgs.push({ tipo: 'agente', agente: t.agente, modelo: t.modelo, quando: A.agora(),
      texto: ['Inseri ' + FRASE[I.tipo] + ' (' + v.nome.toLowerCase() + ') ' + (I.pos === 'antes' ? 'antes ' : 'depois ') + A.refBloco(I.ancoraLabel) + ', na tela ' + nomeTela + ' da ' + nomeProp + '. Usei os componentes e os tokens do design system do Protótipo.'],
      carimbo: tipoNome + ' inserido · Variante ' + v.n, acoes: ['Criou um elemento novo na tela ' + nomeTela, 'Conferiu o Protótipo: abre sem erros'] });
    A.addPonto(c.proto, tipoNome + ' inserido', nomeTela + ' · ' + nomeProp);
    t.destaque = { tela: I.tela, ate: Date.now() + 2200 };
    t.ins = null; t.ferramenta = null;
    A.renderTrabalhoParcial();
    A.toast('Elemento inserido · Ponto de restauração criado');
  };
  document.addEventListener('input', function (ev) {
    if (ev.target.id !== 'ins-pedido' || S.rota.v !== 'trabalho') return;
    var I = cur().t.ins;
    if (!I) return;
    I.pedido = ev.target.value;
    var b = document.getElementById('ins-gerar'); if (b) b.disabled = !I.pedido.trim();
    document.querySelectorAll('#painel-ins [data-act="ins-sugestao"]').forEach(function (x) {
      var s = A.inserir.SUGESTOES.filter(function (y) { return y[0] === x.dataset.tipo; })[0];
      x.setAttribute('aria-pressed', String(s[2] === I.pedido));
    });
  });
  A.escapeTrabalho = function () {
    if (S.rota.v !== 'trabalho') return false;
    var c = cur(), t = c.t;
    if (t.testar) { AC['sair-testar'](); return true; }
    if (t.bolha) { AC['fechar-pin'](); return true; }
    if (t.live || t.picked) { AC['vivo-fechar'](); return true; }
    if (t.ins) { AC['ins-fechar'](); return true; }
    if (t.ferramenta) { t.ferramenta = null; A.renderCanvas(); return true; }
    return false;
  };
})();
