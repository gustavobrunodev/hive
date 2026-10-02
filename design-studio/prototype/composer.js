/* Design Studio — o campo do chat: texto, voz, anexos colados ou
   arrastados, Dores citadas, Protótipo, agente e modelo. */
(function () {
  'use strict';
  var A = DS.app, D = A.D, S = A.S, ic = A.ic, esc = A.esc;

  S.cmp = {};
  A.cmp = function (chave) {
    if (!S.cmp[chave]) {
      S.cmp[chave] = { texto: '', anexos: [], dores: [], proto: 'novo', produtoNovo: 'cambio', agente: S.agentePadrao, modelo: S.modeloPadrao[S.agentePadrao], gravando: false };
      if (chave !== 'inicio') {
        var p = A.proto(chave), c = S.livres[chave];
        if (p) { var t = A.trab(p); S.cmp[chave].agente = t.agente; S.cmp[chave].modelo = t.modelo; S.cmp[chave].proto = p.id; }
        if (c) { S.cmp[chave].agente = c.agente || S.agentePadrao; S.cmp[chave].modelo = c.modelo || S.modeloPadrao[S.cmp[chave].agente]; S.cmp[chave].proto = 'nenhum'; S.cmp[chave].produtoNovo = c.produto; }
      }
    }
    return S.cmp[chave];
  };

  function rotuloProto(c) {
    if (c.proto === 'nenhum') return ic('conversa') + '<span>Sem Protótipo</span>';
    if (c.proto === 'novo') {
      var nome = c.produtoNovo === 'produto-novo' ? 'Produto novo' : A.produto(c.produtoNovo).nome;
      return ic('camadas') + '<span>Novo Protótipo <span class="pill-sec">· ' + esc(nome) + '</span></span>';
    }
    var p = A.proto(c.proto);
    return ic('camadas') + '<span>' + esc(p ? p.nome : 'Protótipo') + '</span>';
  }
  A.composerHtml = function (chave, modo) {
    var c = A.cmp(chave), ag = A.agente(c.agente), mod = A.modelo(c.agente, c.modelo);
    var vazio = !c.texto.trim() && !c.anexos.length && !c.dores.length;
    var contexto = c.anexos.map(function (a, i) {
      return '<span class="cmp-anexo">' + (a.url ? '<img src="' + a.url + '" alt="">' : '<span class="cmp-anexo-ic">' + ic(a.tipo === 'relatorio' ? 'relatorio' : 'arquivo') + '</span>') + '<span>' + esc(a.nome) + '</span>' +
        '<span class="chip-x" role="button" tabindex="0" data-act="tirar-anexo" data-cmp="' + chave + '" data-i="' + i + '" aria-label="Remover ' + esc(a.nome) + '">' + ic('fechar') + '</span></span>';
    }).join('') + c.dores.map(function (id) {
      var d = A.dor(id);
      return d ? '<span class="chip-dor"><span class="chip-fonte f-' + d.fonte + '">' + ic(d.fonte) + '</span><span class="chip-txt">' + esc(d.titulo) + '</span><span class="chip-x" role="button" tabindex="0" data-act="descitar" data-cmp="' + chave + '" data-id="' + d.id + '" aria-label="Tirar a citação">' + ic('fechar') + '</span></span>' : '';
    }).join('');
    var meio = c.gravando
      ? '<div class="cmp-gravacao" role="status"><span class="cmp-ouvindo">' + (c.gravando === 'real' ? 'Ouvindo… fale naturalmente' : 'Ouvindo…') + '</span><span class="onda" id="onda-' + chave + '" aria-hidden="true">' + new Array(42).join('<i></i>') + '</span><span class="cmp-tempo" id="tempo-' + chave + '">0:00</span></div>'
      : '<label class="sr" for="txt-' + chave + '">Mensagem para o agente</label><textarea class="cmp-texto" id="txt-' + chave + '" data-cmp="' + chave + '" rows="' + (modo === 'compacto' ? 2 : 3) + '" placeholder="' + (modo !== 'compacto' ? 'Descreva o que você quer criar ou melhorar. Cole prints, cite Dores com @…' : A.proto(chave) ? 'Peça uma mudança, cite uma Dor com @…' : 'Pergunte sobre as Dores e os Relatórios…') + '">' + esc(c.texto) + '</textarea>';
    var protoPill = chave === 'inicio' ? '<button class="pill" id="pill-proto-' + chave + '" data-act="pop" data-pop="proto" data-cmp="' + chave + '" aria-haspopup="menu" title="Em qual Protótipo você vai trabalhar">' + rotuloProto(c) + ic('baixo') + '</button>' : '';
    return '<div class="composer' + (modo === 'compacto' ? ' compacto' : '') + '" id="cmp-' + chave + '" data-cmp="' + chave + '">' +
      '<div class="cmp-soltar" aria-hidden="true">Solte para anexar</div>' +
      (contexto ? '<div class="cmp-contexto">' + contexto + '</div>' : '') + meio +
      '<div class="cmp-barra">' +
        '<button class="cmp-redondo" id="mais-' + chave + '" data-act="pop" data-pop="anexar" data-cmp="' + chave + '" aria-haspopup="menu" aria-label="Adicionar arquivos, prints, Dores ou Relatórios">' + ic('mais') + '</button>' +
        protoPill + '<span class="espaco"></span>' +
        '<button class="pill" id="pill-ag-' + chave + '" data-act="pop" data-pop="agente" data-cmp="' + chave + '" data-alinhar="direita" aria-haspopup="menu" title="Agente e modelo">' + A.logoAgente(ag.id) + '' + ag.nome + ' <span class="pill-sec">' + esc(mod.nome) + '</span>' + ic('baixo') + '</button>' +
        '<button class="cmp-redondo cmp-mic' + (c.gravando ? ' gravando' : '') + '" data-act="mic" data-cmp="' + chave + '" aria-pressed="' + !!c.gravando + '" aria-label="' + (c.gravando ? 'Parar o ditado' : 'Ditar por voz') + '">' + ic(c.gravando ? 'parar' : 'mic') + '</button>' +
        '<button class="cmp-enviar" id="enviar-' + chave + '" data-act="enviar" data-cmp="' + chave + '" aria-label="Enviar"' + (vazio || c.gravando ? ' disabled' : '') + '>' + ic('enviar') + '</button>' +
      '</div>' +
      '<input type="file" id="arq-' + chave + '" data-cmp="' + chave + '" class="sr" multiple accept="image/*,.pdf,.docx" tabindex="-1">' +
      '</div>';
  };
  A.renderComposer = function (chave, focar) {
    var el = document.getElementById('cmp-' + chave);
    if (!el) return;
    var modo = el.classList.contains('compacto') ? 'compacto' : 'inicio';
    var tmp = document.createElement('div');
    tmp.innerHTML = A.composerHtml(chave, modo);
    el.replaceWith(tmp.firstChild);
    if (focar) { var t = document.getElementById('txt-' + chave); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); autoAltura(t); } }
  };
  function autoAltura(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 260) + 'px'; }

  /* ---------------------------------------------------------------- */
  /* Menus do campo                                                     */
  /* ---------------------------------------------------------------- */
  A.pops.anexar = function (x) {
    return '<p class="pop-titulo">Adicionar ao pedido</p>' +
      '<button class="pop-item" data-act="anexar-arquivo" data-cmp="' + x.cmp + '"><span class="pop-novo-ic">' + ic('clipe') + '</span><span class="pop-txt"><b>Anexar arquivos</b><small>Prints, PDF, PRD (também dá para arrastar)</small></span></button>' +
      '<button class="pop-item" data-act="dica-colar"><span class="pop-novo-ic">' + ic('imagem') + '</span><span class="pop-txt"><b>Colar um print</b><small>Copie a imagem e use Ctrl+V no campo</small></span></button>' +
      '<button class="pop-item" data-act="abrir-citar" data-cmp="' + x.cmp + '"><span class="pop-novo-ic">' + ic('arroba') + '</span><span class="pop-txt"><b>Citar uma Dor</b><small>Ou digite @ no campo</small></span></button>' +
      '<button class="pop-item" data-act="abrir-rels" data-cmp="' + x.cmp + '"><span class="pop-novo-ic">' + ic('relatorio') + '</span><span class="pop-txt"><b>Anexar um Relatório de Fonte</b><small>O agente usa como contexto</small></span></button>';
  };
  A.pops.citar = function (x) {
    var c = A.cmp(x.cmp);
    var produto = c.proto !== 'novo' && c.proto !== 'nenhum' && A.proto(c.proto) ? A.proto(c.proto).produto : (c.produtoNovo === 'produto-novo' ? 'cambio' : c.produtoNovo);
    var g = S.gerados[produto] || {};
    var lista = D.dores.filter(function (d) { return d.produto === produto && g[d.fonte]; }).sort(function (a, b) { return A.ordemImpacto[a.impacto] - A.ordemImpacto[b.impacto] || b.volume - a.volume; }).slice(0, 9);
    if (!lista.length) return '<p class="pop-titulo">Citar uma Dor</p><div class="vazio" style="padding:16px"><p>Ainda não há Relatórios de ' + A.produto(produto).nome + '.</p></div>';
    return '<p class="pop-titulo">Dores de ' + A.produto(produto).nome + '</p>' + lista.map(function (d) {
      var on = c.dores.indexOf(d.id) >= 0;
      return '<button class="pop-item" role="menuitemcheckbox" aria-checked="' + on + '" data-act="citar" data-cmp="' + x.cmp + '" data-id="' + d.id + '"' + (x.arroba ? ' data-arroba="1"' : '') + '><span class="chip-fonte f-' + d.fonte + '">' + ic(d.fonte) + '</span><span class="pop-txt"><b>' + esc(d.titulo) + '</b><small>' + A.fonte(d.fonte).nome + ' · ' + A.volumeTxt(d) + '</small></span>' + (on ? '<span class="pop-ok">' + ic('ok') + '</span>' : '') + '</button>';
    }).join('');
  };
  A.pops.rels = function (x) {
    var lista = D.relatorios.filter(function (r) { return (S.gerados[r.produto] || {})[r.fonte]; });
    return '<p class="pop-titulo">Relatórios de Fonte</p>' + lista.map(function (r) {
      return '<button class="pop-item" data-act="anexar-rel" data-cmp="' + x.cmp + '" data-id="' + r.id + '"><span class="chip-fonte f-' + r.fonte + '">' + ic(r.fonte) + '</span><span class="pop-txt"><b>' + A.fonte(r.fonte).nome + ' · ' + A.produto(r.produto).nome + '</b><small>' + esc(r.destaque) + '</small></span></button>';
    }).join('');
  };
  A.pops.proto = function (x) {
    var c = A.cmp(x.cmp);
    var novos = D.produtos.map(function (p) {
      var on = c.proto === 'novo' && c.produtoNovo === p.id;
      var g = S.gerados[p.id] || {};
      var n = A.FONTES.filter(function (f) { return g[f]; }).length;
      return '<button class="pop-item" role="menuitemradio" aria-checked="' + on + '" data-act="escolher-proto" data-cmp="' + x.cmp + '" data-proto="novo" data-produto="' + p.id + '"><span class="pop-novo-ic">' + ic('mais') + '</span><span class="pop-txt"><b>Novo Protótipo em ' + p.nome + '</b><small>Recria a tela de hoje e propõe a melhoria · ' + n + ' de 3 Fontes</small></span>' + (on ? '<span class="pop-ok">' + ic('ok') + '</span>' : '') + '</button>';
    }).join('');
    var onNovo = c.proto === 'novo' && c.produtoNovo === 'produto-novo';
    var onNada = c.proto === 'nenhum';
    var existentes = S.prototipos.map(function (p) {
      var at = A.ativa(p), on = c.proto === p.id;
      return '<button class="pop-item" role="menuitemradio" aria-checked="' + on + '" data-act="escolher-proto" data-cmp="' + x.cmp + '" data-proto="' + p.id + '"><span class="mini-tela" aria-hidden="true"><span class="mini-tela-in">' + A.ptHtml(p.app, p.telaInicial, at ? at.flags : {}, {}, '', '', 'mini') + '</span></span><span class="pop-txt"><b>' + esc(p.nome) + '</b><small>' + A.produto(p.produto).nome + ' · ' + esc(p.atualizado) + '</small></span>' + (on ? '<span class="pop-ok">' + ic('ok') + '</span>' : '') + '</button>';
    }).join('');
    return '<p class="pop-titulo">Começar algo novo</p>' + novos +
      '<button class="pop-item" role="menuitemradio" aria-checked="' + onNovo + '" data-act="escolher-proto" data-cmp="' + x.cmp + '" data-proto="novo" data-produto="produto-novo"><span class="pop-novo-ic">' + ic('novo') + '</span><span class="pop-txt"><b>Produto novo</b><small>Sem tela de hoje: o agente parte do seu pedido</small></span>' + (onNovo ? '<span class="pop-ok">' + ic('ok') + '</span>' : '') + '</button>' +
      '<button class="pop-item" role="menuitemradio" aria-checked="' + onNada + '" data-act="escolher-proto" data-cmp="' + x.cmp + '" data-proto="nenhum"><span class="pop-novo-ic">' + ic('conversa') + '</span><span class="pop-txt"><b>Sem Protótipo</b><small>Só conversar sobre as Dores e os Relatórios</small></span>' + (onNada ? '<span class="pop-ok">' + ic('ok') + '</span>' : '') + '</button>' +
      '<hr><p class="pop-titulo">Continuar um Protótipo</p>' + existentes;
  };
  A.pops.agente = function (x) {
    var c = A.cmp(x.cmp), aba = x.aba || c.agente, a = A.agente(aba);
    return '<div class="ag-abas" role="tablist" aria-label="Agente">' + D.agentes.map(function (ag) {
      return '<button class="ag-aba" role="tab" data-act="pop-aba-agente" data-agente="' + ag.id + '" aria-selected="' + (ag.id === aba) + '">' + A.logoAgente(ag.id) + '<span><b>' + ag.nome + '</b><small>' + (ag.id === c.agente ? 'Em uso' : 'Conectado') + '</small></span></button>';
    }).join('') + '</div><p class="pop-titulo">Modelos do ' + a.nome + '</p>' + a.modelos.map(function (m) {
      var on = c.agente === a.id && c.modelo === m.id;
      return '<button class="pop-item" role="menuitemradio" aria-checked="' + on + '" data-act="escolher-modelo" data-cmp="' + x.cmp + '" data-agente="' + a.id + '" data-modelo="' + m.id + '"><span class="pop-txt"><b>' + esc(m.nome) + '</b><small>' + esc(m.nota) + '</small></span>' + (on ? '<span class="pop-ok">' + ic('ok') + '</span>' : '') + '</button>';
    }).join('');
  };

  /* ---------------------------------------------------------------- */
  /* Ações                                                              */
  /* ---------------------------------------------------------------- */
  var AC = A.acoes;
  AC['pop-aba-agente'] = function (el) {
    if (!S.pop) return;
    S.pop.extra.aba = el.dataset.agente;
    A.renderCamadas();
    var b = document.querySelector('.ag-aba[aria-selected="true"]'); if (b) b.focus();
  };
  AC['anexar-arquivo'] = function (el) { var ch = el.dataset.cmp; A.fecharPop(); var i = document.getElementById('arq-' + ch); if (i) i.click(); };
  AC['dica-colar'] = function () { A.fecharPop(); A.toast('Copie um print e cole com Ctrl+V dentro do campo', 'imagem'); };
  AC['abrir-citar'] = function (el) { var ch = el.dataset.cmp; S.pop = null; A.renderCamadas(); var anc = document.getElementById('mais-' + ch); if (anc) A.abrirPop(anc, 'citar', { cmp: ch }); };
  AC['abrir-rels'] = function (el) { var ch = el.dataset.cmp; S.pop = null; A.renderCamadas(); var anc = document.getElementById('mais-' + ch); if (anc) A.abrirPop(anc, 'rels', { cmp: ch }); };
  AC.citar = function (el) {
    var ch = el.dataset.cmp, c = A.cmp(ch), id = el.dataset.id, i = c.dores.indexOf(id);
    if (el.dataset.arroba) c.texto = c.texto.replace(/@$/, '');
    if (i >= 0) c.dores.splice(i, 1); else c.dores.push(id);
    S.pop = null; A.renderCamadas(); A.renderComposer(ch, true);
    if (A.aoMudarComposer) A.aoMudarComposer(ch);
  };
  AC.descitar = function (el) {
    var ch = el.dataset.cmp;
    if (!ch) return;
    var c = A.cmp(ch); c.dores = c.dores.filter(function (x) { return x !== el.dataset.id; });
    A.renderComposer(ch, true); if (A.aoMudarComposer) A.aoMudarComposer(ch);
  };
  AC['anexar-rel'] = function (el) {
    var ch = el.dataset.cmp, r = A.relatorioPorId(el.dataset.id);
    A.cmp(ch).anexos.push({ tipo: 'relatorio', nome: 'Relatório de ' + A.fonte(r.fonte).nome + ' · ' + A.produto(r.produto).nome, rel: r.id });
    S.pop = null; A.renderCamadas(); A.renderComposer(ch, true);
  };
  AC['tirar-anexo'] = function (el) { var ch = el.dataset.cmp; A.cmp(ch).anexos.splice(Number(el.dataset.i), 1); A.renderComposer(ch, true); };
  AC['escolher-proto'] = function (el) {
    var ch = el.dataset.cmp, c = A.cmp(ch);
    c.proto = el.dataset.proto;
    if (el.dataset.produto) c.produtoNovo = el.dataset.produto;
    S.pop = null; A.renderCamadas(); A.renderComposer(ch, true);
    if (A.aoMudarComposer) A.aoMudarComposer(ch);
  };
  AC['escolher-modelo'] = function (el) {
    var ch = el.dataset.cmp, c = A.cmp(ch);
    var mudouAgente = c.agente !== el.dataset.agente;
    c.agente = el.dataset.agente; c.modelo = el.dataset.modelo;
    var p = A.proto(ch);
    if (p) { var t = A.trab(p); if (mudouAgente) S.conversas[p.id].msgs.push({ tipo: 'registro', texto: 'Agente trocado para ' + A.agente(c.agente).nome, quando: A.agora() }); t.agente = c.agente; t.modelo = c.modelo; p.agente = c.agente; }
    var cv = S.livres[ch]; if (cv) { cv.agente = c.agente; cv.modelo = c.modelo; }
    if (ch === 'inicio') { S.agentePadrao = c.agente; S.modeloPadrao[c.agente] = c.modelo; }
    S.pop = null; A.renderCamadas(); A.renderComposer(ch, true);
    if (p || cv) A.renderMsgs();
    A.toast(A.agente(c.agente).nome + ' ' + A.modelo(c.agente, c.modelo).nome + ' vai responder');
  };

  /* Ditado por voz: usa o reconhecimento do navegador quando existe;
     sem ele, simula a transcrição. */
  var gravacao = null;
  var FRASES = {
    inicio: 'Quero que o cliente entenda por que a remessa voltou e o que fazer para reenviar, sem precisar ligar para a central.',
    outro: 'Deixa o motivo do estorno mais visível e coloca um botão para corrigir o IBAN.',
  };
  AC.mic = function (el) {
    var ch = el.dataset.cmp, c = A.cmp(ch);
    if (c.gravando) { pararGravacao(ch, true); return; }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var base = c.texto ? c.texto.replace(/\s+$/, '') + ' ' : '';
    c.gravando = SR ? 'real' : 'simulado';
    A.renderComposer(ch);
    var inicio = Date.now();
    gravacao = { ch: ch, base: base, t: setInterval(function () { animarOnda(ch, inicio); }, 110) };
    if (SR) {
      try {
        var rec = new SR(); rec.lang = 'pt-BR'; rec.interimResults = true; rec.continuous = true;
        var final = '';
        rec.onresult = function (e) {
          var interino = '';
          for (var i = e.resultIndex; i < e.results.length; i++) { if (e.results[i].isFinal) final += e.results[i][0].transcript; else interino += e.results[i][0].transcript; }
          c.texto = base + final + interino;
        };
        rec.onerror = function () { if (gravacao && gravacao.ch === ch) { gravacao.rec = null; c.gravando = 'simulado'; gravacao.simular = setTimeout(function () { transcreverSimulado(ch); }, 2600); } };
        rec.onend = function () { if (gravacao && gravacao.ch === ch && gravacao.rec) pararGravacao(ch, false); };
        rec.start();
        gravacao.rec = rec;
      } catch (e) { c.gravando = 'simulado'; gravacao.simular = setTimeout(function () { transcreverSimulado(ch); }, 3600); }
    } else {
      gravacao.simular = setTimeout(function () { transcreverSimulado(ch); }, 3600);
    }
  };
  function animarOnda(ch, inicio) {
    var onda = document.getElementById('onda-' + ch), tempo = document.getElementById('tempo-' + ch);
    if (onda) Array.prototype.forEach.call(onda.children, function (b, i) { b.style.height = (6 + Math.abs(Math.sin(Date.now() / 160 + i * 0.7)) * 22 * Math.random() + 4) + 'px'; });
    if (tempo) { var s = Math.floor((Date.now() - inicio) / 1000); tempo.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  }
  function transcreverSimulado(ch) {
    if (!gravacao || gravacao.ch !== ch) return;
    var c = A.cmp(ch);
    c.texto = gravacao.base + (ch === 'inicio' ? FRASES.inicio : FRASES.outro);
    c.voz = true;
    pararGravacao(ch, false);
  }
  function pararGravacao(ch, manual) {
    if (!gravacao) return;
    clearInterval(gravacao.t); clearTimeout(gravacao.simular);
    var c = A.cmp(ch);
    if (gravacao.rec) { var r = gravacao.rec; gravacao.rec = null; try { r.stop(); } catch (e) { /* já parado */ } }
    if (manual && c.gravando === 'simulado' && c.texto === gravacao.base.trim()) { c.texto = gravacao.base + (ch === 'inicio' ? FRASES.inicio : FRASES.outro); }
    if (c.texto && c.texto !== gravacao.base) c.voz = true;
    gravacao = null; c.gravando = false;
    A.renderComposer(ch, true);
  }

  /* Enviar */
  AC.enviar = function (el) { A.enviarComposer(el.dataset.cmp); };
  A.enviarComposer = function (ch) {
    var c = A.cmp(ch);
    var t = document.getElementById('txt-' + ch); if (t) c.texto = t.value;
    var texto = c.texto.trim();
    if (!texto && !c.anexos.length && !c.dores.length) { A.toast('Escreva, dite ou anexe algo para começar', 'info'); return; }
    if (!texto) texto = c.dores.length ? 'Resolver ' + (c.dores.length === 1 ? 'esta Dor' : 'estas Dores') : 'Veja os anexos';
    var msg = { tipo: 'usuario', texto: texto, quando: A.agora(), cita: c.dores.slice(), anexos: c.anexos.slice(), voz: !!c.voz };
    var pacote = { texto: texto, dores: c.dores.slice(), anexos: c.anexos.slice(), agente: c.agente, modelo: c.modelo };
    if (ch === 'inicio') {
      var destino = c.proto, produto = c.produtoNovo;
      S.cmp.inicio = null; A.cmp('inicio');
      S.cmp.inicio.agente = pacote.agente; S.cmp.inicio.modelo = pacote.modelo;
      if (destino === 'nenhum') A.iniciarConversa(produto === 'produto-novo' ? 'cambio' : produto, msg, pacote);
      else if (destino === 'novo') A.iniciarPrototipo(produto, msg, pacote);
      else A.continuarPrototipo(destino, msg, pacote);
      return;
    }
    var proto = A.proto(ch), cv = S.livres[ch];
    if ((proto && S.conversas[proto.id].ocupado) || (cv && cv.ocupado)) { A.toast('Espere o agente terminar a resposta', 'info'); return; }
    c.texto = ''; c.anexos = []; c.dores = []; c.voz = false;
    if (proto) {
      var conv = S.conversas[proto.id];
      conv.msgs.push(msg);
      A.renderComposer(ch, true);
      A.renderTrabalhoParcial();
      A.respostaLivreProto(proto, texto, { anexos: pacote.anexos });
      return;
    }
    if (cv) {
      cv.msgs.push(msg); cv.quando = 'agora';
      A.render();
      A.respostaLivre(cv, texto, {});
    }
  };

  /* Eventos do campo: digitar, @, Enter, colar, arrastar, arquivo */
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!t.classList || !t.classList.contains('cmp-texto')) return;
    var ch = t.dataset.cmp, c = A.cmp(ch);
    c.texto = t.value; c.voz = false;
    autoAltura(t);
    var b = document.getElementById('enviar-' + ch);
    if (b) b.disabled = !t.value.trim() && !c.anexos.length && !c.dores.length;
    if (ev.inputType === 'insertText' && ev.data === '@') { var anc = document.getElementById('mais-' + ch); if (anc) A.abrirPop(anc, 'citar', { cmp: ch, arroba: '1' }); }
    if (A.aoMudarComposer) A.aoMudarComposer(ch, true);
  });
  document.addEventListener('keydown', function (ev) {
    var t = ev.target;
    if (t.classList && t.classList.contains('cmp-texto') && ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
      ev.preventDefault(); A.enviarComposer(t.dataset.cmp);
    }
  });
  function lerArquivos(ch, files) {
    var c = A.cmp(ch), pend = 0;
    Array.prototype.forEach.call(files || [], function (f, idx) {
      var nome = f.name && f.name !== 'image.png' ? f.name : 'print-colado-' + (c.anexos.length + idx + 1) + '.png';
      if (/^image\//.test(f.type)) {
        pend++;
        var r = new FileReader();
        r.onload = function () { c.anexos.push({ tipo: 'imagem', nome: nome, url: r.result }); pend--; if (!pend) { A.renderComposer(ch, true); A.toast('Anexado: ' + nome, 'imagem'); } };
        r.readAsDataURL(f);
      } else {
        c.anexos.push({ tipo: 'arquivo', nome: nome });
      }
    });
    if (!pend) A.renderComposer(ch, true);
  }
  document.addEventListener('paste', function (ev) {
    var t = ev.target;
    if (!t.classList || !t.classList.contains('cmp-texto')) return;
    var files = ev.clipboardData && ev.clipboardData.files;
    if (files && files.length) { ev.preventDefault(); lerArquivos(t.dataset.cmp, files); }
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.type === 'file' && t.id && t.id.indexOf('arq-') === 0) lerArquivos(t.dataset.cmp, t.files);
  });
  document.addEventListener('dragover', function (ev) {
    var z = ev.target.closest && ev.target.closest('.composer');
    if (z && ev.dataTransfer && Array.prototype.indexOf.call(ev.dataTransfer.types || [], 'Files') >= 0) { ev.preventDefault(); z.classList.add('arrastando'); }
  });
  document.addEventListener('dragleave', function (ev) {
    var z = ev.target.closest && ev.target.closest('.composer');
    if (z && !z.contains(ev.relatedTarget)) z.classList.remove('arrastando');
  });
  document.addEventListener('drop', function (ev) {
    var z = ev.target.closest && ev.target.closest('.composer');
    if (!z) return;
    ev.preventDefault(); z.classList.remove('arrastando');
    lerArquivos(z.dataset.cmp, ev.dataTransfer.files);
  });
})();
