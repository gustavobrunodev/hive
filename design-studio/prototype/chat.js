/* Design Studio — conversa: mensagens, o agente escrevendo e os
   roteiros de exemplo (as respostas não vêm de um modelo de verdade). */
(function () {
  'use strict';
  var A = DS.app, D = A.D, S = A.S, ic = A.ic, esc = A.esc, fmt = A.fmt;

  /* ---------------------------------------------------------------- */
  /* Peças                                                              */
  /* ---------------------------------------------------------------- */
  A.pilImpacto = function (d, longo) {
    var curto = { alto: 'Alto', medio: 'Médio', baixo: 'Baixo' }[d.impacto];
    return '<span class="pilula imp-' + d.impacto + '">' + ic({ alto: 'alerta', medio: 'impMedio', baixo: 'impBaixo' }[d.impacto]) + (longo ? A.nomeImpacto[d.impacto] : curto) + '</span>';
  };
  A.tendencia = function (d) {
    var t = d.tendencia;
    var cls = t > 0 ? 't-sobe' : t < 0 ? 't-desce' : 't-igual';
    return '<span class="tendencia ' + cls + '" title="Comparado aos 90 dias anteriores">' + ic(t > 0 ? 'sobe' : t < 0 ? 'desce' : 'igual') + (t === 0 ? 'estável' : Math.abs(t) + '%') + '</span>';
  };
  A.volumeTxt = function (d) { return fmt(d.volume) + ' ' + A.fonte(d.fonte).unidadeDor; };
  A.proximaTag = function () { return '<span class="proxima">Próxima versão</span>'; };
  A.chipDor = function (d, opts) {
    opts = opts || {};
    return '<' + (opts.estatico ? 'span' : 'button') + ' class="chip-dor"' + (opts.estatico ? '' : ' data-act="abrir-dor" data-id="' + d.id + '"') + ' title="' + esc(d.titulo) + '">' +
      '<span class="chip-fonte f-' + d.fonte + '">' + ic(d.fonte) + '</span><span class="chip-txt">' + esc(d.titulo) + '</span>' +
      (opts.remover ? '<span class="chip-x" role="button" data-act="descitar" data-id="' + d.id + '" aria-label="Tirar a citação">' + ic('fechar') + '</span>' : '') +
      '</' + (opts.estatico ? 'span' : 'button') + '>';
  };
  function cabAgente(m) {
    var ag = A.agente(m.agente) || A.agente('claude');
    var mod = m.modelo ? A.modelo(ag.id, m.modelo).nome : '';
    return '<div class="msg-cab">' + A.logoAgente(ag.id) + '<b>' + ag.nome + '</b>' + (mod ? '<span class="msg-modelo">' + mod + '</span>' : '') + (m.quando ? '<span class="msg-hora">' + m.quando + '</span>' : '') + '</div>';
  }
  function gravidadePil(g) {
    if (g === 'resolvido') return '<span class="pilula pil-ok">' + ic('ok') + 'Resolvido</span>';
    return A.pilImpacto({ impacto: g });
  }
  function sugestoesHtml(m) {
    if (!m.sugestoes || !m.sugestoes.length) return '';
    return '<div class="sugestoes">' + m.sugestoes.map(function (t) { return '<button class="sugestao" data-act="sugestao" data-texto="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>';
  }
  function pontoHtml(m) {
    if (!m.ponto || m._n != null) return '';
    return '<button class="ponto-msg" data-act="ver-historico" title="Ver no Histórico">' + ic('historico') + 'Ponto de restauração · ' + esc(m.ponto) + '</button>';
  }
  function anexosHtml(lista) {
    if (!lista || !lista.length) return '';
    return '<div class="msg-anexos">' + lista.map(function (a) {
      return a.url ? '<span class="anexo-mini"><img src="' + a.url + '" alt="' + esc(a.nome) + '"></span>' : '<span class="anexo-arq">' + ic(a.tipo === 'relatorio' ? 'relatorio' : 'arquivo') + esc(a.nome) + '</span>';
    }).join('') + '</div>';
  }
  var PASSOS_GERACAO = ['Lendo os dados do período', 'Agrupando por tema', 'Ranqueando as Dores', 'Escrevendo a narrativa'];
  A.msgHtml = function (m) {
    if (m.tipo === 'registro') return '<p class="registro">' + ic('historico') + '<span>' + esc(m.texto) + (m.quando ? ' · ' + m.quando : '') + '</span></p>';
    if (m.tipo === 'usuario') {
      var cits = (m.cita || []).map(A.dor).filter(Boolean).map(function (d) { return A.chipDor(d, { estatico: true }); }).join('');
      var coms = m.comentarios ? '<ol class="msg-coms">' + m.comentarios.map(function (c, i) { return '<li><span class="pin-num">' + (i + 1) + '</span>' + esc(c.texto) + '<small>' + esc(c.tela) + '</small></li>'; }).join('') + '</ol>' : '';
      return '<div class="msg usuario">' + anexosHtml(m.anexos) + '<div class="msg-bolha">' + (m.texto ? '<p>' + esc(m.texto) + '</p>' : '') + coms + '</div>' + (cits ? '<div class="msg-citas">' + cits + '</div>' : '') +
        '<span class="msg-hora">' + (m.atalho ? 'Atalho · ' : '') + (m.voz ? ic('mic') + ' Ditado · ' : '') + (m.quando || '') + '</span></div>';
    }
    if (m.tipo === 'insercao') {
      return '<div class="msg usuario"><div class="msg-selecao">' + ic('inserir') + '<span><b>Inserir ' + (m.posicao === 'antes' ? 'antes ' : 'depois ') + esc(A.refBloco(m.ancora)) + '</b><small>' + esc(m.tipoNome) + ': ' + esc(m.pedido) + '</small></span></div><span class="msg-hora">Ponto de inserção no canvas · ' + (m.quando || '') + '</span></div>';
    }
    if (m.tipo === 'selecao') {
      return '<div class="msg usuario"><div class="msg-selecao">' + ic('selecionar') + '<span><b>' + esc(m.elemento) + '</b><small>' + esc(m.acao) + (m.pedido ? ': ' + esc(m.pedido) : '') + '</small></span></div><span class="msg-hora">Selecionado no canvas · ' + (m.quando || '') + '</span></div>';
    }
    if (m.tipo === 'revisao') {
      return '<div class="msg">' + cabAgente(m) + '<div class="revisao"><p class="revisao-titulo">' + esc(m.titulo) + '</p>' + m.achados.map(function (a) {
        return '<div class="achado">' + gravidadePil(a.gravidade) + '<span>' + esc(a.texto) + '</span></div>';
      }).join('') + '</div>' + sugestoesHtml(m) + pontoHtml(m) + '</div>';
    }
    if (m.tipo === 'progresso') {
      return '<div class="msg">' + cabAgente(m) + '<div class="cartao-progresso"><p><b>' + esc(m.titulo) + '</b></p><ol>' + PASSOS_GERACAO.map(function (t, i) {
        var cls = i < m.passo ? 'feito' : i === m.passo ? 'agora' : '';
        return '<li class="' + cls + '"><span class="pp-marca">' + (i < m.passo ? ic('ok') : '') + '</span>' + (i === 0 && m.volume ? 'Lendo ' + m.volume : t) + '</li>';
      }).join('') + '</ol></div></div>';
    }
    if (m.tipo === 'relatorio-pronto') {
      var rel = A.relatorioPorId(m.rel), fo = A.fonte(rel.fonte);
      var top = A.doresDe(rel.produto, rel.fonte).slice(0, 3);
      return '<div class="msg">' + cabAgente(m) + '<div class="msg-texto"><p>' + esc(m.texto) + '</p></div>' +
        '<div class="cartao-relatorio"><div class="cr-cab"><span class="chip-fonte f-' + rel.fonte + '">' + ic(rel.fonte) + '</span><span><b>Relatório de ' + fo.nome + ' · ' + A.produto(rel.produto).nome + '</b><small>' + fmt(rel.volume) + ' ' + fo.unidade + ' · ' + esc(rel.destaque) + '</small></span></div>' +
        top.map(function (d) { return '<button class="cr-dor" data-act="abrir-dor" data-id="' + d.id + '"><span class="cr-rank">' + d.rank + '</span><span class="cr-txt">' + esc(d.titulo) + '<small>' + A.volumeTxt(d) + '</small></span>' + A.pilImpacto(d) + '</button>'; }).join('') +
        '<div class="cr-pe"><a class="btn btn-sec btn-p" href="#relatorio.' + rel.id + '">' + ic('relatorio') + 'Abrir Relatório</a><button class="btn btn-pri btn-p" data-act="resolver-dor" data-id="' + top[0].id + '">Resolver a 1ª Dor ' + ic('seta') + '</button></div></div></div>';
    }
    /* agente */
    var paras = m.texto.map(function (t, i) {
      if (m._n != null) {
        var antes = m.texto.slice(0, i).join(' ').split(' ').length - (i ? 0 : 1);
        if (i && m._n <= antes) return '';
        var palavras = t.split(' ');
        var vis = Math.max(0, Math.min(palavras.length, m._n - (i ? antes : 0)));
        return '<p>' + esc(palavras.slice(0, vis).join(' ')) + (i === m.texto.length - 1 || vis < palavras.length ? '<span class="cursor-escrita"></span>' : '') + '</p>';
      }
      return '<p>' + esc(t) + '</p>';
    }).join('');
    var final = m._n == null;
    var acoes = final && m.acoes && m.acoes.length ? '<div class="acoes-agente">' + m.acoes.map(function (a) { return '<span>' + ic('ok') + esc(a) + '</span>'; }).join('') + '</div>' : '';
    var ver = final && m.verNoCanvas ? '<button class="btn btn-sec btn-p" data-act="ver-canvas" data-proposta="' + m.verNoCanvas.proposta + '" data-tela="' + m.verNoCanvas.tela + '">' + ic('olho') + 'Ver no canvas</button>' : '';
    var cd = final && m.citaDores ? '<div class="msg-citas">' + m.citaDores.map(A.dor).filter(Boolean).map(function (d) { return A.chipDor(d); }).join('') + '</div>' : '';
    var criar = final && m.criar ? '<button class="btn btn-pri btn-p" data-act="criar-de-conversa" data-dores="' + m.criar.dores.join(',') + '">' + ic('camadas') + 'Criar Protótipo com estas Dores</button>' : '';
    var escolhas = final && m.escolhas ? '<div class="escolhas">' + m.escolhas.map(function (e) { return '<button class="escolha" data-act="escolha" data-valor="' + esc(e.valor) + '" data-texto="' + esc(e.texto) + '">' + (e.ic ? '<span class="chip-fonte f-' + e.ic + '">' + ic(e.ic) + '</span>' : '') + '<span><b>' + esc(e.rotulo) + '</b>' + (e.nota ? '<small>' + esc(e.nota) + '</small>' : '') + '</span></button>'; }).join('') + '</div>' : '';
    var carimbo = final && m.carimbo ? '<span class="carimbo">' + ic('ok') + esc(m.carimbo) + '</span>' : '';
    var botoes = final && (ver || criar) ? '<div class="msg-botoes">' + ver + criar + '</div>' : '';
    return '<div class="msg">' + cabAgente(m) + '<div class="msg-texto">' + paras + '</div>' + carimbo + acoes + cd + escolhas + botoes + (final ? sugestoesHtml(m) : '') + pontoHtml(m) + '</div>';
  };
  A.DIGITANDO = '<div class="msg msg-digitando" aria-label="O agente está escrevendo"><span class="digitando" aria-hidden="true"><i></i><i></i><i></i></span></div>';

  /* ---------------------------------------------------------------- */
  /* Fala do agente (palavra a palavra)                                 */
  /* ---------------------------------------------------------------- */
  A.conv = function (alvo) { return alvo.tipo === 'proto' ? S.conversas[alvo.id] : S.livres[alvo.id]; };
  A.agenteAtual = function (alvo) {
    if (alvo.tipo === 'proto') { var t = A.trab(A.proto(alvo.id)); return { agente: t.agente, modelo: t.modelo }; }
    var c = S.livres[alvo.id]; return { agente: c.agente || S.agentePadrao, modelo: c.modelo || S.modeloPadrao[c.agente || S.agentePadrao] };
  };
  A.renderMsgs = function () {
    var box = document.getElementById('msgs');
    if (!box) return;
    var alvo = A.alvoAtual();
    if (!alvo) return;
    var c = A.conv(alvo);
    box.innerHTML = c.msgs.map(A.msgHtml).join('') + (c.ocupado ? A.DIGITANDO : '');
    A.rolarFim();
  };
  A.alvoAtual = function () {
    if (S.rota.v === 'trabalho' && A.proto(S.rota.p)) return { tipo: 'proto', id: S.rota.p };
    if (S.rota.v === 'conversa' && S.livres[S.rota.p]) return { tipo: 'livre', id: S.rota.p };
    return null;
  };
  A.rolarFim = function () {
    var corpo = document.getElementById('chat-corpo');
    if (corpo) corpo.scrollTop = corpo.scrollHeight;
  };
  A.agenteFala = function (alvo, msg, opts) {
    opts = opts || {};
    var c = A.conv(alvo);
    var quem = A.agenteAtual(alvo);
    c.ocupado = true; A.renderMsgs();
    setTimeout(function () {
      msg.agente = msg.agente || quem.agente;
      msg.modelo = msg.modelo || quem.modelo;
      msg.quando = A.agora();
      if (opts.antes) opts.antes();
      if (msg.tipo === 'revisao' || msg.tipo === 'relatorio-pronto') {
        c.ocupado = false; c.msgs.push(msg);
        if (opts.depois) opts.depois();
        A.aposFala(alvo); return;
      }
      msg.tipo = 'agente';
      var total = msg.texto.join(' ').split(' ').length;
      msg._n = 0; c.msgs.push(msg); c.ocupado = false;
      var t = setInterval(function () {
        msg._n += 3;
        if (msg._n >= total) { clearInterval(t); delete msg._n; if (opts.depois) opts.depois(); A.aposFala(alvo); return; }
        if (opts.progresso) opts.progresso(msg._n / total);
        var cur = A.alvoAtual(); if (cur && cur.id === alvo.id) A.renderMsgs();
      }, 42);
    }, opts.espera || 700);
  };
  A.aposFala = function (alvo) {
    var cur = A.alvoAtual();
    if (!cur || cur.id !== alvo.id) { A.render(); return; }
    if (alvo.tipo === 'proto' && A.renderTrabalhoParcial) A.renderTrabalhoParcial(); else A.renderMsgs();
  };

  /* ---------------------------------------------------------------- */
  /* Roteiros: conversa dentro de um Protótipo                          */
  /* ---------------------------------------------------------------- */
  var LETRAS = 'ABCDEFGHIJ';
  A.flagsBase = function (proto) {
    if (proto.app === 'extrato') return { periodoLivre: true, exportar: true };
    if (proto.app === 'reserva') return { meta: true };
    if (proto.app === 'pix') return { avisoFalha: true, colarFix: true };
    return { timeline: true, notificacao: true, guiaConfirmar: true };
  };
  A.criarProposta = function (proto, titulo, flags) {
    var t = A.trab(proto);
    var usadas = proto.propostas.filter(function (p) { return p.id !== 'atual'; }).length;
    var letra = LETRAS.charAt(usadas);
    var nova = { id: letra.toLowerCase(), nome: 'Proposta ' + letra, titulo: titulo, estado: usadas === 0 ? 'ativa' : 'rascunho', resumo: titulo, flags: flags };
    proto.propostas.push(nova);
    t.proposta = nova.id; t.novaProposta = nova.id;
    A.addPonto(proto, nova.nome + ' criada', titulo);
    return nova;
  };
  A.addPonto = function (proto, titulo, detalhe) {
    var t = A.trab(proto), c = S.conversas[proto.id];
    var id = 'p' + (proto.pontos.length + 1) + '-' + String(Date.now()).slice(-4);
    proto.pontos.push({ id: id, quando: 'hoje, ' + A.agora(), titulo: titulo, detalhe: detalhe || '' });
    t.aqui = id; proto.atualizado = 'agora';
    for (var i = c.msgs.length - 1; i >= 0; i--) {
      var mm = c.msgs[i];
      if (mm.tipo === 'agente' || mm.tipo === 'revisao') { if (!mm.ponto) mm.ponto = titulo; break; }
    }
  };
  function propostaEditavel(proto, t) {
    var p = proto.propostas.filter(function (x) { return x.id === t.proposta; })[0];
    if (!p || p.id === 'atual' || p.estado === 'descartada') {
      var at = A.ativa(proto);
      if (at && at.id !== 'atual') { t.proposta = at.id; return at; }
    }
    return p;
  }
  A.respostaAtalho = function (proto, id) {
    var t = A.trab(proto), alvo = { tipo: 'proto', id: proto.id };
    var tela = DS.protos.nomeTela(t.tela);
    var nomeProp = (proto.propostas.filter(function (x) { return x.id === t.proposta; })[0] || {}).nome || 'Proposta';
    if (id === 'critique') {
      var achados = proto.app === 'remessa'
        ? [{ gravidade: 'resolvido', texto: 'Visibilidade do status: o estorno aparece com motivo e próximo passo.' }, { gravidade: 'alto', texto: 'Prevenção de erros: o IBAN só é validado depois do envio, a causa mais comum de estorno nas ligações.' }, { gravidade: 'medio', texto: 'Linguagem: “Em processamento” continua vago nas etapas antes do estorno.' }]
        : proto.app === 'extrato'
          ? [{ gravidade: 'resolvido', texto: 'Controle do usuário: o período é escolhido pelo cliente, até 5 anos.' }, { gravidade: 'medio', texto: 'Reconhecimento: o período atual não aparece na lista depois de aplicado.' }, { gravidade: 'baixo', texto: 'Eficiência: falta um atalho para o último período usado.' }]
          : [{ gravidade: 'medio', texto: 'Clareza: o valor principal não diz em que moeda está.' }, { gravidade: 'baixo', texto: 'Feedback: falta confirmação depois de uma ação concluída.' }];
      A.agenteFala(alvo, { tipo: 'revisao', titulo: 'Revisão de usabilidade · ' + nomeProp, achados: achados, sugestoes: proto.app === 'remessa' ? ['Validar o IBAN ao digitar', 'Trocar “Em processamento” por etapas'] : ['Corrigir o achado de maior gravidade'] },
        { depois: function () { A.addPonto(proto, 'Revisão de usabilidade', achados.length + ' achados'); } });
      return;
    }
    if (id === 'audit') {
      A.agenteFala(alvo, { tipo: 'revisao', titulo: 'Checagem de acessibilidade · ' + nomeProp, achados: [
        { gravidade: 'resolvido', texto: 'Contraste: todos os textos da tela ' + tela + ' passam de 4,5:1.' },
        { gravidade: 'alto', texto: 'Leitor de tela: a mudança de status não é anunciada quando algo dá errado.' },
        { gravidade: 'medio', texto: 'Alvo de toque: o link dos termos tem 24 px de altura; o mínimo recomendado é 44 px.' },
      ], sugestoes: ['Anunciar a mudança de status', 'Aumentar a área do link'] }, { depois: function () { A.addPonto(proto, 'Checagem de acessibilidade', '3 achados'); } });
      return;
    }
    if (id === 'nova') {
      var titulo = proto.app === 'extrato' ? 'Busca por valor e loja' : proto.app === 'reserva' ? 'Cofre por moeda' : proto.app === 'pix' ? 'Lembrete na véspera' : 'Rastreio com prazo previsto';
      A.agenteFala(alvo, { texto: ['Criei uma nova Proposta com outra abordagem para as mesmas Dores: ' + titulo.toLowerCase() + '. A Proposta ativa continua a mesma até você decidir.'], acoes: ['Criou uma nova Proposta', 'Conferiu o Protótipo: abre sem erros'] },
        { depois: function () { var f = proto.app === 'remessa' ? { rastreio: true, guiaConfirmar: true } : A.flagsBase(proto); A.criarProposta(proto, titulo, f); } });
      return;
    }
    var roteiros = {
      clarify: { t: 'Reescrevi 3 textos na tela ' + tela + ': o título diz o que aconteceu, o botão diz o que faz e a mensagem de erro diz como resolver.', a: ['Editou 3 textos da tela ' + tela], p: 'Textos mais claros' },
      distill: { t: 'Tirei 2 elementos da tela ' + tela + ' que não ajudavam a tarefa principal. A ação mais importante subiu.', a: ['Removeu 2 elementos da tela ' + tela], p: 'Tela simplificada' },
      polish: { t: 'Ajustei espaçamentos, alinhamentos e o ritmo entre os blocos da tela ' + tela + '. Nada mudou de lugar.', a: ['Ajustou espaçamentos da tela ' + tela], p: 'Acabamento final' },
      adapt: { t: 'Criei a versão para telas grandes: no desktop as informações ganham respiro e as ações continuam no mesmo lugar. Troquei o canvas para Desktop.', a: ['Adaptou ' + proto.telas.length + ' telas para desktop'], p: 'Versão para desktop', antes: function () { t.device = 'desktop'; } },
      onboard: { t: 'Desenhei o primeiro uso: uma explicação curta na primeira visita e um estado vazio que ensina o que fazer.', a: ['Criou o estado vazio', 'Criou a dica de primeiro uso'], p: 'Primeiro uso' },
    };
    var r = roteiros[id];
    if (!r) return;
    var ed = propostaEditavel(proto, t);
    A.agenteFala(alvo, { texto: [r.t], acoes: r.a.concat(['Conferiu o Protótipo: abre sem erros']), verNoCanvas: ed ? { proposta: ed.id, tela: t.tela } : null },
      { depois: function () { if (r.antes) r.antes(); t.destaque = { tela: t.tela, ate: Date.now() + 2600 }; A.addPonto(proto, r.p, (ed ? ed.nome : '') + ' · ' + tela); } });
  };
  A.respostaLivreProto = function (proto, texto, extra) {
    extra = extra || {};
    var t = A.trab(proto), alvo = { tipo: 'proto', id: proto.id };
    var low = (texto || '').toLowerCase();
    if (extra.comentarios) {
      var n = extra.comentarios.length;
      A.agenteFala(alvo, { texto: ['Apliquei os ' + A.plural(n, 'comentário', 'comentários') + ' na ' + (A.ativa(proto) || {}).nome + ': ' + extra.comentarios.map(function (c) { return '“' + c.texto + '”'; }).join(', ') + '. Confira os pontos marcados no canvas.'], acoes: ['Editou ' + A.plural(n, 'ponto', 'pontos') + ' do Protótipo', 'Conferiu o Protótipo: abre sem erros'] },
        { depois: function () { (t.comentarios || []).forEach(function (c) { c.resolvido = true; }); t.destaque = { tela: t.tela, ate: Date.now() + 2600 }; A.addPonto(proto, 'Comentários aplicados', A.plural(n, 'comentário', 'comentários')); } });
      return;
    }
    var atalho = D.atalhos.filter(function (a) { return a.rotulo.toLowerCase() === low.trim(); })[0];
    if (atalho && atalho.id !== 'nova') { A.respostaAtalho(proto, atalho.id); return; }
    if (/criar proposta|nova proposta|outra proposta|primeira proposta/.test(low)) {
      if (!proto.propostas.some(function (p) { return p.id !== 'atual'; })) {
        A.agenteFala(alvo, { texto: ['Criei a Proposta A a partir das Dores ligadas. Ela já aparece no canvas, ao lado do Atual.'], acoes: ['Criou a Proposta A', 'Conferiu o Protótipo: abre sem erros'] },
          { depois: function () { A.criarProposta(proto, proto.app === 'remessa' ? 'Status que avisa' : proto.app === 'extrato' ? 'Período livre' : proto.app === 'pix' ? 'Aviso antes da falha' : 'Primeira versão', A.flagsBase(proto)); } });
      } else A.respostaAtalho(proto, 'nova');
      return;
    }
    if (/revis/.test(low) && /usabilidade/.test(low)) { A.respostaAtalho(proto, 'critique'); return; }
    var ed = propostaEditavel(proto, t);
    var resp;
    if (/iban/.test(low)) resp = { t: ['Coloquei a validação do IBAN enquanto o cliente digita: o campo mostra o país e avisa na hora se o número não fecha. É a causa de estorno das ligações VC-55120 e VC-54402.'], a: ['Editou o campo IBAN', 'Adicionou validação ao digitar'], p: 'Validação do IBAN' };
    else if (/etapa|processamento/.test(low)) resp = { t: ['Troquei “Em processamento” por etapas com nome: enviada, no banco intermediário, entregue. O cliente vê em que parada o dinheiro está.'], a: ['Editou o status da tela Acompanhar'], p: 'Etapas no lugar de “Em processamento”' };
    else if (/status|anunci/.test(low)) resp = { t: ['A mudança de status agora é anunciada para leitores de tela e o selo ganhou um rótulo completo.'], a: ['Editou o selo de status'], p: 'Status anunciado' };
    else resp = { t: ['Feito na ' + (ed ? ed.nome : 'Proposta') + ', tela ' + DS.protos.nomeTela(t.tela) + ': ' + texto.replace(/[.!?]+$/, '').replace(/^./, function (c) { return c.toLowerCase(); }) + '. Confira no canvas e me diga se quer outra abordagem.'], a: ['Editou a tela ' + DS.protos.nomeTela(t.tela)], p: 'Pedido: ' + (texto.length > 38 ? texto.slice(0, 38) + '…' : texto) };
    if (extra.anexos && extra.anexos.length) resp.t.unshift('Recebi ' + A.plural(extra.anexos.length, 'anexo', 'anexos') + ' e usei como Referência.');
    A.agenteFala(alvo, { texto: resp.t, acoes: resp.a.concat(['Conferiu o Protótipo: abre sem erros']), verNoCanvas: ed ? { proposta: ed.id, tela: t.tela } : null },
      { depois: function () { t.destaque = { tela: t.tela, ate: Date.now() + 2600 }; A.addPonto(proto, resp.p, (ed ? ed.nome : '') + ' · ' + DS.protos.nomeTela(t.tela)); } });
  };
  /* Criação de um Protótipo novo: o agente monta as telas aos poucos */
  A.bootProto = function (proto) {
    var t = A.trab(proto), alvo = { tipo: 'proto', id: proto.id };
    proto.recemCriado = false;
    var nomes = proto.telas.map(DS.protos.nomeTela);
    var d = proto.dores.length ? A.dor(proto.dores[0]) : null;
    var nAnexos = (proto.referencias || []).length;
    t.criando = { etapa: 0 };
    var abertura = proto.tipo === 'novo'
      ? ['Li o seu pedido' + (nAnexos ? ' e ' + A.plural(nAnexos, 'anexo', 'anexos') : '') + '. Vou montar a primeira versão com a tarefa principal no centro da tela.']
      : [d ? 'Li a Dor “' + d.titulo + '” e as Evidências dela. Vou recriar a tela de hoje e, ao lado, propor a primeira melhoria.' : 'Vou recriar a tela de hoje de ' + A.produto(proto.produto).nome + ' e propor a primeira melhoria.',
        nAnexos ? 'Uso ' + A.plural(nAnexos, 'anexo', 'anexos') + ' como Referência do Atual.' : 'Sem prints anexados, monto o Atual com as telas que já conheço de ' + A.produto(proto.produto).nome + '.'];
    A.agenteFala(alvo, { texto: abertura }, { espera: 600, depois: function () {
      var passo = 0;
      var tick = setInterval(function () {
        passo += 1;
        t.criando = { etapa: passo };
        if (A.renderCanvas) A.renderCanvas();
        if (passo >= nomes.length + 1) {
          clearInterval(tick);
          if (proto.tipo !== 'novo') A.addPonto(proto, 'Atual recriado', nomes.join(', '));
          var titulo = proto.app === 'remessa' ? 'Status que avisa' : proto.app === 'extrato' ? 'Período livre' : proto.app === 'pix' ? 'Aviso antes da falha' : 'Primeira versão';
          A.agenteFala(alvo, {
            texto: [proto.tipo === 'novo' ? 'Pronto: a Proposta A está no canvas, com ' + A.plural(nomes.length, 'tela', 'telas') + '.' : 'Pronto. À esquerda do canvas está o Atual (' + nomes.join(', ') + '); à direita, a Proposta A: ' + titulo.toLowerCase() + '.',
              'Clique em Testar para navegar como cliente, em Comentar para marcar pontos na tela, ou em Editar para escolher um elemento e ver Variantes.'],
            acoes: [proto.tipo === 'novo' ? 'Criou ' + A.plural(nomes.length, 'tela', 'telas') : 'Recriou ' + A.plural(nomes.length, 'tela', 'telas') + ' do app atual', 'Criou a Proposta A', 'Conferiu o Protótipo: abre sem erros'],
            sugestoes: ['Revisar usabilidade', 'Checar acessibilidade', 'Nova Proposta'],
          }, { espera: 400, depois: function () { t.criando = null; A.criarProposta(proto, titulo, A.flagsBase(proto)); } });
        }
      }, 900);
    } });
  };

  /* ---------------------------------------------------------------- */
  /* Roteiros: conversa sem Protótipo (dados e fluxo guiado)            */
  /* ---------------------------------------------------------------- */
  function qtd(n) { return A.plural(n, 'Dor', 'Dores'); }
  A.respostaLivre = function (conv, texto, extra) {
    extra = extra || {};
    var p = A.produto(conv.produto), g = S.gerados[p.id] || {}, alvo = { tipo: 'livre', id: conv.id };
    var dores = D.dores.filter(function (d) { return d.produto === p.id && g[d.fonte]; });
    var low = (texto || '').toLowerCase();
    if (extra.escolha && /^fonte:/.test(extra.escolha)) { gerarNoChat(conv, extra.escolha.split(':')[1]); return; }
    if (!dores.length || /relat[óo]rio|gerar|começar|primeiro/.test(low) && !g.likert) {
      var opcoes = A.FONTES.filter(function (f) { return !g[f]; }).map(function (f) {
        var r = A.relatorio(p.id, f), fo = A.fonte(f);
        return { valor: 'fonte:' + f, texto: 'Começar pelo ' + fo.nome, rotulo: fo.nome, nota: r ? fmt(r.volume) + ' ' + fo.unidade + ' no período' : fo.descricao, ic: f };
      });
      A.agenteFala(alvo, { texto: [dores.length ? 'Posso gerar mais um Relatório de Fonte para ' + p.nome + '.' : 'Ainda não há Relatórios de Fonte para ' + p.nome + '. Vamos gerar o primeiro: eu leio os dados do período, agrupo por tema e ranqueio as Dores.', 'Por qual Fonte quer começar?'], escolhas: opcoes });
      return;
    }
    var porEstacao = {};
    dores.forEach(function (d) { (porEstacao[d.estacao] = porEstacao[d.estacao] || []).push(d); });
    var quente = Object.keys(porEstacao).sort(function (a, b) { return porEstacao[b].length - porEstacao[a].length; })[0];
    var qDores = porEstacao[quente], qNome = A.estacao(p.id, quente).nome;
    var mDor = /“(.+)”/.exec(texto || '');
    if (mDor) {
      var alvoDor = D.dores.filter(function (d) { return d.titulo === mDor[1]; })[0];
      if (alvoDor) {
        var mesma = dores.filter(function (d) { return d.estacao === alvoDor.estacao && d.id !== alvoDor.id; });
        A.agenteFala(alvo, { texto: [alvoDor.resumo, 'Ela aparece com ' + A.volumeTxt(alvoDor) + ' em ' + A.fonte(alvoDor.fonte).nome + (alvoDor.tendencia > 0 ? ' e cresceu ' + alvoDor.tendencia + '% no período' : '') + '.' + (mesma.length ? ' Na mesma tela, ' + qtd(mesma.length) + ' de outras Fontes reforçam o problema.' : ''), 'Eu começaria mostrando o que aconteceu e o que fazer, no momento em que acontece, na tela ' + A.estacao(p.id, alvoDor.estacao).nome + '.'],
          citaDores: [alvoDor.id].concat(mesma.slice(0, 2).map(function (d) { return d.id; })), criar: { dores: [alvoDor.id].concat(mesma.slice(0, 2).map(function (d) { return d.id; })) } });
        return;
      }
    }
    if (/cresc/.test(low)) {
      var top = dores.slice().sort(function (a, b) { return b.tendencia - a.tendencia; }).slice(0, 3);
      A.agenteFala(alvo, { texto: ['As três Dores que mais cresceram em ' + p.nome + ' nos últimos 90 dias:', top.map(function (d) { return d.titulo + ' (+' + d.tendencia + '%, ' + A.fonte(d.fonte).nome + ')'; }).join('; ') + '.'], citaDores: top.map(function (d) { return d.id; }), criar: { dores: top.map(function (d) { return d.id; }) } });
      return;
    }
    if (/voz/.test(low) && g.voz) {
      var rel = A.relatorio(p.id, 'voz');
      A.agenteFala(alvo, { texto: rel.narrativa.slice(0, 2), citaDores: A.doresDe(p.id, 'voz').slice(0, 2).map(function (d) { return d.id; }) });
      return;
    }
    if (/compar|fontes|repet/.test(low)) {
      var fs = qDores.reduce(function (acc, d) { if (acc.indexOf(d.fonte) < 0) acc.push(d.fonte); return acc; }, []);
      A.agenteFala(alvo, { texto: ['As Fontes concordam num ponto: a tela ' + qNome + ' concentra ' + qtd(qDores.length) + ', vindas de ' + A.plural(fs.length, 'Fonte', 'Fontes') + '.', 'O Likert diz o que o cliente sente, a Voz do Cliente diz o que ele não conseguiu resolver sozinho e o FullStory mostra onde ele travou na tela.'],
        citaDores: qDores.slice(0, 4).map(function (d) { return d.id; }), criar: { dores: qDores.slice(0, 3).map(function (d) { return d.id; }) } });
      return;
    }
    if (/primeiro|começ|prioridade|qual/.test(low)) {
      A.agenteFala(alvo, { texto: ['Eu começaria pela tela ' + qNome + ': ' + qtd(qDores.length) + ', ' + qDores.filter(function (d) { return d.impacto === 'alto'; }).length + ' com impacto alto.', 'Um Protótipo que recria a tela ' + qNome + ' e ataca as Dores de impacto alto juntas deve render o teste com clientes mais claro.'],
        citaDores: qDores.slice(0, 3).map(function (d) { return d.id; }), criar: { dores: qDores.filter(function (d) { return d.impacto === 'alto'; }).slice(0, 3).map(function (d) { return d.id; }) } });
      return;
    }
    var top3 = dores.slice().sort(function (a, b) { return A.ordemImpacto[a.impacto] - A.ordemImpacto[b.impacto] || b.volume - a.volume; }).slice(0, 3);
    A.agenteFala(alvo, { texto: ['Olhei os Relatórios de ' + p.nome + '. As Dores com mais peso agora são: ' + top3.map(function (d) { return d.titulo; }).join('; ') + '.', 'Quer que eu detalhe alguma delas ou crie um Protótipo?'], citaDores: top3.map(function (d) { return d.id; }), criar: { dores: top3.map(function (d) { return d.id; }) } });
  };
  function gerarNoChat(conv, fonte) {
    var alvo = { tipo: 'livre', id: conv.id }, p = A.produto(conv.produto), fo = A.fonte(fonte), rel = A.relatorio(p.id, fonte);
    var quem = A.agenteAtual(alvo);
    var msg = { tipo: 'progresso', titulo: 'Gerando o Relatório de ' + fo.nome + ' de ' + p.nome, passo: 0, volume: rel ? fmt(rel.volume) + ' ' + fo.unidade : '', agente: quem.agente, modelo: quem.modelo, quando: A.agora() };
    conv.msgs.push(msg); A.renderMsgs();
    var t = setInterval(function () {
      msg.passo += 1;
      if (msg.passo >= 4) {
        clearInterval(t);
        S.gerados[p.id] = S.gerados[p.id] || {}; S.gerados[p.id][fonte] = true;
        conv.msgs.push({ tipo: 'relatorio-pronto', rel: rel.id, texto: 'Pronto. ' + rel.destaque.charAt(0).toUpperCase() + rel.destaque.slice(1) + '. Estas são as Dores que mais pesam:', agente: quem.agente, modelo: quem.modelo, quando: A.agora() });
        A.render();
        A.toast('Relatório de ' + fo.nome + ' pronto');
        return;
      }
      A.renderMsgs();
    }, 850);
  }
})();
