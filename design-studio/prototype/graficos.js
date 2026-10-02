/* Design Studio — visão de Gráficos do Relatório de Fonte: filtro por
   período e por Dor, Dores por categoria (barras em ênfase), recorrência
   semana a semana (linha com cruz de leitura) e insights por categoria.
   Séries semanais são derivadas, de forma determinística, do volume e da
   tendência de cada Dor (dados de exemplo). */
(function () {
  'use strict';
  var A = DS.app, D = A.D, S = A.S, ic = A.ic, esc = A.esc, fmt = A.fmt;
  var AC = A.acoes;
  var SEMANAS = 13, INICIO = new Date(2026, 6, 1); /* 1 jul 2026: começo do período */
  var PERIODOS = [[13, '90 dias'], [9, '60 dias'], [4, '30 dias']];
  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var RECORRENCIA = { likert: 'voltam a citar', voz: 'ligam de novo', fullstory: 'repetem em outra sessão' };

  /* ---------------------------------------------------------------- */
  /* Dados                                                              */
  /* ---------------------------------------------------------------- */
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var cache = {};
  function serie(d) {
    if (cache[d.id]) return cache[d.id];
    var t = d.tendencia / 100, h = hash(d.id), pesos = [];
    for (var i = 0; i < SEMANAS; i++) {
      var base = 1 - t / 2 + t * (i / (SEMANAS - 1));
      pesos.push(Math.max(0.25, base + 0.07 * Math.sin(i * 1.3 + (h % 11)) + 0.04 * Math.sin(i * 2.9 + (h % 5))));
    }
    var soma = pesos.reduce(function (a, b) { return a + b; }, 0);
    var v = pesos.map(function (p) { return Math.round(d.volume * p / soma); });
    v[SEMANAS - 1] += d.volume - v.reduce(function (a, b) { return a + b; }, 0);
    return (cache[d.id] = v);
  }
  function recorrencia(d) {
    if (d.rechamada != null) return d.rechamada;
    var h = hash(d.id + ':r');
    return d.fonte === 'likert' ? 8 + (h % 13) : 18 + (h % 21);
  }
  function rotuloSemana(i) { var dt = new Date(INICIO.getTime() + i * 7 * 864e5); return dt.getDate() + ' ' + MESES[dt.getMonth()]; }
  function soma(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }
  function janela(arr, n) { return arr.slice(SEMANAS - n); }
  function tendencia(arr) {
    var m = Math.floor(arr.length / 2), a = soma(arr.slice(0, m)), b = soma(arr.slice(arr.length - m));
    return a ? Math.round((b / a - 1) * 100) : 0;
  }
  function estado(r) {
    S.graf = S.graf || {};
    if (!S.graf[r.id]) S.graf[r.id] = { dor: 'todas', semanas: 13, cat: null, tabela: {}, sel: null };
    return S.graf[r.id];
  }
  function dados(r) {
    var g = estado(r), n = g.semanas;
    var dores = A.doresDe(r.produto, r.fonte);
    var cats = (D.categorias[r.produto] || []).map(function (c) {
      var ds = dores.filter(function (d) { return d.categoria === c.id; });
      if (!ds.length) return null;
      var semanal = [];
      for (var i = 0; i < n; i++) semanal.push(soma(ds.map(function (d) { return janela(serie(d), n)[i]; })));
      var vol = soma(semanal);
      var rec = Math.round(soma(ds.map(function (d) { return recorrencia(d) * soma(janela(serie(d), n)); })) / Math.max(1, vol));
      var topo = ds.slice().sort(function (a, b) { return soma(janela(serie(b), n)) - soma(janela(serie(a), n)); })[0];
      return { c: c, dores: ds, semanal: semanal, vol: vol, rec: rec, tend: tendencia(semanal), topo: topo };
    }).filter(Boolean).sort(function (a, b) { return b.vol - a.vol; });
    var total = [];
    for (var i = 0; i < n; i++) total.push(soma(cats.map(function (x) { return x.semanal[i]; })));
    var dor = g.dor !== 'todas' ? A.dor(g.dor) : null;
    var enfase = dor ? cats.filter(function (x) { return x.c.id === dor.categoria; })[0] : (g.cat && cats.filter(function (x) { return x.c.id === g.cat; })[0]) || cats[0];
    return { g: g, n: n, cats: cats, total: total, soma: soma(total), dor: dor, enfase: enfase, unidade: A.fonte(r.fonte).unidade };
  }
  function pct(v, t) { return t ? Math.round((v / t) * 100) : 0; }
  function tendTxt(t) { return t === 0 ? 'estável' : (t > 0 ? '+' : '−') + Math.abs(t) + '%'; }

  /* ---------------------------------------------------------------- */
  /* Vista                                                              */
  /* ---------------------------------------------------------------- */
  A.htmlGraficos = function (r) {
    var x = dados(r), g = x.g, fo = A.fonte(r.fonte);
    A.depois.push(function () { A.desenharLinha(r); });
    var filtros = '<div class="graf-filtros" role="group" aria-label="Filtros dos gráficos">' +
      '<div class="segmentado" role="group" aria-label="Período">' + PERIODOS.map(function (p) {
        return '<button data-act="graf-periodo" data-n="' + p[0] + '" aria-pressed="' + (g.semanas === p[0]) + '">' + p[1] + '</button>';
      }).join('') + '</div>' +
      '<label class="graf-dor"><span>Dor</span><select id="graf-dor" data-rel="' + r.id + '"><option value="todas">Todas as Dores</option>' +
        x.cats.map(function (c) { return '<optgroup label="' + esc(c.c.nome) + '">' + c.dores.map(function (d) { return '<option value="' + d.id + '"' + (g.dor === d.id ? ' selected' : '') + '>' + esc(d.titulo) + '</option>'; }).join('') + '</optgroup>'; }).join('') +
      '</select>' + ic('baixo') + '</label>' +
      (g.dor !== 'todas' || g.cat ? '<button class="btn btn-ter btn-p" data-act="graf-limpar">' + ic('fechar') + 'Limpar filtro</button>' : '') + '</div>';
    var e = x.enfase;
    var resumo = '<p class="graf-resumo">' + (x.dor
      ? '“' + esc(x.dor.titulo) + '” soma ' + fmt(soma(janela(serie(x.dor), x.n))) + ' ' + fo.unidadeDor + ' nos últimos ' + PERIODOS.filter(function (p) { return p[0] === x.n; })[0][1] + ', ' + pct(soma(janela(serie(x.dor), x.n)), e.vol) + '% de ' + esc(e.c.nome) + '.'
      : 'Nos últimos ' + PERIODOS.filter(function (p) { return p[0] === x.n; })[0][1] + ', as Dores deste Relatório somam ' + fmt(x.soma) + ' ' + fo.unidadeDor + ' em ' + A.plural(x.cats.length, 'categoria', 'categorias') + '. ' + esc(e.c.nome) + ' concentra ' + pct(e.vol, x.soma) + '%.') + '</p>';
    return '<div class="graficos">' + filtros + resumo +
      '<div class="graf-grade">' + figuraCategorias(x, fo) + figuraLinha(x, r) + '</div>' +
      insights(x, r, fo) + '<div class="graf-dica" id="graf-dica" role="status" hidden></div></div>';
  };

  function figuraCategorias(x, fo) {
    var max = Math.max.apply(null, x.cats.map(function (c) { return c.vol; }).concat([1]));
    var tabela = x.g.tabela.cat;
    var corpo = tabela
      ? '<table class="graf-tabela"><thead><tr><th scope="col">Categoria</th><th scope="col" class="num">' + esc(maiuscula(fo.unidadeDor)) + '</th><th scope="col" class="num">Participação</th><th scope="col" class="num">Dores</th></tr></thead><tbody>' + x.cats.map(function (c) {
          return '<tr><th scope="row">' + esc(c.c.nome) + '</th><td class="num">' + fmt(c.vol) + '</td><td class="num">' + pct(c.vol, x.soma) + '%</td><td class="num">' + c.dores.length + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="gb">' + x.cats.map(function (c) {
          var on = c === x.enfase, w = (c.vol / max) * 74;
          var parte = on && x.dor ? (soma(janela(serie(x.dor), x.n)) / c.vol) * w : 0;
          var nome = c.c.nome + ': ' + fmt(c.vol) + ' ' + fo.unidadeDor + ', ' + pct(c.vol, x.soma) + '%';
          return '<button class="gb-linha' + (on ? ' enfase' : '') + '" data-act="graf-cat" data-id="' + c.c.id + '" aria-pressed="' + on + '" aria-label="' + esc(nome) + '" data-dica="' + esc(c.c.nome) + '|' + fmt(c.vol) + ' ' + esc(fo.unidadeDor) + ' · ' + pct(c.vol, x.soma) + '%|' + A.plural(c.dores.length, 'Dor', 'Dores') + ' · ' + c.rec + '% ' + RECORRENCIA[x.cats[0].dores[0].fonte] + '">' +
            '<span class="gb-rotulo">' + esc(c.c.nome) + '</span><span class="gb-trilho">' +
              (parte ? '<span class="gb-barra parte" style="width:' + parte.toFixed(2) + '%"></span><span class="gb-barra resto" style="width:calc(' + (w - parte).toFixed(2) + '% - 2px)"></span>' : '<span class="gb-barra" style="width:' + w.toFixed(2) + '%"></span>') +
              '<span class="gb-valor">' + fmt(c.vol) + ' · ' + pct(c.vol, x.soma) + '%</span></span></button>';
        }).join('') + '</div>';
    return '<figure class="graf painel" aria-labelledby="g-cat-t"><div class="graf-cab"><div><h2 id="g-cat-t">Dores por categoria</h2><p>' + esc(fo.unidadeDor.charAt(0).toUpperCase() + fo.unidadeDor.slice(1)) + ' no período. Toque numa categoria para destacá-la.</p></div>' +
      '<button class="btn btn-ter btn-p" data-act="graf-tabela" data-g="cat" aria-pressed="' + !!tabela + '">' + ic(tabela ? 'grafico' : 'tabela') + (tabela ? 'Ver gráfico' : 'Ver tabela') + '</button></div>' + corpo + '</figure>';
  }
  function maiuscula(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  function serieEnfase(x) { return x.dor ? janela(serie(x.dor), x.n) : x.enfase.semanal; }
  function nomeEnfase(x) { return x.dor ? x.dor.titulo : x.enfase.c.nome; }
  function figuraLinha(x, r) {
    var tabela = x.g.tabela.linha, se = serieEnfase(x), fo = A.fonte(r.fonte);
    var sub = x.dor ? 'Quantas vezes “' + esc(x.dor.titulo) + '” aparece por semana.' : 'Quantas vezes as Dores de ' + esc(x.enfase.c.nome) + ' aparecem por semana. Toque noutra categoria para trocar.';
    var corpo = tabela
      ? '<table class="graf-tabela"><thead><tr><th scope="col">Semana de</th><th scope="col" class="num">' + esc(maiuscula(fo.unidadeDor)) + '</th><th scope="col" class="num">Todas as Dores</th><th scope="col" class="num">Participação</th></tr></thead><tbody>' + x.total.map(function (v, i) {
          return '<tr><th scope="row">' + rotuloSemana(SEMANAS - x.n + i) + '</th><td class="num">' + fmt(se[i]) + '</td><td class="num">' + fmt(v) + '</td><td class="num">' + pct(se[i], v) + '%</td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="graf-linha" id="graf-linha" tabindex="0" role="img" aria-label="' + esc('Recorrência semanal de ' + nomeEnfase(x) + ': de ' + fmt(se[0]) + ' para ' + fmt(se[se.length - 1]) + ' ' + fo.unidadeDor + ' por semana. Use as setas para ler cada semana.') + '"></div>';
    return '<figure class="graf painel" aria-labelledby="g-lin-t"><div class="graf-cab"><div><h2 id="g-lin-t">Recorrência semana a semana</h2><p>' + sub + '</p></div>' +
      '<button class="btn btn-ter btn-p" data-act="graf-tabela" data-g="linha" aria-pressed="' + !!tabela + '">' + ic(tabela ? 'grafico' : 'tabela') + (tabela ? 'Ver gráfico' : 'Ver tabela') + '</button></div>' + corpo + '</figure>';
  }

  function insights(x, r, fo) {
    var ordem = x.cats.slice();
    if (x.dor) ordem.sort(function (a, b) { return (b === x.enfase) - (a === x.enfase); });
    var ag = S.agentePadrao, nomeAg = A.agente(ag).nome;
    return '<section class="insights painel" aria-labelledby="t-insights"><div class="graf-cab"><div><h2 id="t-insights">Insights por categoria</h2><p>O que o ' + nomeAg + ' lê em cada categoria, com o próximo passo sugerido.</p></div></div>' +
      ordem.map(function (c) {
        var foco = c === x.enfase && (x.dor || x.g.cat);
        var top = c.topo, volTop = soma(janela(serie(top), x.n));
        return '<article class="insight' + (foco ? ' foco' : '') + '" aria-labelledby="ins-' + c.c.id + '">' +
          '<div class="insight-lado"><h3 id="ins-' + c.c.id + '">' + esc(c.c.nome) + '</h3>' +
            '<dl class="insight-fig"><div><dt>do volume</dt><dd>' + pct(c.vol, x.soma) + '%</dd></div><div><dt>no período</dt><dd>' + tendTxt(c.tend) + '</dd></div><div><dt>' + RECORRENCIA[r.fonte] + '</dt><dd>' + c.rec + '%</dd></div></dl></div>' +
          '<div class="insight-corpo"><p class="insight-autor">' + A.logoAgente(ag) + '<span>' + nomeAg + '</span></p>' +
            '<p>' + esc(c.c.padrao) + ' A Dor que mais pesa é “' + esc(top.titulo) + '”, com ' + fmt(volTop) + ' ' + esc(fo.unidadeDor) + (r.fonte === 'voz' && top.rechamada ? ' e ' + top.rechamada + '% de rechamada' : '') + '.</p>' +
            '<p><b>Próximo passo:</b> ' + esc(c.c.sugestao) + '</p>' +
            '<div class="insight-dores">' + c.dores.map(function (d) { return A.chipDor(d); }).join('') + '</div>' +
            '<div class="insight-acoes"><button class="btn btn-sec btn-p" data-act="criar-de-conversa" data-dores="' + c.dores.slice(0, 3).map(function (d) { return d.id; }).join(',') + '">' + ic('camadas') + 'Resolver ' + (c.dores.length > 1 ? 'estas Dores' : 'esta Dor') + '</button>' +
            '<button class="btn btn-ter btn-p" data-act="perguntar-categoria" data-rel="' + r.id + '" data-cat="' + c.c.id + '">' + ic('conversa') + 'Perguntar ao agente</button></div></div></article>';
      }).join('') + '</section>';
  }

  /* ---------------------------------------------------------------- */
  /* Linha (SVG medido no tamanho real: texto e traço nítidos)          */
  /* ---------------------------------------------------------------- */
  function escalaBonita(max) {
    var bruto = max / 4, mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, bruto)))), passo = mag;
    [1, 2, 2.5, 5, 10].some(function (m) { if (m * mag >= bruto) { passo = m * mag; return true; } return false; });
    return { passo: passo, topo: Math.ceil(max / passo) * passo };
  }
  A.desenharLinha = function (r) {
    r = r || A.relatorioPorId(S.rota.p);
    var box = document.getElementById('graf-linha');
    if (!r || !box) return;
    var x = dados(r), se = serieEnfase(x), tot = x.total, n = x.n;
    var W = Math.max(280, box.clientWidth), H = 236, m = { e: 52, d: 64, t: 12, b: 30 };
    var pw = W - m.e - m.d, ph = H - m.t - m.b;
    var esc2 = escalaBonita(Math.max.apply(null, se)), topo = esc2.topo;
    var X = function (i) { return m.e + (n === 1 ? pw / 2 : (i / (n - 1)) * pw); };
    var Y = function (v) { return m.t + ph - (v / topo) * ph; };
    var linha = function (arr) { return arr.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' '); };
    var grade = '', ticks = '';
    for (var v = 0; v <= topo + 0.001; v += esc2.passo) {
      grade += '<line class="gl-grade" x1="' + m.e + '" x2="' + (W - m.d) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/>';
      ticks += '<text class="gl-tick" x="' + (m.e - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + fmt(v) + '</text>';
    }
    /* quantos rótulos de semana cabem na largura medida (≈52px cada) */
    var passoX = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 52)))), rotX = '';
    for (var i = 0; i < n; i += passoX) rotX += '<text class="gl-tick" x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + rotuloSemana(SEMANAS - n + i) + '</text>';
    var area = linha(se) + ' L' + X(n - 1).toFixed(1) + ' ' + Y(0).toFixed(1) + ' L' + X(0).toFixed(1) + ' ' + Y(0).toFixed(1) + ' Z';
    var fim = function (arr, cls) { var yv = Y(arr[n - 1]); return '<circle class="gl-ponto ' + cls + '" cx="' + X(n - 1).toFixed(1) + '" cy="' + yv.toFixed(1) + '" r="4"/><text class="gl-fim" x="' + (X(n - 1) + 10).toFixed(1) + '" y="' + (yv + 4).toFixed(1) + '">' + fmt(arr[n - 1]) + '</text>'; };
    box.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + grade +
      '<line class="gl-eixo" x1="' + m.e + '" x2="' + (W - m.d) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '"/>' + ticks + rotX +
      '<path class="gl-area" d="' + area + '"/><path class="gl-linha enfase" d="' + linha(se) + '"/>' + fim(se, 'enfase') +
      '<line class="gl-cruz" id="gl-cruz" x1="0" x2="0" y1="' + m.t + '" y2="' + Y(0).toFixed(1) + '" style="display:none"/></svg>';
    var g = x.g;
    var mostrar = function (idx) {
      idx = Math.max(0, Math.min(n - 1, idx)); g.sel = idx;
      var cruz = document.getElementById('gl-cruz'); if (!cruz) return;
      cruz.setAttribute('x1', X(idx)); cruz.setAttribute('x2', X(idx)); cruz.style.display = '';
      var dica = document.getElementById('graf-dica'), raiz = box.getBoundingClientRect();
      dica.innerHTML = '';
      var t = document.createElement('p'); t.className = 'gd-titulo'; t.textContent = 'Semana de ' + rotuloSemana(SEMANAS - n + idx); dica.appendChild(t);
      var row = document.createElement('p'); row.className = 'gd-linha';
      var k = document.createElement('i'); k.className = 'chave enfase'; row.appendChild(k);
      var b = document.createElement('b'); b.textContent = fmt(se[idx]); row.appendChild(b);
      var sn = document.createElement('span'); sn.textContent = nomeEnfase(x); row.appendChild(sn);
      dica.appendChild(row);
      var ctx = document.createElement('p'); ctx.className = 'gd-ctx';
      ctx.textContent = pct(se[idx], tot[idx]) + '% das ' + fmt(tot[idx]) + ' ' + A.fonte(r.fonte).unidadeDor + ' do Relatório nesta semana';
      dica.appendChild(ctx);
      dica.hidden = false;
      var left = raiz.left + X(idx) + 14, dw = dica.offsetWidth;
      if (left + dw > window.innerWidth - 12) left = raiz.left + X(idx) - dw - 14;
      dica.style.left = Math.max(12, left) + 'px'; dica.style.top = (raiz.top + m.t + 6) + 'px';
    };
    var esconder = function () { var c = document.getElementById('gl-cruz'); if (c) c.style.display = 'none'; var d = document.getElementById('graf-dica'); if (d) d.hidden = true; };
    box.onpointermove = function (ev) { var rx = ev.clientX - box.getBoundingClientRect().left; mostrar(Math.round(((rx - m.e) / pw) * (n - 1))); };
    box.onpointerleave = esconder;
    box.onblur = esconder;
    box.onfocus = function () { mostrar(g.sel == null ? n - 1 : g.sel); };
    box.onkeydown = function (ev) {
      var k = ev.key, idx = g.sel == null ? n - 1 : g.sel;
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'Home' || k === 'End') { ev.preventDefault(); mostrar(k === 'Home' ? 0 : k === 'End' ? n - 1 : idx + (k === 'ArrowRight' ? 1 : -1)); }
      else if (k === 'Escape') { esconder(); }
    };
  };
  /* dica das barras: no hover e no foco, sem esconder valor (o rótulo já
     mostra volume e %; a dica soma Dores e recorrência) */
  function dicaBarra(el) {
    var dica = document.getElementById('graf-dica');
    if (!dica || !el) return;
    var partes = (el.getAttribute('data-dica') || '').split('|');
    dica.innerHTML = '';
    partes.forEach(function (p, i) { var e = document.createElement(i === 1 ? 'b' : 'p'); if (i === 0) e.className = 'gd-titulo'; e.textContent = p; if (i === 1) { var w = document.createElement('p'); w.className = 'gd-linha'; w.appendChild(e); dica.appendChild(w); } else dica.appendChild(e); });
    dica.hidden = false;
    var b = el.querySelector('.gb-valor').getBoundingClientRect();
    var left = b.right + 12;
    if (left + dica.offsetWidth > window.innerWidth - 12) left = b.left - dica.offsetWidth - 12;
    dica.style.left = Math.max(12, left) + 'px'; dica.style.top = (b.top - 6) + 'px';
  }
  document.addEventListener('pointerover', function (ev) { var el = ev.target.closest && ev.target.closest('.gb-linha'); if (el) dicaBarra(el); });
  document.addEventListener('pointerout', function (ev) { var el = ev.target.closest && ev.target.closest('.gb-linha'); if (el && !el.contains(ev.relatedTarget)) { var d = document.getElementById('graf-dica'); if (d) d.hidden = true; } });
  document.addEventListener('focusin', function (ev) { var el = ev.target.closest && ev.target.closest('.gb-linha'); if (el) dicaBarra(el); });
  document.addEventListener('focusout', function (ev) { var el = ev.target.closest && ev.target.closest('.gb-linha'); if (el) { var d = document.getElementById('graf-dica'); if (d) d.hidden = true; } });

  /* ---------------------------------------------------------------- */
  /* Ações                                                              */
  /* ---------------------------------------------------------------- */
  function rel() { return A.relatorioPorId(S.rota.p); }
  AC['rel-vista'] = function (el) { S.relVista = el.dataset.v; A.render(); };
  AC['graf-periodo'] = function (el) { estado(rel()).semanas = Number(el.dataset.n); estado(rel()).sel = null; A.render(); };
  AC['graf-cat'] = function (el) { var g = estado(rel()); g.cat = g.cat === el.dataset.id ? null : el.dataset.id; g.dor = 'todas'; A.render(); var b = document.querySelector('.gb-linha[data-id="' + el.dataset.id + '"]'); if (b) b.focus(); };
  AC['graf-tabela'] = function (el) { var g = estado(rel()); g.tabela[el.dataset.g] = !g.tabela[el.dataset.g]; A.render(); };
  AC['graf-limpar'] = function () { var g = estado(rel()); g.dor = 'todas'; g.cat = null; A.render(); };
  AC['perguntar-categoria'] = function (el) {
    var r = A.relatorioPorId(el.dataset.rel), c = (D.categorias[r.produto] || []).filter(function (x) { return x.id === el.dataset.cat; })[0];
    var top = A.doresDe(r.produto, r.fonte).filter(function (d) { return d.categoria === c.id; })[0];
    var texto = 'O que está por trás de “' + top.titulo + '” em ' + c.nome + '?';
    A.iniciarConversa(r.produto, { tipo: 'usuario', texto: texto, quando: A.agora(), cita: [top.id] }, { texto: texto, agente: S.agentePadrao, modelo: S.modeloPadrao[S.agentePadrao] });
  };
  document.addEventListener('change', function (ev) {
    if (ev.target.id !== 'graf-dor') return;
    var r = A.relatorioPorId(ev.target.dataset.rel), g = estado(r);
    g.dor = ev.target.value; g.cat = null; g.sel = null;
    A.render();
    var s = document.getElementById('graf-dor'); if (s) s.focus();
  });
  var antes = A.aoRedimensionar;
  A.aoRedimensionar = function () { if (antes) antes(); if (S.rota.v === 'relatorio' && S.relVista === 'graficos') A.desenharLinha(); };
})();
