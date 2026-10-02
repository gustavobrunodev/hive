/* Design Studio — páginas da barra lateral: Protótipos, Dores (com a
   folha de Evidências), Relatórios de Fonte e Configurações. */
(function () {
  'use strict';
  var A = DS.app, D = A.D, S = A.S, ic = A.ic, esc = A.esc, fmt = A.fmt;
  var AC = A.acoes;
  var PASSOS_GERACAO = ['Lendo os dados do período', 'Agrupando por tema', 'Ranqueando as Dores', 'Escrevendo a narrativa'];

  /* ---------------------------------------------------------------- */
  /* Percurso de um Protótipo                                           */
  /* ---------------------------------------------------------------- */
  A.percursoEtapas = function (proto) {
    var pub = S.publicado[proto.id] || {};
    return [
      { nome: proto.tipo === 'novo' ? 'Briefing' : 'Dores', feito: true },
      { nome: 'Proposta', feito: proto.propostas.some(function (p) { return p.id !== 'atual'; }) },
      { nome: 'Publicada', feito: !!pub.url, futura: true },
      { nome: 'Testada', feito: !!pub.validado, futura: true },
      { nome: 'No Figma', feito: !!pub.figma, futura: true },
    ];
  };
  A.percurso = function (proto) {
    var et = A.percursoEtapas(proto), ultimo = 0;
    et.forEach(function (e, i) { if (e.feito) ultimo = i; });
    return '<span class="percurso" role="img" aria-label="Etapa: ' + et[ultimo].nome + ', ' + (ultimo + 1) + ' de ' + et.length + '">' + et.map(function (e, i) {
      return '<i class="' + (i === ultimo ? 'atual' : e.feito ? '' : e.futura ? 'futura' : 'pendente') + '" aria-hidden="true"></i>';
    }).join('') + '<span>' + et[ultimo].nome + '</span></span>';
  };
  function miniTelas(x) {
    var at = A.ativa(x), atual = x.propostas.filter(function (q) { return q.id === 'atual'; })[0];
    return (atual ? '<span class="mini-tela" aria-hidden="true"><span class="mini-tela-in">' + A.ptHtml(x.app, x.telaInicial, {}, {}, '', '', 'mini') + '</span></span>' : '') +
      (at && at.id !== 'atual' ? '<span class="mini-tela" aria-hidden="true"><span class="mini-tela-in">' + A.ptHtml(x.app, x.telaInicial, at.flags, {}, '', '', 'mini') + '</span></span>' : '');
  }

  /* ---------------------------------------------------------------- */
  /* Protótipos                                                         */
  /* ---------------------------------------------------------------- */
  A.vistas.prototipos = function () {
    var f = S.filtroProtos;
    var lista = S.prototipos.filter(function (p) { return f === 'todos' || p.produto === f; });
    var seg = '<div class="segmentado" role="group" aria-label="Produto">' + [['todos', 'Todos']].concat(D.produtos.map(function (p) { return [p.id, p.nome]; })).map(function (x) {
      return '<button data-act="filtro-protos" data-id="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div>';
    var cards = lista.map(function (x) {
      var at = A.ativa(x);
      return '<a class="cartao-frame" href="#trabalho.' + x.id + '"><span class="cartao-frame-rotulo">' + ic('camadas') + '<b>' + esc(x.nome) + '</b></span>' +
        '<span class="cartao-frame-palco">' + (miniTelas(x) || '<span class="vazio">Criando…</span>') + '</span>' +
        '<span class="cartao-proto-info"><span class="cartao-frame-sub">' + A.produto(x.produto).nome + ' · ' + (x.dores.length ? A.plural(x.dores.length, 'Dor', 'Dores') : 'Produto novo') + ' · ' + (at && at.id !== 'atual' ? esc(at.nome) + ' ativa' : 'sem Proposta') + '</span>' +
        A.percurso(x) + '<span class="cartao-frame-sub">Atualizado ' + esc(x.atualizado) + ' · ' + A.agente(x.agente || 'claude').nome + '</span></span></a>';
    }).join('');
    return '<div class="pagina"><div class="pg-cab"><div><h1>Protótipos</h1><p>Cada Protótipo recria a tela de hoje e guarda as Propostas que o agente fez com você. Abra um para continuar a conversa.</p></div>' +
      '<div class="pg-acoes">' + A.seloExemplo() + seg + '</div></div>' +
      '<div class="grade-protos"><a class="cartao-novo" href="#inicio" data-act="novo-prototipo" data-produto="' + (f === 'todos' ? 'cambio' : f) + '"><span>' + ic('mais') + '</span>Novo Protótipo<small style="font-weight:400;color:var(--tinta-3)">Comece pelo chat</small></a>' + cards + '</div>' +
      (lista.length ? '' : '<div class="vazio"><h3>Nenhum Protótipo de ' + A.produto(f).nome + ' ainda</h3><p>Cite uma Dor no chat e peça para resolver.</p></div>') + '</div>';
  };
  AC['filtro-protos'] = function (el) { S.filtroProtos = el.dataset.id; A.render(); };
  AC['novo-prototipo'] = function (el) {
    S.cmp.inicio = null;
    var c = A.cmp('inicio'); c.proto = 'novo'; c.produtoNovo = el.dataset.produto || 'cambio';
    A.ir('#inicio');
  };

  /* ---------------------------------------------------------------- */
  /* Dores: notas por Fonte                                             */
  /* ---------------------------------------------------------------- */
  function progressoGeracao(passo, rel, fo) {
    return '<div class="progresso" role="status">' + PASSOS_GERACAO.map(function (t, i) {
      var cls = i < passo ? 'feito' : i === passo ? 'on' : '';
      var txt = i === 0 && rel ? 'Lendo ' + fmt(rel.volume) + ' ' + fo.unidade : t;
      return '<div class="prog-passo ' + cls + '"><span class="pp-marca" aria-hidden="true">' + (i < passo ? ic('ok') : '') + '</span><span>' + txt + '</span><span></span></div>';
    }).join('') + '</div>';
  }
  function colunaDores(p, f) {
    var fo = A.fonte(f), rel = A.relatorio(p.id, f), g = S.gerados[p.id] || {}, est = S.filtroDores.estacao;
    var gerandoAqui = S.gerando && S.gerando.produto === p.id && S.gerando.fonte === f;
    var cab = '<div class="coluna-cab"><span class="chip-fonte f-' + f + '">' + ic(f) + '</span><div><b>' + fo.nome + '</b><small>' + (g[f] && rel ? fmt(rel.volume) + ' ' + fo.unidade + ' no período' : esc(fo.descricao)) + '</small></div>' +
      (g[f] && rel ? '<a href="#relatorio.' + rel.id + '">Relatório</a>' : '') + '</div>';
    var corpo;
    if (gerandoAqui) corpo = '<div class="coluna-vazia" style="justify-items:stretch">' + progressoGeracao(S.gerando.passo, rel, fo) + '</div>';
    else if (!g[f]) {
      corpo = '<div class="coluna-vazia"><b style="color:var(--tinta)">Ainda não há Relatório de ' + fo.nome + '.</b><span>O agente lê os dados do período, agrupa por tema e ranqueia as Dores.</span>' +
        '<button class="btn btn-pri btn-p" data-act="gerar-relatorio" data-produto="' + p.id + '" data-fonte="' + f + '">' + ic('relatorio') + 'Gerar Relatório de ' + fo.nome + '</button></div>';
    } else {
      var dores = A.doresDe(p.id, f).filter(function (d) { return !est || d.estacao === est; });
      corpo = dores.length ? '<div class="cluster-notas">' + dores.map(function (d) { return A.notaHtml(d, { acao: 'abrir-dor' }); }).join('') + '</div>'
        : '<div class="coluna-vazia"><span>Nenhuma Dor de ' + fo.nome + ' na tela ' + esc(A.estacao(p.id, est).nome) + '.</span></div>';
    }
    return '<section class="coluna-dores" aria-label="' + fo.nome + '">' + cab + corpo + '</section>';
  }
  A.vistas.dores = function () {
    var p = A.produto(S.filtroDores.produto), g = S.gerados[p.id] || {}, est = S.filtroDores.estacao;
    var seg = '<div class="segmentado" role="group" aria-label="Produto">' + D.produtos.map(function (x) {
      return '<button data-act="dores-produto" data-id="' + x.id + '" aria-pressed="' + (x.id === p.id) + '">' + x.nome + '</button>';
    }).join('') + '</div>';
    var visiveis = D.dores.filter(function (d) { return d.produto === p.id && g[d.fonte]; });
    var contagem = {};
    visiveis.forEach(function (d) { contagem[d.estacao] = (contagem[d.estacao] || 0) + 1; });
    var maior = Math.max.apply(null, [0].concat(Object.keys(contagem).map(function (k) { return contagem[k]; })));
    var onde = visiveis.length ? '<div class="onde-doi" role="group" aria-label="Onde dói: telas da jornada"><span style="font-weight:600;font-size:.875rem;margin-right:4px">Onde dói</span>' + p.estacoes.map(function (e) {
      var n = contagem[e.id] || 0;
      return '<button class="onde-tela' + (n && n === maior ? ' quente' : '') + '" data-act="dores-estacao" data-id="' + e.id + '" aria-pressed="' + (est === e.id) + '"' + (n ? '' : ' disabled') + ' aria-label="' + esc(e.nome) + ': ' + A.plural(n, 'Dor', 'Dores') + '">' + esc(e.nome) + '<b>' + n + '</b></button>';
    }).join('') + (est ? '<button class="btn btn-ter btn-p" data-act="dores-estacao" data-id="' + est + '">' + ic('fechar') + 'Ver todas</button>' : '') + '</div>' : '';
    return '<div class="pagina"><div class="pg-cab"><div><h1>Dores de ' + p.nome + '</h1><p>O que os clientes sentiram, disseram e fizeram, uma coluna por Fonte. Toque numa nota para ver as Evidências; cite no chat para o agente resolver.</p></div>' +
      '<div class="pg-acoes">' + A.seloExemplo() + seg + '</div></div>' + onde +
      '<div class="quadro-dores">' + A.FONTES.map(function (f) { return colunaDores(p, f); }).join('') + '</div></div>';
  };
  AC['dores-produto'] = function (el) { S.filtroDores.produto = el.dataset.id; S.filtroDores.estacao = null; A.render(); };
  AC['dores-estacao'] = function (el) { S.filtroDores.estacao = S.filtroDores.estacao === el.dataset.id ? null : el.dataset.id; A.render(); };

  /* Gerar um Relatório de Fonte (simulado) */
  A.gerarRelatorio = function (produto, fonte) {
    if (S.gerando) { A.toast('Espere o Relatório em andamento terminar', 'info'); return; }
    S.gerando = { produto: produto, fonte: fonte, passo: 0 };
    A.render();
    var t = setInterval(function () {
      if (!S.gerando) { clearInterval(t); return; }
      S.gerando.passo += 1;
      if (S.gerando.passo >= PASSOS_GERACAO.length) {
        clearInterval(t);
        S.gerados[produto] = S.gerados[produto] || {}; S.gerados[produto][fonte] = true;
        S.gerando = null;
        A.toast('Relatório de ' + A.fonte(fonte).nome + ' pronto · ' + A.plural(A.doresDe(produto, fonte).length, 'Dor ranqueada', 'Dores ranqueadas'), 'relatorio');
      }
      A.render();
    }, 750);
  };
  AC['gerar-relatorio'] = function (el) { A.gerarRelatorio(el.dataset.produto, el.dataset.fonte); };

  /* ---------------------------------------------------------------- */
  /* Folha: a Dor e as Evidências                                       */
  /* ---------------------------------------------------------------- */
  function esquemaTela(e) {
    var alvoTopo = /Confirmar|Colar|Carregar|Baixar|Exportar/.test(e.elemento) ? 122 : /Selo|Rótulo|Miniatura/.test(e.elemento) ? 46 : 84;
    return '<i style="top:22px;width:40%"></i><i style="top:34px"></i><i style="top:' + (alvoTopo === 46 ? 70 : 46) + 'px"></i><i style="top:' + (alvoTopo === 84 ? 108 : 84) + 'px"></i>' +
      '<i class="alvo" style="top:' + alvoTopo + 'px"></i><span class="toque" style="left:58%;top:' + (alvoTopo + 9) + 'px"></span>';
  }
  A.evidenciaHtml = function (d, e) {
    if (d.fonte === 'likert') {
      var esc5 = [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= e.nota ? 'on' : '') + '"></i>'; }).join('');
      return '<article class="evid"><div class="evid-topo"><span class="escala" role="img" aria-label="Nota ' + e.nota + ' de 5">' + esc5 + '<em>Nota ' + e.nota + ' de 5</em></span>' +
        '<span><span class="evid-id">' + e.id + '</span> · ' + e.data + ' · ' + e.canal + '</span></div><blockquote>“' + esc(e.texto) + '”</blockquote></article>';
    }
    if (d.fonte === 'voz') {
      return '<article class="evid"><div class="evid-topo"><span><span class="evid-id">Ligação ' + e.id + '</span> · ' + e.data + ' · ' + e.duracao + '</span>' +
        (e.rechamada ? '<span class="pilula pil-neutra">' + ic('refazer') + 'Ligou de novo</span>' : '') + '</div>' +
        '<div class="transcricao">' + e.trechos.map(function (t) {
          return '<div class="fala ' + (t.quem === 'Cliente' ? 'cliente' : 'atendente') + '"><time>' + t.t + '</time><b>' + t.quem + '</b><p>' + esc(t.texto) + '</p></div>';
        }).join('') + '</div><div class="evid-topo"><span>Motivo registrado: ' + esc(e.motivo) + '</span></div></article>';
    }
    return '<article class="evid"><div class="sessao-fs"><div class="esquema" aria-hidden="true">' + esquemaTela(e) + '</div>' +
      '<div class="sessao-fs-info"><span class="evid-topo" style="justify-content:flex-start"><span class="evid-id">Sessão ' + e.id + '</span>· ' + e.data + '</span>' +
      '<b>' + esc(e.sinal) + ' em ' + esc(e.elemento.charAt(0).toLowerCase() + e.elemento.slice(1)) + '</b><p>' + esc(e.detalhe) + '</p>' +
      '<span class="evid-topo" style="justify-content:flex-start">' + e.dispositivo + ' · tela ' + e.tela + ' · aos ' + e.momento + '</span>' +
      '<button class="btn btn-ter btn-p" style="justify-self:start;padding-inline:0" data-act="replay">' + ic('externo') + 'Abrir o replay no FullStory</button></div></div></article>';
  };
  A.folhas.dor = function (f) {
    var d = A.dor(f.id), fo = A.fonte(d.fonte), rel = A.relatorio(d.produto, d.fonte), p = A.produto(d.produto);
    var g = S.gerados[d.produto] || {};
    var mesma = D.dores.filter(function (x) { return x.produto === d.produto && x.estacao === d.estacao && x.id !== d.id && g[x.fonte]; });
    var protos = S.prototipos.filter(function (x) { return x.dores.indexOf(d.id) >= 0; });
    var fatos;
    if (d.fonte === 'likert') fatos = [['menções', fmt(d.volume)], ['em 90 dias', A.tendencia(d)], ['respostas lidas', fmt(rel.volume)]];
    else if (d.fonte === 'voz') fatos = [['ligações', fmt(d.volume)], ['ligam de novo', d.rechamada + '%'], ['em 90 dias', A.tendencia(d)]];
    else fatos = [['clientes afetados', fmt(d.volume)], ['sinal', esc(d.sinal)], ['em 90 dias', A.tendencia(d)]];
    var noTrabalho = S.rota.v === 'trabalho' && A.proto(S.rota.p);
    return '<div class="veu" data-act="fechar-folha"></div>' +
      '<aside class="folha" role="dialog" aria-modal="true" aria-labelledby="folha-titulo">' +
      '<div class="folha-cab"><h2 class="folha-titulo" id="folha-titulo">' + esc(d.titulo) + '</h2>' +
      '<button class="btn-icone" id="fechar-folha" data-act="fechar-folha" aria-label="Fechar">' + ic('fechar') + '</button></div>' +
      '<div class="folha-corpo">' +
        '<div class="linha-meta"><span class="ctx-chip"><span class="chip-fonte f-' + d.fonte + '" style="width:18px;height:18px;border-radius:5px">' + ic(d.fonte) + '</span>' + fo.nome + ' · ' + d.rank + 'ª em ' + p.nome + '</span><span class="ctx-chip">' + ic('celular') + 'Tela ' + esc(A.estacao(d.produto, d.estacao).nome) + '</span>' + A.pilImpacto(d, true) + A.seloExemplo() + '</div>' +
        '<dl class="fatos">' + fatos.map(function (x) { return '<div class="fato"><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('') + '</dl>' +
        '<p style="font-size:1.0625rem;line-height:1.55;color:var(--tinta-2)">' + esc(d.resumo) + '</p>' +
        '<section class="bloco"><h3>Evidências <small>' + d.evidencias.length + ' de ' + fmt(d.volume) + ', escolhidas pelo Relatório</small></h3>' +
          d.evidencias.map(function (e) { return A.evidenciaHtml(d, e); }).join('') + '</section>' +
        '<section class="bloco"><h3>Na mesma tela <small>' + esc(A.estacao(d.produto, d.estacao).nome) + '</small></h3>' +
          (mesma.length ? '<div class="relacionadas">' + mesma.map(function (x) {
            return '<button class="rel-item" data-act="abrir-dor" data-id="' + x.id + '"><span class="chip-fonte f-' + x.fonte + '">' + ic(x.fonte) + '</span><span class="txt">' + esc(x.titulo) + '</span>' + A.pilImpacto(x) + '</button>';
          }).join('') + '</div>' : '<p style="color:var(--tinta-3)">Nenhuma outra Dor nesta tela.</p>') +
          '<div class="aviso-proxima">' + ic('camadas') + '<div><b>Juntar numa Dor consolidada.</b> Dores de Fontes diferentes sobre o mesmo problema viram uma só, com todas as Evidências. ' + A.proximaTag() + '</div></div></section>' +
        '<section class="bloco"><h3>Protótipos com esta Dor</h3>' +
          (protos.length ? '<div class="relacionadas">' + protos.map(function (x) {
            return '<a class="rel-item" href="#trabalho.' + x.id + '">' + ic('camadas') + '<span class="txt">' + esc(x.nome) + '</span>' + A.percurso(x) + '</a>';
          }).join('') + '</div>' : '<p style="color:var(--tinta-3)">Nenhum Protótipo resolve esta Dor ainda.</p>') + '</section>' +
      '</div>' +
      '<div class="folha-pe"><button class="btn btn-pri" data-act="resolver-dor" data-id="' + d.id + '">' + ic('camadas') + 'Resolver esta Dor</button>' +
      '<button class="btn btn-sec" data-act="citar-no-chat" data-id="' + d.id + '">' + ic('arroba') + (noTrabalho ? 'Citar nesta conversa' : 'Citar no chat') + '</button>' +
      '<button class="btn btn-ter" data-act="perguntar-dor" data-id="' + d.id + '">' + ic('conversa') + 'Perguntar ao agente</button></div></aside>';
  };
  AC['abrir-dor'] = function (el) {
    var id = el.dataset.id;
    if (!A.dor(id)) return;
    S.pop = null;
    S.folha = { tipo: 'dor', id: id, retornoEl: el.closest('.folha') ? null : el };
    A.renderCamadas();
    history.replaceState(null, '', '#dor.' + id);
    var b = document.getElementById('fechar-folha'); if (b) b.focus();
  };
  AC.replay = function () { A.toast('No app real, o replay abre no FullStory, com o login da sua empresa', 'externo'); };
  AC['citar-no-chat'] = function (el) {
    var id = el.dataset.id;
    var ch = S.rota.v === 'trabalho' && A.proto(S.rota.p) ? S.rota.p : 'inicio';
    var c = A.cmp(ch);
    if (c.dores.indexOf(id) < 0) c.dores.push(id);
    if (ch === 'inicio' && c.proto === 'novo') c.produtoNovo = A.dor(id).produto;
    S.folha = null;
    if (ch === 'inicio' && S.rota.v !== 'inicio') { A.ir('#inicio'); return; }
    history.replaceState(null, '', '#' + S.rota.v + (S.rota.p ? '.' + S.rota.p : ''));
    A.renderCamadas(); A.renderComposer(ch, true);
    if (A.aoMudarComposer) A.aoMudarComposer(ch);
  };
  AC['perguntar-dor'] = function (el) {
    var d = A.dor(el.dataset.id);
    var texto = 'Me explique a Dor “' + d.titulo + '” e o que você mudaria primeiro.';
    S.folha = null;
    A.iniciarConversa(d.produto, { tipo: 'usuario', texto: texto, quando: A.agora(), cita: [d.id] }, { texto: texto, agente: S.agentePadrao, modelo: S.modeloPadrao[S.agentePadrao] });
  };

  /* ---------------------------------------------------------------- */
  /* Relatórios de Fonte                                                */
  /* ---------------------------------------------------------------- */
  function relLinha(r) {
    var fo = A.fonte(r.fonte), p = A.produto(r.produto), g = S.gerados[r.produto] || {};
    var gerandoAqui = S.gerando && S.gerando.produto === r.produto && S.gerando.fonte === r.fonte;
    if (!g[r.fonte]) {
      return '<div class="rel-linha"><span class="chip-fonte m f-' + r.fonte + '">' + ic(r.fonte) + '</span>' +
        '<span><b>' + fo.nome + '</b><small>' + p.nome + ' · ainda não gerado</small></span><span style="color:var(--tinta-3);font-size:.875rem">' + esc(fo.descricao) + '</span>' +
        (gerandoAqui ? '<span class="pilula pil-neutra" role="status">Gerando… ' + (S.gerando.passo + 1) + ' de 4</span>' : '<button class="btn btn-pri btn-p" data-act="gerar-relatorio" data-produto="' + r.produto + '" data-fonte="' + r.fonte + '">' + ic('relatorio') + 'Gerar</button>') + '</div>';
    }
    return '<a class="rel-linha" href="#relatorio.' + r.id + '"><span class="chip-fonte m f-' + r.fonte + '">' + ic(r.fonte) + '</span>' +
      '<span><b>' + fo.nome + '</b><small>' + p.nome + ' · ' + r.periodo + '</small></span>' +
      '<span>' + esc(r.destaque.charAt(0).toUpperCase() + r.destaque.slice(1)) + '<small>' + fmt(r.volume) + ' ' + fo.unidade + ' · gerado em ' + r.geradoEm + '</small></span>' +
      '<span class="btn btn-ter btn-p">Abrir ' + ic('seta') + '</span></a>';
  }
  A.vistas.relatorios = function () {
    return '<div class="pagina"><div class="pg-cab"><div><h1>Relatórios de Fonte</h1><p>O que cada Fonte diz sobre cada Produto nos últimos 90 dias. É deste material que o agente parte para propor melhorias.</p></div><div class="pg-acoes">' + A.seloExemplo() + '</div></div>' +
      D.produtos.map(function (p) {
        var rels = A.FONTES.map(function (f) { return A.relatorio(p.id, f); }).filter(Boolean);
        return '<section style="display:grid;gap:10px" aria-labelledby="rel-' + p.id + '"><h2 id="rel-' + p.id + '" style="font-size:1.0625rem;font-weight:600">' + p.nome + ' <small style="font-weight:400;color:var(--tinta-3);font-size:.875rem">· ' + esc(p.descricao) + '</small></h2>' +
          '<div class="painel lista-rel">' + rels.map(relLinha).join('') + '</div></section>';
      }).join('') + '</div>';
  };
  A.vistas.relatorio = function () {
    var r = A.relatorioPorId(S.rota.p);
    if (!r) return '<div class="pagina"><div class="vazio"><h3>Relatório não encontrado</h3><a class="btn btn-sec" href="#relatorios">Ver Relatórios</a></div></div>';
    var fo = A.fonte(r.fonte), p = A.produto(r.produto), g = S.gerados[r.produto] || {};
    if (!g[r.fonte]) {
      return '<div class="pagina"><div class="vazio"><h3>O Relatório de ' + fo.nome + ' de ' + p.nome + ' ainda não foi gerado</h3>' +
        '<button class="btn btn-pri" data-act="gerar-relatorio" data-produto="' + r.produto + '" data-fonte="' + r.fonte + '">' + ic('relatorio') + 'Gerar agora</button></div></div>';
    }
    var dores = A.doresDe(r.produto, r.fonte);
    return '<div class="pagina"><a class="btn btn-ter btn-p" href="#relatorios" style="justify-self:start;padding-inline:0">' + ic('setaE') + 'Relatórios</a>' +
      '<div class="pg-cab"><div style="display:flex;gap:14px;align-items:center"><span class="chip-fonte g f-' + r.fonte + '">' + ic(r.fonte) + '</span>' +
      '<div><h1>Relatório de ' + fo.nome + '</h1><p style="margin-top:2px">' + p.nome + ' · ' + r.periodo + ' · gerado em ' + r.geradoEm + ' por ' + r.geradoPor + ' · dados de exemplo</p></div></div>' +
      '<div class="pg-acoes"><div class="segmentado" role="group" aria-label="Visão do Relatório"><button data-act="rel-vista" data-v="leitura" aria-pressed="' + (S.relVista !== 'graficos') + '">' + ic('relatorio') + 'Leitura</button><button data-act="rel-vista" data-v="graficos" aria-pressed="' + (S.relVista === 'graficos') + '">' + ic('grafico') + 'Gráficos</button></div>' +
      '<button class="btn btn-sec" data-act="regerar">' + ic('refazer') + 'Gerar de novo</button>' +
      '<button class="btn btn-pri" data-act="criar-de-conversa" data-dores="' + dores.slice(0, 2).map(function (d) { return d.id; }).join(',') + '">' + ic('camadas') + 'Resolver as 2 primeiras</button></div></div>' +
      (S.relVista === 'graficos' ? A.htmlGraficos(r) : '<div class="relatorio"><article class="painel" style="padding:26px;display:grid;gap:20px"><p class="destaque">' + esc(r.destaque.charAt(0).toUpperCase() + r.destaque.slice(1)) + '.</p>' +
        '<div class="narrativa">' + r.narrativa.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div><p class="metodo"><b>Como foi feito.</b> ' + esc(r.metodo) + '</p></article>' +
      '<section class="painel" aria-labelledby="t-ranking"><h2 id="t-ranking" style="font-size:1rem;font-weight:600;padding:16px 16px 6px">Dores ranqueadas <small style="font-weight:400;color:var(--tinta-3)">· ' + dores.length + '</small></h2><div class="ranking">' + dores.map(function (d) {
        return '<button class="rank-linha" data-act="abrir-dor" data-id="' + d.id + '"><span class="rank-num">' + d.rank + '</span><span class="rank-txt"><b>' + esc(d.titulo) + '</b><span class="rank-meta"><span>' + A.volumeTxt(d) + '</span>' + A.tendencia(d) + '<span>Tela ' + esc(A.estacao(d.produto, d.estacao).nome) + '</span></span></span>' + A.pilImpacto(d) + '</button>';
      }).join('') + '</div></section></div>') + '</div>';
  };
  A.titulos.relatorio = function () { var r = A.relatorioPorId(S.rota.p); return r ? 'Relatório de ' + A.fonte(r.fonte).nome : 'Relatório'; };
  AC.regerar = function () { A.toast('Gerando de novo com os dados até hoje. O Relatório atual continua guardado.', 'refazer'); };

  /* ---------------------------------------------------------------- */
  /* Configurações                                                      */
  /* ---------------------------------------------------------------- */
  A.vistas.config = function () {
    var sk = D.skillUX;
    var agentes = D.agentes.map(function (a) {
      var padrao = S.agentePadrao === a.id;
      return '<div class="linha-config">' + A.logoAgente(a.id, 'ag-grande') +
        '<div><b>' + a.nome + (padrao ? ' <span class="pilula pil-neutra" style="margin-left:6px">Padrão</span>' : '') + '</b><small>' + esc(a.detalhe) + ' · ' + a.modelos.length + ' modelos</small></div>' +
        '<div class="acoes"><label class="sr" for="cfg-modelo-' + a.id + '">Modelo padrão do ' + a.nome + '</label><select class="pill" id="cfg-modelo-' + a.id + '" data-cfg="modelo" data-agente="' + a.id + '" style="padding-right:8px">' +
          a.modelos.map(function (m) { return '<option value="' + m.id + '"' + (S.modeloPadrao[a.id] === m.id ? ' selected' : '') + '>' + esc(m.nome) + '</option>'; }).join('') + '</select>' +
          (padrao ? '' : '<button class="btn btn-sec btn-p" data-act="cfg-agente" data-id="' + a.id + '">Usar como padrão</button>') +
          '<span class="pilula pil-ok">' + ic('ok') + 'Conectado</span></div></div>';
    }).join('');
    var versoes = S.verVersoes ? '<div class="linha-config" style="grid-template-columns:1fr"><div style="display:grid;gap:6px">' + sk.historico.map(function (h) {
      return '<span style="display:flex;gap:10px;font-size:.875rem"><b style="min-width:52px">' + h.versao + '</b><span style="color:var(--tinta-3)">' + h.data + '</span><span style="margin-left:auto;color:var(--tinta-2)">' + h.estado + '</span></span>';
    }).join('') + '</div></div>' : '';
    return '<div class="pagina"><div class="pg-cab"><div><h1>Configurações</h1><p>Agentes, a Skill de UX que guia o agente, de onde vêm os dados e como o app aparece para você.</p></div><div class="pg-acoes">' + A.seloExemplo() + '</div></div><div class="config">' +
      '<section class="config-sec" aria-labelledby="c-agentes"><h2 id="c-agentes">Agentes</h2><p>O agente que conversa com você e cria os Protótipos. Dá para trocar a qualquer momento no campo do chat.</p><div class="painel">' + agentes + '</div></section>' +
      '<section class="config-sec" aria-labelledby="c-skill"><h2 id="c-skill">Skill de UX</h2><p>O conhecimento de design que o agente segue para revisar, simplificar e gerar Variantes. Atualiza sem reinstalar o app.</p><div class="painel">' +
        '<div class="linha-config"><span class="pop-novo-ic" style="width:38px;height:38px;border-radius:12px">' + ic('raio') + '</span><div><b>' + sk.nome + ' ' + (S.skillVersao || sk.versao) + '</b><small>Atualizada ' + sk.atualizada + ' · ' + esc(sk.teste) + '</small></div>' +
          '<div class="acoes"><button class="btn btn-sec btn-p" data-act="cfg-versoes" aria-expanded="' + !!S.verVersoes + '">' + ic('historico') + 'Versões</button><button class="btn btn-pri btn-p" data-act="cfg-atualizar"' + (S.procurando ? ' disabled' : '') + '>' + ic('refazer') + (S.procurando ? 'Procurando…' : 'Procurar atualização') + '</button></div></div>' + versoes +
        '<div class="linha-config"><span class="pop-novo-ic" style="width:38px;height:38px;border-radius:12px">' + ic('camadas') + '</span><div><b>Modelo de Protótipo</b><small>' + esc(sk.template) + ' · a base que o agente usa para montar as telas</small></div><div class="acoes"></div></div></div></section>' +
      '<section class="config-sec" aria-labelledby="c-fontes"><h2 id="c-fontes">Fontes de dados</h2><p>Neste protótipo, todas as Fontes usam dados de exemplo. Nenhum dado de cliente real é lido.</p><div class="painel">' +
        A.FONTES.map(function (f) {
          var fo = A.fonte(f);
          return '<div class="linha-config"><span class="chip-fonte m f-' + f + '">' + ic(f) + '</span><div><b>' + fo.nome + '</b><small>' + esc(fo.descricao) + '</small></div><div class="acoes"><span class="pilula pil-neutra">Dados de exemplo</span><button class="btn btn-sec btn-p" disabled>Conectar ao banco de dados</button>' + A.proximaTag() + '</div></div>';
        }).join('') + '</div></section>' +
      '<section class="config-sec" aria-labelledby="c-aparencia"><h2 id="c-aparencia">Aparência</h2><div class="painel"><div class="linha-config"><span class="pop-novo-ic" style="width:38px;height:38px;border-radius:12px">' + ic(S.tema === 'escuro' ? 'lua' : 'sol') + '</span><div><b>Tema</b><small>O claro funciona melhor no projetor e no compartilhamento de tela.</small></div>' +
        '<div class="acoes"><div class="segmentado" role="group" aria-label="Tema"><button data-act="tema" data-t="claro" aria-pressed="' + (S.tema === 'claro') + '">' + ic('sol') + 'Claro</button><button data-act="tema" data-t="escuro" aria-pressed="' + (S.tema === 'escuro') + '">' + ic('lua') + 'Escuro</button></div></div></div></div></section>' +
      '<section class="config-sec" aria-labelledby="c-pasta"><h2 id="c-pasta">Onde os Protótipos ficam</h2><div class="painel"><div class="linha-config"><span class="pop-novo-ic" style="width:38px;height:38px;border-radius:12px">' + ic('pasta') + '</span><div><b>Pasta no seu computador</b><small>C:\\Users\\marina.alves\\Design Studio\\Protótipos</small></div><div class="acoes"><button class="btn btn-sec btn-p" data-act="cfg-pasta">' + ic('externo') + 'Abrir a pasta</button></div></div></div></section>' +
      '<section class="config-sec" aria-labelledby="c-pub"><h2 id="c-pub">Publicação</h2><p>Cada Protótipo publica na conta AWS do projeto e gera um endereço para o teste com clientes.</p><div class="painel"><div class="linha-config"><span class="pop-novo-ic" style="width:38px;height:38px;border-radius:12px">' + ic('nuvem') + '</span><div><b>Conta AWS por projeto</b><small>Bucket e distribuição criados na primeira publicação.</small></div><div class="acoes">' + A.proximaTag() + '</div></div></div></section>' +
      '</div></div>';
  };
  AC['cfg-agente'] = function (el) { S.agentePadrao = el.dataset.id; if (S.cmp.inicio) { S.cmp.inicio.agente = el.dataset.id; S.cmp.inicio.modelo = S.modeloPadrao[el.dataset.id]; } A.render(); A.toast(A.agente(el.dataset.id).nome + ' é o agente padrão'); };
  AC['cfg-versoes'] = function () { S.verVersoes = !S.verVersoes; A.render(); };
  AC['cfg-atualizar'] = function () {
    S.procurando = true; A.render();
    setTimeout(function () { S.procurando = false; A.render(); A.toast('Você já tem a versão mais recente da Skill de UX'); }, 1400);
  };
  AC['cfg-pasta'] = function () { A.toast('No app instalado, isto abre a pasta no Explorador de Arquivos', 'pasta'); };
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!t.dataset || t.dataset.cfg !== 'modelo') return;
    S.modeloPadrao[t.dataset.agente] = t.value;
    if (S.cmp.inicio && S.cmp.inicio.agente === t.dataset.agente) S.cmp.inicio.modelo = t.value;
    A.toast('Modelo padrão do ' + A.agente(t.dataset.agente).nome + ': ' + A.modelo(t.dataset.agente, t.value).nome);
  });
})();
