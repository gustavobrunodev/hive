/* Design Studio — Início (chat como primeira tela) e conversas sem
   Protótipo. Enviar daqui leva para a vista de trabalho ou para a conversa. */
(function () {
  'use strict';
  var A = DS.app, D = A.D, S = A.S, ic = A.ic, esc = A.esc, fmt = A.fmt;

  /* modo 'mini': só desenho (miniaturas dentro de botões e links, sem nada
     clicável ou focável); 'quadro': fora da ordem do Tab e do leitor de tela,
     mas ainda clicável para Comentar e Editar; sem modo: interativo (Testar) */
  A.ptHtml = function (app, tela, flags, estado, cls, estilo, modo, insercoes) {
    var html = DS.protos.render(app, tela, flags, estado || {});
    if (insercoes && insercoes.length) html = A.aplicarInsercoes(html, insercoes);
    if (modo === 'mini') {
      html = html.replace(/\sdata-(act|goto|pick|pick-label)="[^"]*"/g, '').replace(/\srole="[^"]*"/g, '')
        .replace(/<button\b/g, '<span').replace(/<\/button>/g, '</span>').replace(/<a\b/g, '<span').replace(/<\/a>/g, '</span>')
        .replace(/<input\b/g, '<input tabindex="-1" disabled');
    } else if (modo === 'quadro') html = html.replace(/<(button|a|input|select|textarea|summary)\b/g, '<$1 tabindex="-1"');
    /* títulos das telas internas não entram na hierarquia de títulos do app */
    if (modo) html = html.replace(/<h[1-6]\b/g, '<div').replace(/<\/h[1-6]>/g, '</div>');
    return '<div class="pt ' + (cls || '') + '"' + (estilo ? ' style="' + estilo + '"' : '') + (modo ? ' aria-hidden="true"' : '') + '>' + html + '</div>';
  };
  /* Encaixa elementos novos (Inserir) antes ou depois de um bloco da tela:
     [{ ancora: data-pick, pos: 'antes'|'depois', html }] */
  A.aplicarInsercoes = function (html, lista) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    lista.forEach(function (ins) {
      var alvo = tpl.content.querySelector('[data-pick="' + ins.ancora + '"]');
      if (alvo) alvo.insertAdjacentHTML(ins.pos === 'antes' ? 'beforebegin' : 'afterend', ins.html);
    });
    return tpl.innerHTML;
  };
  var GIROS = ['-1.8deg', '1.2deg', '-0.6deg', '1.7deg', '-1.2deg', '0.8deg', '-1.5deg', '1deg'];
  var IMP = { alto: 'Alto', medio: 'Médio', baixo: 'Baixo' };
  A.notaHtml = function (d, opts) {
    opts = opts || {};
    var fo = A.fonte(d.fonte);
    return '<button class="nota nota-' + d.fonte + '" style="--r:' + (opts.giro || GIROS[(d.rank + d.fonte.length) % GIROS.length]) + '" data-act="' + (opts.acao || 'nota-citar') + '" data-id="' + d.id + '"' + (opts.pressed != null ? ' aria-pressed="' + opts.pressed + '"' : '') + ' title="' + esc(d.resumo) + '">' +
      '<span class="nota-check" aria-hidden="true">' + ic('ok') + '</span>' +
      '<span class="nota-titulo">' + esc(d.titulo) + '</span>' +
      '<span class="nota-pe"><span class="nota-vol">' + ic(d.fonte) + '<span>' + fmt(d.volume) + ' ' + (d.fonte === 'fullstory' ? 'clientes' : fo.unidadeDor) + '</span></span>' +
      '<span class="nota-imp ' + d.impacto + '"><span class="sr">Impacto </span>' + IMP[d.impacto] + '</span>' + A.tendencia(d) + '</span></button>';
  };
  function produtoDoComposer() {
    var c = A.cmp('inicio');
    if (c.proto !== 'novo' && c.proto !== 'nenhum' && A.proto(c.proto)) return A.proto(c.proto).produto;
    return c.produtoNovo === 'produto-novo' ? 'cambio' : c.produtoNovo;
  }

  /* ---------------------------------------------------------------- */
  /* Início                                                             */
  /* ---------------------------------------------------------------- */
  A.vistas.inicio = function () {
    var nome = 'Marina';
    A.depois.push(function () { var t = document.getElementById('txt-inicio'); if (t && !S.semFocoInicial) t.focus(); });
    return '<div class="inicio quadro-fundo">' +
      '<div class="inicio-centro"><div class="saudacao"><h1>' + A.saudacao() + ', ' + nome + '. O que vamos melhorar hoje?</h1>' +
      '<p>Converse com o agente, cite as Dores dos clientes e veja o Protótipo nascer no quadro.</p></div>' +
      A.composerHtml('inicio', 'inicio') +
      '<p class="cmp-dica"><kbd>Enter</kbd> envia · <kbd>Shift</kbd>+<kbd>Enter</kbd> quebra a linha · <kbd>Ctrl</kbd>+<kbd>V</kbd> cola prints · <kbd>@</kbd> cita Dores</p>' + A.seloExemplo() + '</div>' +
      '<div id="inicio-secoes" style="display:contents">' + secoesInicio() + '</div></div>';
  };
  function secoesInicio() {
    var c = A.cmp('inicio'), prod = produtoDoComposer(), p = A.produto(prod), g = S.gerados[prod] || {};
    var temAlguma = A.FONTES.some(function (f) { return g[f]; });
    var emAlta = function (a, b) { return A.ordemImpacto[a.impacto] - A.ordemImpacto[b.impacto] || b.tendencia - a.tendencia; };
    var giro = 0;
    var clusters = A.FONTES.map(function (f) {
      var fo = A.fonte(f);
      var cab = '<div class="cluster-cab"><span class="chip-fonte f-' + f + '">' + ic(f) + '</span><b>' + fo.nome + '</b>' + (g[f] ? '<a href="#dores" data-act="ver-dores" data-produto="' + prod + '">Ver todas</a>' : '') + '</div>';
      if (!g[f]) {
        var gerandoAqui = S.gerando && S.gerando.produto === prod && S.gerando.fonte === f;
        return '<div class="cluster">' + cab + '<div class="cluster-vazio">' + (gerandoAqui ? '<span role="status">Gerando o Relatório de ' + fo.nome + '… ' + (S.gerando.passo + 1) + ' de 4</span>'
          : '<span>Ainda sem Relatório de ' + fo.nome + '</span><button class="btn btn-sec btn-p" data-act="gerar-relatorio" data-produto="' + prod + '" data-fonte="' + f + '">' + ic('relatorio') + 'Gerar</button>') + '</div></div>';
      }
      return '<div class="cluster">' + cab + '<div class="cluster-notas">' + A.doresDe(prod, f).sort(emAlta).slice(0, 2).map(function (d) {
        return A.notaHtml(d, { pressed: c.dores.indexOf(d.id) >= 0, giro: GIROS[giro++ % GIROS.length] });
      }).join('') + '</div></div>';
    }).join('');
    var seg = '<div class="segmentado" role="group" aria-label="Produto">' + D.produtos.map(function (x) {
      return '<button data-act="inicio-produto" data-id="' + x.id + '" aria-pressed="' + (x.id === prod) + '">' + x.nome + '</button>';
    }).join('') + '</div>';
    var notas = temAlguma
      ? '<div class="notas-grade">' + clusters + '</div>'
      : '<div class="coluna-vazia" style="max-width:520px"><b style="color:var(--tinta)">' + p.nome + ' ainda não tem Relatórios de Fonte.</b><span>O agente lê os dados do período, agrupa por tema e ranqueia as Dores. Leva alguns segundos.</span><button class="btn btn-pri btn-p" data-act="gerar-primeiro" data-produto="' + prod + '">' + ic('relatorio') + 'Gerar o primeiro Relatório de ' + p.nome + '</button></div>';
    var recentes = S.prototipos.slice(0, 4).map(function (x) {
      var at = A.ativa(x), atual = x.propostas.filter(function (q) { return q.id === 'atual'; })[0];
      var telas = (atual ? '<span class="mini-tela" aria-hidden="true"><span class="mini-tela-in">' + A.ptHtml(x.app, x.telaInicial, {}, {}, '', '', 'mini') + '</span></span>' : '') +
        (at && at.id !== 'atual' ? '<span class="mini-tela" aria-hidden="true"><span class="mini-tela-in">' + A.ptHtml(x.app, x.telaInicial, at.flags, {}, '', '', 'mini') + '</span></span>' : '');
      return '<a class="cartao-frame" href="#trabalho.' + x.id + '"><span class="cartao-frame-rotulo">' + ic('camadas') + '<b>' + esc(x.nome) + '</b></span>' +
        '<span class="cartao-frame-palco">' + (telas || '<span class="vazio">Criando…</span>') + '</span>' +
        '<span class="cartao-frame-sub">' + A.produto(x.produto).nome + ' · ' + (at ? esc(at.nome) + ' ativa' : 'sem Proposta') + ' · ' + esc(x.atualizado) + '</span></a>';
    }).join('');
    return '<section class="inicio-secao" aria-labelledby="t-dores-alta"><div class="inicio-secao-topo"><div><h2 id="t-dores-alta">Dores em alta</h2><p>Toque numa nota para citá-la no pedido.</p></div>' + seg + '</div>' + notas + '</section>' +
      '<section class="inicio-secao" aria-labelledby="t-continuar"><div class="inicio-secao-topo"><h2 id="t-continuar">Continuar</h2><a class="btn btn-ter btn-p" href="#prototipos">Ver todos ' + ic('seta') + '</a></div><div class="continuar">' + recentes + '</div></section>';
  }
  A.aoMudarComposer = function (ch, digitando) {
    if (ch !== 'inicio' || digitando) return;
    var box = document.getElementById('inicio-secoes');
    if (box) box.innerHTML = secoesInicio();
  };

  /* ---------------------------------------------------------------- */
  /* Começar: Protótipo novo, existente, ou conversa sem Protótipo      */
  /* ---------------------------------------------------------------- */
  var APPS = { remessa: ['revisar', 'confirmar', 'acompanhar'], extrato: ['extrato', 'periodo'], reserva: ['meta'], pix: ['agendados', 'colar'] };
  function nomeDoPedido(pacote) {
    if (pacote.dores.length) {
      var d = A.dor(pacote.dores[0]);
      return A.estacao(d.produto, d.estacao).nome + ' · ' + (d.titulo.length > 34 ? d.titulo.slice(0, 34).replace(/\s+\S*$/, '') + '…' : d.titulo);
    }
    var t = pacote.texto.replace(/[.!?].*$/, '');
    return t.length > 42 ? t.slice(0, 42).replace(/\s+\S*$/, '') + '…' : t;
  }
  A.iniciarPrototipo = function (produto, msg, pacote) {
    var tipo = produto === 'produto-novo' ? 'novo' : 'existente';
    var prod = tipo === 'novo' ? 'cambio' : produto;
    var app = tipo === 'novo' ? 'reserva' : prod === 'extrato' ? 'extrato' : prod === 'pix' ? 'pix' : 'remessa';
    var telas = APPS[app];
    var proto = {
      id: 'p' + String(Date.now()).slice(-7), produto: prod, nome: nomeDoPedido(pacote), tipo: tipo,
      dores: pacote.dores.slice(), referencias: pacote.anexos.map(function (a) { return { tipo: a.tipo === 'imagem' ? 'print' : a.tipo, nome: a.nome }; }),
      briefing: tipo === 'novo' ? pacote.texto : '', agente: pacote.agente, atualizado: 'agora', criado: 'hoje',
      app: app, telas: telas, telaInicial: app === 'remessa' ? 'acompanhar' : telas[0],
      propostas: tipo === 'novo' ? [] : [{ id: 'atual', nome: 'Atual', estado: 'atual', resumo: 'A tela de hoje, recriada pelo agente.', flags: {} }],
      pontos: [{ id: 'p1', quando: 'hoje, ' + A.agora(), titulo: 'Protótipo criado', detalhe: pacote.dores.length ? A.plural(pacote.dores.length, 'Dor', 'Dores') : 'A partir do pedido' }],
      recemCriado: true,
    };
    S.prototipos.unshift(proto);
    S.conversas[proto.id] = { msgs: [msg], ocupado: false };
    var t = A.trab(proto); t.agente = pacote.agente; t.modelo = pacote.modelo;
    A.ir('#trabalho.' + proto.id);
  };
  A.continuarPrototipo = function (id, msg, pacote) {
    var proto = A.proto(id);
    S.conversas[id].msgs.push(msg);
    var t = A.trab(proto); t.agente = pacote.agente; t.modelo = pacote.modelo;
    if (pacote.dores.length) pacote.dores.forEach(function (d) { if (proto.dores.indexOf(d) < 0) proto.dores.push(d); });
    t.pendente = { texto: pacote.texto, anexos: pacote.anexos };
    A.ir('#trabalho.' + id);
  };
  A.iniciarConversa = function (produto, msg, pacote) {
    var id = 'conv-' + String(Date.now()).slice(-7);
    var titulo = pacote.texto.length > 46 ? pacote.texto.slice(0, 46).replace(/\s+\S*$/, '') + '…' : pacote.texto;
    S.livres[id] = { id: id, titulo: titulo, produto: produto, msgs: msg ? [msg] : [], ocupado: false, quando: 'agora', agente: pacote.agente, modelo: pacote.modelo, pendente: msg ? pacote.texto : null };
    A.ir('#conversa.' + id);
    return S.livres[id];
  };

  /* ---------------------------------------------------------------- */
  /* Conversa sem Protótipo                                             */
  /* ---------------------------------------------------------------- */
  var PERGUNTAS = ['Quais Dores crescem mais?', 'Compare as três Fontes', 'O que a Voz do Cliente diz?', 'Por onde você começaria?'];
  A.vistas.conversa = function () {
    var c = S.livres[S.rota.p];
    if (!c) return '<div class="pagina"><div class="vazio"><h3>Conversa não encontrada</h3><a class="btn btn-sec" href="#inicio">Voltar ao início</a></div></div>';
    var p = A.produto(c.produto), g = S.gerados[c.produto] || {};
    var n = A.FONTES.filter(function (f) { return g[f]; }).length;
    if (c.pendente) { var texto = c.pendente; c.pendente = null; A.depois.push(function () { A.respostaLivre(c, texto, {}); }); }
    A.depois.push(A.rolarFim);
    return '<div class="conversa-livre"><header class="chat-cab"><div class="chat-cab-linha"><h1>' + esc(c.titulo) + '</h1></div>' +
      '<div class="chat-contexto"><span class="ctx-chip">' + ic('dor') + p.nome + '</span><span class="ctx-chip">' + ic('relatorio') + n + ' de 3 Relatórios</span><span class="ctx-chip">' + ic('conversa') + 'Sem Protótipo</span>' + A.seloExemplo() + '</div></header>' +
      '<div id="chat-corpo"><div class="msgs" id="msgs" role="log" aria-live="polite">' + c.msgs.map(A.msgHtml).join('') + (c.ocupado ? A.DIGITANDO : '') + '</div></div>' +
      '<div class="chat-pe"><div class="atalhos" role="group" aria-label="Perguntas prontas">' + PERGUNTAS.map(function (q) { return '<button class="atalho" data-act="sugestao" data-texto="' + esc(q) + '">' + esc(q) + '</button>'; }).join('') + '</div>' +
      A.composerHtml(c.id, 'compacto') + '</div></div>';
  };

  /* ---------------------------------------------------------------- */
  /* Ações                                                              */
  /* ---------------------------------------------------------------- */
  var AC = A.acoes;
  AC['ver-dores'] = function (el) { S.filtroDores.produto = el.dataset.produto; S.filtroDores.estacao = null; A.ir('#dores'); };
  AC['nova-conversa'] = function () { S.cmp.inicio = null; A.ir('#inicio'); };
  AC['nota-citar'] = function (el) {
    var c = A.cmp('inicio'), id = el.dataset.id, i = c.dores.indexOf(id);
    if (i >= 0) c.dores.splice(i, 1); else c.dores.push(id);
    var d = A.dor(id);
    if (c.proto === 'novo' && c.produtoNovo !== d.produto) c.produtoNovo = d.produto;
    A.renderComposer('inicio', true);
    A.aoMudarComposer('inicio');
  };
  AC['inicio-produto'] = function (el) {
    var c = A.cmp('inicio');
    c.produtoNovo = el.dataset.id;
    if (c.proto !== 'novo' && c.proto !== 'nenhum') c.proto = 'novo';
    c.dores = c.dores.filter(function (id) { return A.dor(id).produto === el.dataset.id; });
    A.renderComposer('inicio');
    A.aoMudarComposer('inicio');
  };
  AC['gerar-primeiro'] = function (el) {
    var prod = el.dataset.produto;
    var msg = { tipo: 'usuario', texto: 'Quero gerar o primeiro Relatório de ' + A.produto(prod).nome, quando: A.agora() };
    var c = A.cmp('inicio');
    A.iniciarConversa(prod, msg, { texto: msg.texto, agente: c.agente, modelo: c.modelo });
  };
  AC.escolha = function (el) {
    var alvo = A.alvoAtual();
    if (!alvo || alvo.tipo !== 'livre') return;
    var c = S.livres[alvo.id];
    c.msgs.push({ tipo: 'usuario', texto: el.dataset.texto, quando: A.agora() });
    A.renderMsgs();
    A.respostaLivre(c, el.dataset.texto, { escolha: el.dataset.valor });
  };
  AC.sugestao = function (el) {
    var alvo = A.alvoAtual();
    if (!alvo) return;
    var ch = alvo.id, c = A.cmp(ch);
    c.texto = el.dataset.texto;
    A.enviarComposer(ch);
  };
  AC['resolver-dor'] = function (el) {
    var d = A.dor(el.dataset.id);
    var alvo = A.alvoAtual();
    var quem = alvo ? A.agenteAtual(alvo) : { agente: S.agentePadrao, modelo: S.modeloPadrao[S.agentePadrao] };
    S.folha = null;
    var msg = { tipo: 'usuario', texto: 'Quero resolver esta Dor.', quando: A.agora(), cita: [d.id] };
    A.iniciarPrototipo(d.produto, msg, { texto: msg.texto, dores: [d.id], anexos: [], agente: quem.agente, modelo: quem.modelo });
  };
  AC['criar-de-conversa'] = function (el) {
    var dores = el.dataset.dores ? el.dataset.dores.split(',') : [];
    var alvo = A.alvoAtual();
    var quem = alvo ? A.agenteAtual(alvo) : { agente: S.agentePadrao, modelo: S.modeloPadrao[S.agentePadrao] };
    var prod = dores.length ? A.dor(dores[0]).produto : 'cambio';
    var msg = { tipo: 'usuario', texto: 'Criar um Protótipo para ' + (dores.length === 1 ? 'esta Dor' : 'estas Dores') + '.', quando: A.agora(), cita: dores };
    A.iniciarPrototipo(prod, msg, { texto: msg.texto, dores: dores, anexos: [], agente: quem.agente, modelo: quem.modelo });
  };
})();
