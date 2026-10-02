/* Design Studio — os Protótipos que rodam no palco.
   Cada Protótipo é um app bancário fictício (visual livre, sem marca real),
   desenhado em HTML. As flags de cada Proposta mudam o que a tela mostra. */
window.DS = window.DS || {};

(function () {
  var I = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.8v.4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 8v5"/><path d="M12 16.5v.5"/><path d="M10.3 3.9L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
    cart: '<path d="M4 5h2l2 10h10l2-7H7"/><circle cx="10" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
    pix: '<path d="M12 3l4 4-4 4-4-4z"/><path d="M12 13l4 4-4 4-4-4z"/><path d="M3 12l4-4 4 4-4 4zM13 12l4-4 4 4-4 4z"/>',
    plane: '<path d="M2.5 13.5l19-8-6.5 15-3-6.5z"/><path d="M12 14l3.5-3.5"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 11L12 15.5 16.5 11"/><path d="M5 20h14"/>',
    phone: '<path d="M6 3h4l1.5 4.5-2.5 1.5a11 11 0 0 0 6 6l1.5-2.5L21 14v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
    swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
    card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  };
  function ic(name, cls) {
    return '<svg class="pt-ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (I[name] || '') + '</svg>';
  }
  function pick(id, label) {
    return ' data-pick="' + id + '" data-pick-label="' + label.replace(/"/g, '&quot;') + '"';
  }
  function bar(title, backTo) {
    return '<header class="pt-bar">' +
      (backTo ? '<button class="pt-iconbtn" data-goto="' + backTo + '" aria-label="Voltar">' + ic('back') + '</button>' : '<span class="pt-iconbtn" aria-hidden="true"></span>') +
      '<h1 class="pt-bar-title">' + title + '</h1>' +
      '<span class="pt-iconbtn" aria-hidden="true"></span></header>';
  }
  function status() {
    return '<div class="pt-status" aria-hidden="true"><span>9:41</span><span class="pt-status-icons"><i></i><i></i><i></i></span></div>';
  }

  /* ---------------------------------------------------------------- */
  /* Câmbio · Remessa                                                   */
  /* ---------------------------------------------------------------- */
  function remessaRevisar(f, st) {
    return status() + bar('Revisar envio', null) +
      '<main class="pt-body">' +
      '<section class="pt-card pt-amount"' + pick('resumo-valores', 'Resumo de valores') + '>' +
        '<div class="pt-amount-row"><span class="pt-label">Você envia</span><strong class="pt-big">R$ 2.740,13</strong></div>' +
        '<div class="pt-amount-rate">' + ic('swap') + '<span>1 USD = R$ 5,42</span></div>' +
        '<div class="pt-amount-row"><span class="pt-label">Ana Souza recebe</span><strong class="pt-big">US$ 500,00</strong></div>' +
      '</section>' +
      '<section class="pt-card"' + pick('taxas', 'Tabela “Taxas e impostos”') + '>' +
        '<h2 class="pt-h2">Taxas e impostos</h2>' +
        '<dl class="pt-dl"><div><dt>Valor convertido</dt><dd>R$ 2.710,00</dd></div><div><dt>IOF (1,1%)</dt><dd>R$ 29,81</dd></div><div><dt>Tarifa de envio</dt><dd>R$ 0,32</dd></div><div class="pt-dl-total"><dt>Total debitado</dt><dd>R$ 2.740,13</dd></div></dl>' +
      '</section>' +
      '<section class="pt-card pt-benef"' + pick('beneficiario', 'Bloco “Beneficiário”') + '>' +
        '<div class="pt-avatar">AS</div><div><strong>Ana Souza</strong><span class="pt-muted">Bank of America · Nova York</span><span class="pt-muted pt-mono">US64 BOFA 0260 0959 3810 22</span></div>' +
      '</section>' +
      '</main>' +
      '<footer class="pt-foot"><button class="pt-btn pt-btn-primary pt-btn-block" data-goto="confirmar"' + pick('btn-continuar', 'Botão “Continuar”') + '>Continuar</button></footer>';
  }

  function remessaConfirmar(f, st) {
    var accepted = !!st.termos;
    var variant = st.variante && st.variante['btn-confirmar'];
    var guide = f.guiaConfirmar || variant === 2;
    var cta;
    if (variant === 1) {
      cta = '<p class="pt-hint">' + ic('alert') + (accepted ? 'Tudo pronto para confirmar.' : 'Aceite os termos acima para confirmar.') + '</p>' +
        '<button class="pt-btn pt-btn-primary pt-btn-block" ' + (accepted ? 'data-goto="acompanhar"' : 'disabled') + pick('btn-confirmar', 'Botão “Confirmar remessa”') + '>Confirmar remessa</button>';
    } else if (variant === 3) {
      cta = '<div class="pt-checklist"' + pick('btn-confirmar', 'Botão “Confirmar remessa”') + '>' +
        '<p class="pt-checklist-head">' + (accepted ? '3 de 3 itens prontos' : '2 de 3 itens prontos') + '</p>' +
        '<ul><li class="ok">' + ic('check') + 'Valor e cotação revisados</li><li class="ok">' + ic('check') + 'Beneficiário conferido</li><li class="' + (accepted ? 'ok' : 'todo') + '">' + (accepted ? ic('check') : '<span class="pt-dot"></span>') + 'Aceite dos termos</li></ul>' +
        '<button class="pt-btn pt-btn-primary pt-btn-block" ' + (accepted ? 'data-goto="acompanhar"' : 'data-act="guia"') + '>Confirmar remessa</button></div>';
    } else if (guide) {
      cta = (st.guia && !accepted ? '<p class="pt-hint pt-hint-warn" role="alert">' + ic('alert') + 'Para confirmar, aceite os termos da operação acima.</p>' : '') +
        '<button class="pt-btn pt-btn-primary pt-btn-block" ' + (accepted ? 'data-goto="acompanhar"' : 'data-act="guia"') + pick('btn-confirmar', 'Botão “Confirmar remessa”') + '>Confirmar remessa</button>';
    } else {
      cta = '<button class="pt-btn pt-btn-primary pt-btn-block" ' + (accepted ? 'data-goto="acompanhar"' : 'disabled') + pick('btn-confirmar', 'Botão “Confirmar remessa”') + '>Confirmar remessa</button>';
    }
    return status() + bar('Confirmar remessa', 'revisar') +
      '<main class="pt-body">' +
      '<section class="pt-card pt-summary"' + pick('resumo-confirmar', 'Resumo da remessa') + '>' +
        '<div class="pt-summary-top">' + ic('globe') + '<div><span class="pt-label">Para Ana Souza</span><strong class="pt-big">US$ 500,00</strong></div></div>' +
        '<dl class="pt-dl"><div><dt>Total debitado</dt><dd>R$ 2.740,13</dd></div><div><dt>Cotação</dt><dd>R$ 5,42</dd></div><div><dt>Chega em</dt><dd>até 2 dias úteis</dd></div></dl>' +
      '</section>' +
      '<label class="pt-terms' + (st.guia && !accepted ? ' is-flagged' : '') + '"' + pick('termos', 'Caixa “Aceito os termos”') + '>' +
        '<input type="checkbox" data-act="termos"' + (accepted ? ' checked' : '') + '>' +
        '<span>Li e aceito os <u>termos da operação de câmbio</u> e declaro que o envio é para manutenção de residente no exterior.</span>' +
      '</label>' +
      '</main>' +
      '<footer class="pt-foot">' + cta + '</footer>';
  }

  function remessaAcompanhar(f, st) {
    var variant = st.variante && st.variante['status-card'];
    var notif = f.notificacao && st.notif !== false
      ? '<div class="pt-push" role="status" data-act="notif" title="Toque para dispensar"' + pick('notificacao', 'Notificação de estorno') + '><span class="pt-push-app">' + ic('bell') + 'Seu banco · agora</span><strong>Sua remessa voltou para a conta</strong><span>O banco da Ana recusou o IBAN. Toque para corrigir e reenviar.</span></div>'
      : '';
    var banner = f.faixa ? '<div class="pt-banner"' + pick('faixa', 'Faixa de aviso') + '>' + ic('alert') + '<span>Sua remessa foi estornada. Toque para saber mais.</span></div>' : '';
    var body;
    if (variant === 2 || (f.timeline && !variant)) {
      body =
        '<section class="pt-card"' + pick('status-card', 'Status da remessa') + '>' +
          '<div class="pt-status-head"><strong class="pt-big">US$ 500,00</strong><span class="pt-chip pt-chip-danger">Estornada</span></div>' +
          '<ol class="pt-timeline">' +
            '<li class="done"><span class="pt-tl-dot">' + ic('check') + '</span><div><strong>Remessa enviada</strong><span class="pt-muted">22 set, 10:14</span></div></li>' +
            '<li class="done"><span class="pt-tl-dot">' + ic('check') + '</span><div><strong>Recebida pelo banco intermediário</strong><span class="pt-muted">22 set, 16:40 · Nova York</span></div></li>' +
            '<li class="bad"><span class="pt-tl-dot">' + ic('undo') + '</span><div><strong>Estornada para a sua conta</strong><span class="pt-muted">23 set, 09:02</span>' +
              '<p class="pt-reason"><b>Motivo:</b> o banco do beneficiário recusou o IBAN informado. Os R$ 2.740,13 já estão de volta na sua conta.</p></div></li>' +
          '</ol>' +
        '</section>' +
        '<div class="pt-actions"><button class="pt-btn pt-btn-primary pt-btn-block"' + pick('btn-corrigir', 'Botão “Corrigir dados e reenviar”') + '>Corrigir dados e reenviar</button>' +
        '<button class="pt-btn pt-btn-ghost pt-btn-block">' + ic('phone') + 'Falar com a gente</button></div>';
    } else if (f.rastreio || variant === 3) {
      body =
        '<section class="pt-card"' + pick('status-card', 'Status da remessa') + '>' +
          '<div class="pt-status-head"><strong class="pt-big">US$ 500,00</strong><span class="pt-chip pt-chip-danger">Voltou para você</span></div>' +
          '<div class="pt-route">' +
            '<div class="pt-stop done"><span>' + ic('bank') + '</span><strong>Seu banco</strong><em>22 set</em></div>' +
            '<div class="pt-leg done"></div>' +
            '<div class="pt-stop done"><span>' + ic('globe') + '</span><strong>Intermediário</strong><em>Nova York</em></div>' +
            '<div class="pt-leg bad"></div>' +
            '<div class="pt-stop bad"><span>' + ic('alert') + '</span><strong>Bank of America</strong><em>recusou</em></div>' +
          '</div>' +
          '<p class="pt-reason"><b>O dinheiro voltou em 23 set.</b> O Bank of America não aceitou o IBAN. Corrija o número e envie de novo, com a cotação do momento.</p>' +
        '</section>' +
        '<div class="pt-actions"><button class="pt-btn pt-btn-primary pt-btn-block"' + pick('btn-corrigir', 'Botão “Corrigir dados e reenviar”') + '>Corrigir IBAN e reenviar</button></div>';
    } else if (variant === 1) {
      body =
        '<section class="pt-card pt-card-alert"' + pick('status-card', 'Status da remessa') + '>' +
          '<span class="pt-chip pt-chip-danger">Estornada em 23 set</span>' +
          '<strong class="pt-big">Os US$ 500,00 não chegaram</strong>' +
          '<p>O banco da Ana recusou o IBAN. O valor de R$ 2.740,13 voltou para a sua conta.</p>' +
          '<button class="pt-btn pt-btn-primary pt-btn-block">Corrigir dados e reenviar</button>' +
        '</section>';
    } else {
      body =
        '<section class="pt-card"' + pick('status-card', 'Status da remessa') + '>' +
          '<div class="pt-status-head"><strong class="pt-big">US$ 500,00</strong>' +
          '<span class="pt-chip pt-chip-neutral" data-dead="1"' + pick('selo-status', 'Selo “Em processamento”') + '>Em processamento</span></div>' +
          '<dl class="pt-dl"><div><dt>Para</dt><dd>Ana Souza</dd></div><div><dt>Enviada em</dt><dd>22 set, 10:14</dd></div><div><dt>Prazo</dt><dd>até 2 dias úteis</dd></div></dl>' +
        '</section>' +
        '<p class="pt-muted pt-center">Dúvidas? Ligue para a central.</p>';
    }
    return notif + status() + bar('Acompanhar remessa', 'confirmar') + banner +
      '<main class="pt-body">' + body + '</main>';
  }

  /* ---------------------------------------------------------------- */
  /* Extrato                                                            */
  /* ---------------------------------------------------------------- */
  var lancs = {
    recentes: [
      { d: 'Hoje', itens: [['Mercado Bom Preço', 'Débito', '- R$ 184,90', 'cart'], ['Pix recebido · Marina L.', 'Pix', '+ R$ 120,00', 'pix']] },
      { d: 'Ontem', itens: [['PG *XPTO 3321', 'Crédito', '- R$ 89,00', 'card'], ['Conta de luz', 'Débito automático', '- R$ 212,37', 'bolt']] },
      { d: '27 set', itens: [['Salário', 'TED recebida', '+ R$ 6.480,00', 'bank'], ['Aluguel · Pix para Imobiliária Sol', 'Pix', '- R$ 2.300,00', 'pix']] },
    ],
    abril: [
      { d: '28 abr', itens: [['Condomínio Ed. Aurora · Pix', 'Pix', '- R$ 780,00', 'pix'], ['Farmácia Vida', 'Débito', '- R$ 64,20', 'cart']] },
      { d: '15 abr', itens: [['Escola Nova Era', 'Boleto', '- R$ 1.250,00', 'doc'], ['Pix recebido · João P.', 'Pix', '+ R$ 300,00', 'pix']] },
      { d: '5 abr', itens: [['Salário', 'TED recebida', '+ R$ 6.480,00', 'bank']] },
    ],
  };
  function lista(grupos, exportar) {
    return grupos.map(function (g) {
      return '<section class="pt-group"><h3 class="pt-group-h">' + g.d + '</h3><ul class="pt-list">' +
        g.itens.map(function (it, idx) {
          var pos = it[2].indexOf('+') === 0;
          return '<li' + (idx === 0 ? pick('lancamento', 'Linha de lançamento') : '') + '><span class="pt-lic">' + ic(it[3]) + '</span><span class="pt-lmain"><strong>' + it[0] + '</strong><span class="pt-muted">' + it[1] + '</span></span>' +
            '<span class="pt-lval' + (pos ? ' pos' : '') + '">' + it[2] + '</span>' +
            (exportar && it[1] === 'Pix' ? '<button class="pt-mini" aria-label="Baixar comprovante de ' + it[0] + '">' + ic('download') + '</button>' : '') + '</li>';
        }).join('') + '</ul></section>';
    }).join('');
  }
  function extratoExtrato(f, st) {
    var periodo = st.periodo || 'Últimos 90 dias';
    var abril = periodo === 'Abril de 2026';
    var chip;
    if (f.periodoLivre) {
      chip = '<button class="pt-period" data-goto="periodo"' + pick('periodo-chip', 'Seletor de período') + '>' + ic('calendar') + '<span>' + periodo + '</span>' + ic('down') + '</button>';
    } else if (f.meses) {
      var meses = ['Out', 'Set', 'Ago', 'Jul', 'Jun', 'Mai', 'Abr', 'Mar'];
      chip = '<div class="pt-months"' + pick('periodo-chip', 'Linha de meses') + '>' + meses.map(function (m, i) {
        var on = (abril && m === 'Abr') || (!abril && i === 0);
        return '<button class="pt-month' + (on ? ' on' : '') + '" data-act="mes" data-mes="' + m + '">' + m + '</button>';
      }).join('') + '<span class="pt-month-year">2026</span></div>';
    } else {
      chip = '<span class="pt-chip pt-chip-neutral pt-chip-period" data-dead="1"' + pick('periodo-chip', 'Rótulo “Últimos 90 dias”') + '>Últimos 90 dias</span>';
    }
    return status() + bar('Extrato', null) +
      '<main class="pt-body">' +
      '<section class="pt-balance"' + pick('saldo', 'Saldo disponível') + '><span class="pt-label">Saldo disponível</span><strong class="pt-huge">R$ 4.218,56</strong><span class="pt-muted">Saldo do dia R$ 4.032,10</span></section>' +
      '<div class="pt-toolbar">' + chip + '<button class="pt-iconbtn" aria-label="Buscar">' + ic('search') + '</button></div>' +
      lista(abril ? lancs.abril : lancs.recentes, f.exportar) +
      '<button class="pt-btn pt-btn-ghost pt-btn-block"' + pick('carregar-mais', 'Botão “Carregar mais”') + '>Carregar mais</button>' +
      '</main>';
  }
  function extratoPeriodo(f, st) {
    var opts = [['Este mês', 'Outubro de 2026'], ['Último trimestre', 'Jul a set de 2026'], ['Abril de 2026', 'Abril de 2026'], ['Ano passado', '2025 inteiro']];
    var sel = st.periodo || 'Últimos 90 dias';
    return status() + bar('Escolher período', 'extrato') +
      '<main class="pt-body">' +
      '<p class="pt-muted">Veja até 5 anos de extrato e baixe os comprovantes do período.</p>' +
      '<div class="pt-options"' + pick('atalhos-periodo', 'Atalhos de período') + '>' + opts.map(function (o) {
        return '<button class="pt-option' + (sel === o[1] ? ' on' : '') + '" data-act="periodo" data-valor="' + o[1] + '"><strong>' + o[0] + '</strong><span>' + o[1] + '</span>' + (sel === o[1] ? ic('check') : '') + '</button>';
      }).join('') + '</div>' +
      '<section class="pt-card"' + pick('datas-livres', 'Datas livres') + '><h2 class="pt-h2">Datas livres</h2>' +
        '<div class="pt-dates"><label><span>De</span><input type="text" value="01/04/2026" readonly></label><label><span>Até</span><input type="text" value="30/04/2026" readonly></label></div></section>' +
      '</main>' +
      '<footer class="pt-foot"><button class="pt-btn pt-btn-primary pt-btn-block" data-goto="extrato">Ver extrato do período</button></footer>';
  }

  /* ---------------------------------------------------------------- */
  /* Câmbio · Reserva (produto novo)                                    */
  /* ---------------------------------------------------------------- */
  function reservaMeta(f, st) {
    return status() + bar('Reserva de viagem', null) +
      '<main class="pt-body">' +
      '<section class="pt-goal"' + pick('meta', 'Cartão da meta') + '>' +
        '<div class="pt-goal-top">' + ic('plane') + '<div><strong>Lisboa</strong><span>Embarque em 12 dez 2026</span></div></div>' +
        '<div class="pt-goal-val"><strong>€ 1.240</strong><span>de € 3.000</span></div>' +
        '<div class="pt-progress" role="img" aria-label="41% da meta"><i style="width:41%"></i></div>' +
        '<dl class="pt-dl pt-dl-light"><div><dt>Cotação média</dt><dd>R$ 6,12</dd></div><div><dt>Faltam</dt><dd>€ 1.760 em 10 semanas</dd></div></dl>' +
      '</section>' +
      '<section class="pt-card"' + pick('programadas', 'Compras programadas') + '><h2 class="pt-h2">Compras programadas</h2>' +
        '<ul class="pt-list pt-list-plain"><li><span class="pt-lic">' + ic('calendar') + '</span><span class="pt-lmain"><strong>Toda sexta-feira</strong><span class="pt-muted">R$ 1.080,00 em euro</span></span><span class="pt-lval">Ativa</span></li></ul></section>' +
      '<section class="pt-card"' + pick('historico-compras', 'Histórico de compras') + '><h2 class="pt-h2">Últimas compras</h2>' +
        '<ul class="pt-list pt-list-plain"><li><span class="pt-lmain"><strong>€ 176,40</strong><span class="pt-muted">26 set · R$ 6,12</span></span></li><li><span class="pt-lmain"><strong>€ 178,10</strong><span class="pt-muted">19 set · R$ 6,06</span></span></li></ul></section>' +
      '</main>' +
      '<footer class="pt-foot"><button class="pt-btn pt-btn-primary pt-btn-block"' + pick('btn-comprar', 'Botão “Comprar agora”') + '>Comprar euro agora</button></footer>';
  }

  /* ---------------------------------------------------------------- */
  /* Pix                                                                */
  /* ---------------------------------------------------------------- */
  function pixAgendados(f, st) {
    var aviso = f.avisoFalha
      ? '<section class="pt-card pt-card-alert"' + pick('aviso-falha', 'Aviso de saldo insuficiente') + '>' +
          '<span class="pt-chip pt-chip-danger">Amanhã, dia 5</span>' +
          '<strong class="pt-big">Falta saldo para o aluguel</strong>' +
          '<p>O Pix de R$ 2.300,00 para a Imobiliária Sol está agendado para amanhã. Hoje faltam R$ 412,90.</p>' +
          '<div class="pt-actions"><button class="pt-btn pt-btn-primary pt-btn-block">Transferir da poupança</button><button class="pt-btn pt-btn-ghost pt-btn-block">Reagendar</button></div>' +
        '</section>' : '';
    var item = function (nome, desc, valor, estado, cls) {
      return '<li><span class="pt-lic">' + ic('pix') + '</span><span class="pt-lmain"><strong>' + nome + '</strong><span class="pt-muted">' + desc + '</span></span>' +
        '<span class="pt-lval' + (cls ? ' ' + cls : '') + '">' + valor + '</span>' + (estado || '') + '</li>';
    };
    var falhou = f.avisoFalha
      ? item('Condomínio Ed. Aurora', 'Não foi feito em 5 set: saldo insuficiente', 'R$ 780,00', '<button class="pt-mini" aria-label="Fazer agora">' + ic('bolt') + '</button>')
      : item('Condomínio Ed. Aurora', 'Agendado para 5 set', 'R$ 780,00');
    return status() + bar('Pix agendados', null) +
      '<main class="pt-body">' + aviso +
      '<section class="pt-group"><h3 class="pt-group-h">Próximos</h3><ul class="pt-list"' + pick('lista-agendados', 'Lista de Pix agendados') + '>' +
        item('Aluguel · Imobiliária Sol', 'Todo dia 5 · próximo amanhã', 'R$ 2.300,00') +
        item('Escola Nova Era', 'Todo dia 10', 'R$ 1.250,00') +
      '</ul></section>' +
      '<section class="pt-group"><h3 class="pt-group-h">Anteriores</h3><ul class="pt-list">' + falhou + '</ul></section>' +
      '</main>' +
      '<footer class="pt-foot"><button class="pt-btn pt-btn-primary pt-btn-block"' + pick('btn-agendar', 'Botão “Agendar Pix”') + '>Agendar novo Pix</button></footer>';
  }
  function pixColar(f, st) {
    var colado = f.colarFix && st.colado;
    return status() + bar('Pix com chave', 'agendados') +
      '<main class="pt-body">' +
      '<section class="pt-card"' + pick('campo-chave', 'Campo “Chave Pix”') + '><h2 class="pt-h2">Para quem você quer enviar?</h2>' +
        '<div class="pt-dates" style="grid-template-columns:1fr auto;align-items:end"><label><span>Chave Pix</span><input type="text" value="' + (colado ? '(11) 98765-1234' : '') + '" placeholder="CPF, celular, e-mail ou chave aleatória" readonly></label>' +
        '<button class="pt-btn pt-btn-ghost"' + (f.colarFix ? ' data-act="colar"' : ' data-dead="1"') + pick('btn-colar', 'Botão “Colar”') + '>Colar</button></div>' +
        (colado ? '<div class="pt-benef" style="display:flex;gap:12px;align-items:center"><div class="pt-avatar">ML</div><div><strong>Marina Lopes</strong><span class="pt-muted">Celular · Banco Exemplo</span></div></div>' : '') +
      '</section>' +
      (f.colarFix && !colado ? '<p class="pt-muted pt-center">Copiou a chave de outro app? Toque em Colar: espaços e traços são removidos.</p>' : '') +
      '</main>' +
      '<footer class="pt-foot"><button class="pt-btn pt-btn-primary pt-btn-block"' + (colado ? '' : ' disabled') + '>Continuar</button></footer>';
  }

  var apps = {
    remessa: { revisar: remessaRevisar, confirmar: remessaConfirmar, acompanhar: remessaAcompanhar },
    extrato: { extrato: extratoExtrato, periodo: extratoPeriodo },
    reserva: { meta: reservaMeta },
    pix: { agendados: pixAgendados, colar: pixColar },
  };
  var nomesTela = {
    revisar: 'Revisar', confirmar: 'Confirmar', acompanhar: 'Acompanhar',
    extrato: 'Extrato', periodo: 'Período', meta: 'Meta', agendados: 'Agendados', colar: 'Colar chave',
  };

  DS.protos = {
    ic: ic,
    render: function (appId, tela, flags, st) {
      var a = apps[appId];
      if (!a || !a[tela]) return '<div class="pt-empty">Tela não encontrada</div>';
      return a[tela](flags || {}, st || {});
    },
    nomeTela: function (t) { return nomesTela[t] || t; },
    /* Variantes pré-escritas para os elementos mais comuns; os demais
       recebem variações genéricas de estilo. */
    variantes: {
      'btn-confirmar': [
        { n: 1, nome: 'Explicar acima do botão', nota: 'O botão segue desabilitado, com uma linha que diz o que falta.' },
        { n: 2, nome: 'Ativo, guia ao tocar', nota: 'O botão fica ativo; ao tocar sem aceite, a tela aponta a caixa de termos.' },
        { n: 3, nome: 'Checklist antes de confirmar', nota: 'Mostra os 3 itens da confirmação e quantos estão prontos.' },
      ],
      'status-card': [
        { n: 1, nome: 'Alerta direto', nota: 'Um cartão de alerta com o que aconteceu e um botão para resolver.' },
        { n: 2, nome: 'Linha do tempo', nota: 'O estorno vira um passo do status, com motivo e próximo passo.' },
        { n: 3, nome: 'Rastreio em paradas', nota: 'O caminho do dinheiro em três paradas, com a parada que recusou.' },
      ],
    },
  };
})();
