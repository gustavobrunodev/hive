/* Design Studio — Apresentar (a história Dor → Evidências → Relatório →
   Proposta) e os fluxos do roadmap (Publicar, Testar com clientes, Enviar
   ao Figma), simulados e marcados como próxima versão. */
(function () {
  'use strict';
  var A = DS.app, D = A.D, S = A.S, ic = A.ic, esc = A.esc, fmt = A.fmt;

  /* ---------------------------------------------------------------- */
  /* Apresentar                                                         */
  /* ---------------------------------------------------------------- */
  var MUDOU = {
    remessa: ['O estorno aparece como um passo do status, com o motivo em linguagem simples.', 'O cliente recebe uma notificação no momento em que o dinheiro volta.', 'O botão Confirmar diz o que falta, em vez de ficar cinza sem explicação.'],
    extrato: ['O período virou um seletor com atalhos e datas livres, até 5 anos.', 'Cada comprovante do período pode ser baixado direto da lista.', 'O rótulo que recebia toques sem resposta agora responde.'],
    reserva: ['A meta mostra destino, data e quanto falta juntar.', 'A cotação média das compras fica sempre visível.', 'Compras programadas toda semana, sem esforço do cliente.'],
    pix: ['O agendamento avisa na véspera quando falta saldo.', 'O botão Colar responde na hora e mostra a chave colada.', 'Um Pix que falhou diz o motivo e oferece tentar de novo.'],
  };
  function evidenciasApr(proto) {
    var lista = [];
    proto.dores.map(A.dor).forEach(function (d) { d.evidencias.slice(0, 2).forEach(function (e) { lista.push({ d: d, e: e }); }); });
    return lista.slice(0, 5);
  }
  function hipoteseDe(proto) {
    var at = A.ativa(proto);
    return proto.hipotese || { acreditamos: 'a ' + (at ? at.nome : 'Proposta') + ' resolve as Dores ligadas', resolve: 'o problema que levou os clientes a reclamar', saberemos: 'pelo menos 8 de 10 participantes completam a tarefa sem ajuda' };
  }
  function aparelho(proto, flags, zoom, rotulo) {
    var tela = proto.id === 'historico' ? 'periodo' : proto.telaInicial;
    return '<figure style="display:grid;gap:12px;justify-items:center;margin:0"><figcaption style="font-weight:600;color:var(--tinta-2)">' + rotulo + '</figcaption><div class="aparelho" style="zoom:' + zoom + '"><div class="aparelho-tela">' + A.ptHtml(proto.app, tela, flags, {}, '', '', 'mini') + '</div></div></figure>';
  }
  function slidesDe(proto) {
    var p = A.produto(proto.produto), at = A.ativa(proto), sl = [];
    var d = proto.dores.length ? A.dor(proto.dores[0]) : null;
    if (d) {
      var fo = A.fonte(d.fonte), est = A.estacao(p.id, d.estacao).nome;
      var outras = proto.dores.slice(1).map(A.dor);
      var texto = '<div style="display:grid;gap:24px"><p class="apr-citacao">' + esc(d.titulo) + '</p>' +
        '<div class="linha-meta" style="font-size:1.0625rem"><span class="ctx-chip">' + p.nome + '</span><span class="ctx-chip"><span class="chip-fonte f-' + d.fonte + '" style="width:18px;height:18px;border-radius:5px">' + ic(d.fonte) + '</span>' + fo.nome + ' · ' + d.rank + 'ª Dor</span><span class="ctx-chip">' + ic('celular') + 'Tela ' + esc(est) + '</span>' + A.pilImpacto(d, true) + '</div>' +
        '<p class="apr-sub">' + A.volumeTxt(d) + ' em 90 dias' + (d.tendencia > 0 ? ', crescendo ' + d.tendencia + '%' : '') + '. ' + esc(d.resumo) + '</p></div>';
      sl.push({ id: 'dor', nome: 'A Dor', html: outras.length ? '<div class="apr-dois">' + texto + '<div style="display:grid;gap:14px"><p style="font-weight:600;color:var(--tinta-2)">Este Protótipo também responde a</p><div class="apr-notas" style="grid-template-columns:repeat(' + Math.min(2, outras.length) + ',minmax(0,1fr))">' +
        outras.map(function (x, k) { return A.notaHtml(x, { acao: 'abrir-dor', giro: ['1.4deg', '-1.2deg'][k % 2] }); }).join('') + '</div></div></div>' : texto });
      var ev = evidenciasApr(proto);
      var i = Math.min(S.apr.evid, ev.length - 1), atual = ev[i];
      sl.push({ id: 'evidencias', nome: 'Evidências', passos: ev.length, html: '<h2>O que os clientes disseram e fizeram</h2><div class="apr-dois"><div class="apr-evid">' + A.evidenciaHtml(atual.d, atual.e) + '</div>' +
        '<div class="apr-minis">' + ev.map(function (x, j) {
          return '<button class="apr-mini" data-act="apr-evid" data-i="' + j + '" aria-current="' + (j === i) + '"><span class="chip-fonte f-' + x.d.fonte + '">' + ic(x.d.fonte) + '</span>' + A.fonte(x.d.fonte).nome + ' · ' + x.e.id + '</button>';
        }).join('') + '<p style="color:var(--tinta-3);font-size:.875rem;margin-top:4px">Use as setas para passar pelas Evidências.</p></div></div>' });
      var g = S.gerados[p.id] || {};
      var naTela = D.dores.filter(function (x) { return x.produto === p.id && x.estacao === d.estacao && g[x.fonte]; });
      var fs = naTela.reduce(function (acc, x) { if (acc.indexOf(x.fonte) < 0) acc.push(x.fonte); return acc; }, []);
      var contagem = {};
      D.dores.forEach(function (x) { if (x.produto === p.id && g[x.fonte]) contagem[x.estacao] = (contagem[x.estacao] || 0) + 1; });
      var trilha = '<div class="onde-doi" aria-label="Dores por tela da jornada">' + p.estacoes.map(function (e) {
        return '<span class="onde-tela' + (e.id === d.estacao ? ' quente' : '') + '"' + (e.id === d.estacao ? ' aria-current="true" style="border-color:var(--tinta);box-shadow:0 0 0 1px var(--tinta)"' : '') + '>' + esc(e.nome) + '<b>' + (contagem[e.id] || 0) + '</b></span>';
      }).join('') + '</div>';
      sl.push({ id: 'onde', nome: 'Onde dói', html: '<h2>Onde a jornada dói</h2><p class="apr-sub">A tela ' + esc(est) + ' concentra ' + A.plural(naTela.length, 'Dor', 'Dores') + ', vindas de ' + A.plural(fs.length, 'Fonte', 'Fontes') + '. Cada nota é uma Dor, na cor da Fonte que a encontrou.</p>' + trilha +
        '<div class="apr-notas">' + naTela.map(function (x, k) { return A.notaHtml(x, { acao: 'abrir-dor', giro: ['-1.6deg', '1.2deg', '-0.6deg', '1.8deg', '-1.1deg'][k % 5] }); }).join('') + '</div>' });
      var rel = A.relatorio(p.id, d.fonte);
      sl.push({ id: 'relatorio', nome: 'Relatório', html: '<h2>O que o Relatório de ' + fo.nome + ' mostra</h2><p class="apr-sub">' + esc(rel.destaque.charAt(0).toUpperCase() + rel.destaque.slice(1)) + ', em ' + fmt(rel.volume) + ' ' + fo.unidade + ' de ' + rel.periodo + '.</p>' +
        '<ol class="apr-lista">' + A.doresDe(p.id, d.fonte).slice(0, 3).map(function (x) {
          return '<li class="' + (x.id === d.id ? 'foco' : '') + '"><span class="rank-num">' + x.rank + '</span><span>' + esc(x.titulo) + '<br><small style="font-size:1rem;color:var(--tinta-3)">' + A.volumeTxt(x) + '</small></span>' + A.pilImpacto(x) + '</li>';
        }).join('') + '</ol>' });
    } else {
      sl.push({ id: 'briefing', nome: 'Pedido', html: '<h2>' + esc(proto.nome) + '</h2><div class="linha-meta" style="font-size:1.0625rem"><span class="ctx-chip">' + p.nome + '</span><span class="ctx-chip">' + ic('novo') + 'Produto novo</span></div><p class="apr-sub">' + esc(proto.briefing || '') + '</p>' });
    }
    if (at && at.id !== 'atual') {
      var mudou = MUDOU[proto.id] || MUDOU[proto.app] || [at.resumo];
      var temAtual = proto.propostas.some(function (x) { return x.id === 'atual'; });
      sl.push({ id: 'proposta', nome: 'Proposta', html: '<div class="apr-dois"><div style="display:grid;gap:28px"><h2>' + esc(at.nome) + (at.titulo ? ' · ' + esc(at.titulo) : '') + '</h2>' +
        '<ul class="apr-mudou">' + mudou.map(function (t) { return '<li>' + ic('ok') + '<span>' + esc(t) + '</span></li>'; }).join('') + '</ul></div>' +
        '<div style="display:flex;gap:28px;justify-content:center;align-items:end">' + (temAtual ? aparelho(proto, {}, 0.6, 'Atual') : '') + aparelho(proto, at.flags, temAtual ? 0.6 : 0.74, esc(at.nome)) + '</div></div>' });
    }
    var h = hipoteseDe(proto);
    sl.push({ id: 'proximos', nome: 'Próximos passos', html: '<h2>Próximos passos</h2><div class="hipotese" style="font-size:1.375rem"><span><b>Acreditamos que</b> ' + esc(h.acreditamos) + '</span><span><b>resolve</b> ' + esc(h.resolve) + '.</span><span><b>Saberemos que deu certo quando</b> ' + esc(h.saberemos) + '.</span></div>' +
      '<p class="apr-sub">Publicar a Proposta, testar com 8 clientes e, se der certo, levar as telas ao Figma. ' + A.proximaTag() + '</p>' +
      '<div style="transform:scale(1.6);transform-origin:left center;margin:8px 0 0">' + A.percurso(proto) + '</div>' });
    return sl;
  }
  A.apresentarHtml = function () {
    var a = S.apr, proto = A.proto(a.protoId), p = A.produto(proto.produto);
    var sl = slidesDe(proto);
    a.slide = Math.max(0, Math.min(a.slide, sl.length - 1));
    var trilho = sl.map(function (x, i) {
      return '<button class="apr-passo' + (i < a.slide ? ' feito' : '') + '" data-act="apr-ir" data-i="' + i + '" aria-current="' + (i === a.slide) + '"><b>' + (i + 1) + '</b><span>' + x.nome + '</span></button>';
    }).join('');
    return '<div class="apresentar quadro-fundo" role="dialog" aria-modal="true" aria-label="Apresentação: ' + esc(proto.nome) + '">' +
      '<div class="apr-topo">' + A.marca() + '<strong>' + esc(proto.nome) + '</strong><span class="apr-meta">' + p.nome + ' · ' + (a.slide + 1) + ' de ' + sl.length + ' · setas para navegar</span><span class="espaco"></span>' +
      '<span class="selo-exemplo selo-apr">Dados de exemplo</span><button class="btn btn-sec btn-p" id="apr-sair" data-act="sair-apresentar">' + ic('fechar') + 'Sair</button></div>' +
      '<div class="apr-palco"><div class="apr-slide" id="apr-slide" aria-live="polite">' + sl[a.slide].html + '</div></div>' +
      '<nav class="apr-trilho" aria-label="Partes da apresentação">' + trilho + '</nav></div>';
  };
  function moverApr(delta) {
    var a = S.apr, sl = slidesDe(A.proto(a.protoId)), atual = sl[a.slide];
    if (atual.id === 'evidencias') {
      if (delta > 0 && a.evid < atual.passos - 1) { a.evid += 1; A.renderCamadas(); return; }
      if (delta < 0 && a.evid > 0) { a.evid -= 1; A.renderCamadas(); return; }
    }
    var novo = a.slide + delta;
    if (novo < 0 || novo >= sl.length) return;
    a.slide = novo;
    if (sl[novo].id === 'evidencias') a.evid = delta > 0 ? 0 : sl[novo].passos - 1;
    A.renderCamadas();
  }
  A.teclaApresentar = function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest('button') && (ev.key === ' ' || ev.key === 'Enter')) return;
    if (['ArrowRight', 'PageDown', ' '].indexOf(ev.key) >= 0) { ev.preventDefault(); moverApr(1); }
    else if (['ArrowLeft', 'PageUp'].indexOf(ev.key) >= 0) { ev.preventDefault(); moverApr(-1); }
    else if (ev.key === 'Home') { S.apr.slide = 0; S.apr.evid = 0; A.renderCamadas(); }
  };
  A.acoes['apr-ir'] = function (el) { S.apr.slide = Number(el.dataset.i); S.apr.evid = 0; A.renderCamadas(); };
  A.acoes['apr-evid'] = function (el) { S.apr.evid = Number(el.dataset.i); A.renderCamadas(); };
  A.acoes['sair-apresentar'] = function () {
    var id = S.apr && S.apr.protoId;
    S.apr = null;
    A.renderCamadas();
    if (A.lerRota().v === 'apresentar') history.replaceState(null, '', '#trabalho.' + id);
    if (S.rota.v !== 'trabalho' || S.rota.p !== id) A.ir('#trabalho.' + id);
  };

  /* ---------------------------------------------------------------- */
  /* Fluxos do roadmap                                                  */
  /* ---------------------------------------------------------------- */
  A.abrirRoadmap = function (tipo) {
    S.pop = null;
    S.folha = { tipo: 'roadmap-' + tipo, fase: 'inicio', protoId: S.rota.p, ferramenta: 'maze', retornoEl: document.getElementById('btn-compartilhar') };
    A.renderCamadas();
    var b = document.getElementById('fechar-folha'); if (b) b.focus();
  };
  A.acoes['abrir-roadmap'] = function (el) { A.abrirRoadmap(el.dataset.tipo); };
  function urlDe(proto) {
    var at = A.ativa(proto);
    return 'https://d1x7prototipos.cloudfront.net/' + proto.id + '/' + (at ? 'proposta-' + at.id : 'atual') + '/';
  }
  function folhaBase(titulo, icone, corpo, pe) {
    return '<div class="veu" data-act="fechar-folha"></div><aside class="folha" role="dialog" aria-modal="true" aria-labelledby="folha-titulo">' +
      '<div class="folha-cab"><span class="pop-novo-ic">' + ic(icone) + '</span><h2 class="folha-titulo" id="folha-titulo" style="font-size:1.25rem">' + titulo + '</h2>' +
      '<button class="btn-icone" id="fechar-folha" data-act="fechar-folha" aria-label="Fechar">' + ic('fechar') + '</button></div>' +
      '<div class="folha-corpo"><div class="aviso-proxima">' + ic('info') + '<div>' + A.proximaTag() + '<span style="display:block;margin-top:6px">Este fluxo entra numa próxima versão. Aqui ele está simulado, com resultados de exemplo, para você validar o ciclo completo.</span></div></div>' + corpo + '</div>' +
      (pe ? '<div class="folha-pe">' + pe + '</div>' : '') + '</aside>';
  }
  function passos(lista, feito, atual) {
    return '<div class="progresso" role="status">' + lista.map(function (t, i) {
      var cls = i < feito ? 'feito' : i === atual ? 'on' : '';
      return '<div class="prog-passo ' + cls + '"><span class="pp-marca" aria-hidden="true">' + (i < feito ? ic('ok') : '') + '</span><span>' + t + '</span><span></span></div>';
    }).join('') + '</div>';
  }
  function animarPassos(f, total, fim) {
    f.passo = 0;
    var t = setInterval(function () {
      if (S.folha !== f) { clearInterval(t); return; }
      f.passo += 1;
      if (f.passo >= total) { clearInterval(t); fim(); }
      A.renderCamadas();
    }, 700);
  }
  function linha(icone, titulo, sub, acoes) {
    return '<div class="linha-config"><span class="pop-novo-ic">' + ic(icone) + '</span><div><b>' + titulo + '</b><small>' + sub + '</small></div><div class="acoes">' + (acoes || '') + '</div></div>';
  }

  A.folhas['roadmap-publicar'] = function (f) {
    var proto = A.proto(f.protoId), p = A.produto(proto.produto), at = A.ativa(proto);
    var etapas = ['Preparando o Protótipo com dados de exemplo', 'Enviando para o bucket', 'Atualizando a distribuição', 'Pronto para teste'];
    var corpo, pe;
    if (f.fase === 'inicio') {
      corpo = '<div class="campo"><label for="pub-prop">Proposta</label><select id="pub-prop">' + proto.propostas.filter(function (x) { return x.id !== 'atual' && x.estado !== 'descartada'; }).map(function (x) {
        return '<option' + (x === at ? ' selected' : '') + '>' + esc(x.nome) + (x.titulo ? ' · ' + esc(x.titulo) : '') + '</option>';
      }).join('') + '</select></div>' +
        '<div class="painel">' + linha('nuvem', 'Conta AWS deste Protótipo', 'prototipos-' + p.id + ' · São Paulo (sa-east-1)', '<button class="btn btn-ter btn-p" disabled>Trocar</button>') +
        linha('pasta', 'Bucket', 'ds-prototipos-' + p.id) + linha('link', 'Endereço', urlDe(proto)) + '</div>' +
        '<p style="color:var(--tinta-2)">O Protótipo vira um site com dados de exemplo. Nenhum dado de cliente sai do seu computador.</p>';
      pe = '<button class="btn btn-pri" data-act="pub-publicar">' + ic('nuvem') + 'Publicar</button><button class="btn btn-sec" data-act="fechar-folha">Cancelar</button>';
    } else if (f.fase === 'publicando') {
      corpo = passos(etapas, f.passo, f.passo);
    } else {
      corpo = passos(etapas, 4, -1) + '<div class="campo"><span class="rotulo">Endereço para o teste</span><div class="url-pronta"><span id="url-teste">' + urlDe(proto) + '</span><button class="btn btn-sec btn-p" data-act="copiar" data-alvo="url-teste">' + ic('copiar') + 'Copiar</button></div><small>Endereço de exemplo: não abre um site de verdade neste protótipo.</small></div>';
      pe = '<button class="btn btn-pri" data-act="pub-testar">' + ic('teste') + 'Testar com clientes</button><button class="btn btn-sec" data-act="fechar-folha">Fechar</button>';
    }
    return folhaBase('Publicar para teste', 'nuvem', corpo, pe);
  };
  A.acoes['pub-publicar'] = function () {
    var f = S.folha; f.fase = 'publicando'; A.renderCamadas();
    animarPassos(f, 4, function () { f.fase = 'pronto'; S.publicado[f.protoId] = Object.assign(S.publicado[f.protoId] || {}, { url: true }); A.toast('Proposta publicada para teste', 'nuvem'); });
  };
  A.acoes['pub-testar'] = function () { var f = S.folha; S.folha = { tipo: 'roadmap-testar', fase: 'inicio', protoId: f.protoId, ferramenta: 'maze', retornoEl: f.retornoEl }; A.renderCamadas(); };
  A.acoes.copiar = function (el) {
    var alvo = document.getElementById(el.dataset.alvo), txt = alvo ? alvo.textContent : '';
    var ok = function () { A.toast('Endereço copiado', 'copiar'); };
    var falha = function () {
      var r = document.createRange(); r.selectNodeContents(alvo);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      A.toast('Selecionei o endereço: copie com Ctrl+C', 'copiar');
    };
    try { navigator.clipboard.writeText(txt).then(ok, falha); } catch (e) { falha(); }
  };

  var FERRAMENTAS = [
    { id: 'maze', nome: 'Maze', nota: 'Teste não moderado no site publicado; caminhos e mapas de clique.' },
    { id: 'lyssna', nome: 'Lyssna', nota: 'Teste no site ao vivo, sem instalar nada no Protótipo.' },
    { id: 'usertesting', nome: 'UserTesting', nota: 'Sessões gravadas com participantes recrutados.' },
  ];
  A.folhas['roadmap-testar'] = function (f) {
    var proto = A.proto(f.protoId), h = hipoteseDe(proto);
    var corpo, pe, ferr = FERRAMENTAS.filter(function (x) { return x.id === f.ferramenta; })[0];
    var etapas = ['Publicando a Proposta', 'Criando o teste no ' + ferr.nome, 'Convidando 8 participantes'];
    if (f.fase === 'inicio') {
      corpo = '<section class="bloco"><h3>Hipótese</h3><div class="hipotese"><span><b>Acreditamos que</b> ' + esc(h.acreditamos) + '</span><span><b>resolve</b> ' + esc(h.resolve) + '.</span><span><b>Saberemos que deu certo quando</b> ' + esc(h.saberemos) + '.</span></div></section>' +
        '<section class="bloco"><h3>Ferramenta</h3><div class="opcoes" role="radiogroup" aria-label="Ferramenta de teste">' + FERRAMENTAS.map(function (x) {
          return '<button class="opcao" role="radio" data-act="teste-ferr" data-id="' + x.id + '" aria-checked="' + (f.ferramenta === x.id) + '"><b>' + x.nome + '</b><small>' + x.nota + '</small></button>';
        }).join('') + '</div></section>' +
        '<section class="bloco"><h3>Tarefas</h3><ol style="list-style:decimal;padding-left:20px;display:grid;gap:6px;color:var(--tinta-2)"><li>Você enviou dinheiro para a sua filha e ele voltou. Descubra o que aconteceu.</li><li>Resolva o problema para o dinheiro chegar.</li></ol></section>' +
        '<section class="bloco"><h3>Participantes</h3><p style="color:var(--tinta-2)">8 clientes pessoa física que enviaram uma remessa nos últimos 6 meses.</p></section>';
      pe = '<button class="btn btn-pri" data-act="teste-criar">' + ic('teste') + 'Criar teste</button><button class="btn btn-sec" data-act="fechar-folha">Cancelar</button>';
    } else if (f.fase === 'criando') {
      corpo = passos(etapas, f.passo, f.passo);
    } else if (f.fase === 'aguardando') {
      corpo = passos(etapas, 3, -1) + '<div class="painel" style="padding:16px;display:grid;gap:6px"><b style="font-size:1.0625rem">Teste no ar no ' + ferr.nome + '</b><span style="color:var(--tinta-2)">0 de 8 respostas. Os participantes recebem o convite por e-mail.</span></div>';
      pe = '<button class="btn btn-pri" data-act="teste-resultado">' + ic('relatorio') + 'Ver resultado de exemplo</button><button class="btn btn-sec" data-act="fechar-folha">Fechar</button>';
    } else {
      corpo = '<section class="bloco"><h3>Resultado <small>de exemplo · 8 participantes no ' + ferr.nome + '</small></h3><dl class="resultado"><div><dt>Concluíram a tarefa</dt><dd>7 de 8</dd></div><div><dt>Disseram o que aconteceu</dt><dd>7 de 8</dd></div><div><dt>Tempo médio</dt><dd>1 min 12 s</dd></div></dl></section>' +
        '<div class="painel" style="padding:16px;display:grid;gap:8px;border-color:var(--ok)"><span class="pilula pil-ok" style="justify-self:start">' + ic('ok') + 'Hipótese validada</span><p>7 de 8 participantes (87%) explicaram o que aconteceu com a remessa e o que fazer. A meta era 8 de 10 (80%).</p></div>' +
        '<section class="bloco"><h3>O que os participantes disseram</h3>' +
        '<article class="evid"><blockquote>“Agora eu sei que foi o IBAN. Antes eu ia ligar no banco.”</blockquote><div class="evid-topo"><span>Participante 3 · 41 anos</span></div></article>' +
        '<article class="evid"><blockquote>“A notificação ajudaria, mas eu queria saber quando o dinheiro volta de verdade.”</blockquote><div class="evid-topo"><span>Participante 6 · 29 anos</span></div></article></section>';
      pe = '<button class="btn btn-pri" data-act="teste-figma">' + ic('quadro') + 'Deu certo: enviar ao Figma</button><button class="btn btn-sec" data-act="teste-nova">Deu errado: nova Proposta</button>';
    }
    return folhaBase('Testar com clientes', 'teste', corpo, pe);
  };
  A.acoes['teste-ferr'] = function (el) { S.folha.ferramenta = el.dataset.id; A.renderCamadas(); };
  A.acoes['teste-criar'] = function () {
    var f = S.folha; f.fase = 'criando'; A.renderCamadas();
    animarPassos(f, 3, function () { f.fase = 'aguardando'; S.publicado[f.protoId] = Object.assign(S.publicado[f.protoId] || {}, { url: true, teste: true }); A.toast('Teste criado e no ar', 'teste'); });
  };
  A.acoes['teste-resultado'] = function () {
    var f = S.folha; f.fase = 'resultado';
    S.publicado[f.protoId] = Object.assign(S.publicado[f.protoId] || {}, { validado: true });
    A.renderCamadas();
  };
  A.acoes['teste-figma'] = function () { var f = S.folha; S.folha = { tipo: 'roadmap-figma', fase: 'inicio', protoId: f.protoId, retornoEl: f.retornoEl }; A.renderCamadas(); };
  A.acoes['teste-nova'] = function () {
    var id = S.folha.protoId;
    S.folha = null; A.renderCamadas();
    if (S.rota.v === 'trabalho' && S.rota.p === id) A.acoes['nova-proposta']();
    else A.ir('#trabalho.' + id);
  };

  A.folhas['roadmap-figma'] = function (f) {
    var proto = A.proto(f.protoId), p = A.produto(proto.produto), at = A.ativa(proto);
    var etapas = ['Capturando as telas', 'Criando camadas editáveis', 'Organizando no arquivo'];
    var corpo, pe;
    if (f.fase === 'inicio') {
      corpo = '<section class="bloco"><h3>Telas da ' + (at ? esc(at.nome) : 'Proposta') + '</h3>' + proto.telas.map(function (t) {
        return '<label class="escolha-linha"><input type="checkbox" checked><span>' + DS.protos.nomeTela(t) + '</span></label>';
      }).join('') + '</section>' +
        '<div class="campo"><label for="fig-arq">Arquivo de destino</label><input type="text" id="fig-arq" value="' + esc(p.nome + ' · ' + proto.nome) + '"><small>Um arquivo novo no Figma da sua equipe.</small></div>' +
        '<p style="color:var(--tinta-2)">As telas viram camadas editáveis, com textos e componentes separados, para o time de design continuar a partir delas.</p>';
      pe = '<button class="btn btn-pri" data-act="fig-enviar">' + ic('quadro') + 'Enviar ao Figma</button><button class="btn btn-sec" data-act="fechar-folha">Cancelar</button>';
    } else if (f.fase === 'enviando') {
      corpo = passos(etapas, f.passo, f.passo);
    } else {
      corpo = passos(etapas, 3, -1) + '<div class="campo"><span class="rotulo">Enviado</span><div class="url-pronta"><span id="url-figma">figma.com/design/ex4mpl0/' + esc((p.nome + '-' + proto.nome).replace(/\s+/g, '-')) + '</span><button class="btn btn-sec btn-p" data-act="copiar" data-alvo="url-figma">' + ic('copiar') + 'Copiar</button></div><small>' + A.plural(proto.telas.length, 'tela virou camada editável', 'telas viraram camadas editáveis') + '. Endereço de exemplo.</small></div>';
      pe = '<button class="btn btn-sec" data-act="fechar-folha">Fechar</button>';
    }
    return folhaBase('Enviar ao Figma', 'quadro', corpo, pe);
  };
  A.acoes['fig-enviar'] = function () {
    var f = S.folha; f.fase = 'enviando'; A.renderCamadas();
    animarPassos(f, 3, function () { f.fase = 'pronto'; S.publicado[f.protoId] = Object.assign(S.publicado[f.protoId] || {}, { figma: true }); A.toast('Telas enviadas ao Figma', 'quadro'); });
  };
})();
