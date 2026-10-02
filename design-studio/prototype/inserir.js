/* Design Studio — Inserir (modo ao vivo): o que o agente cria num ponto
   novo de uma tela da Proposta. Cada tipo tem Variantes escritas no visual
   das telas do Protótipo (tokens do IDS em proto.css) e com o texto do
   contexto de cada app. Como no impeccable live, o pedido em texto livre
   é obrigatório; o tipo sai do pedido. */
(function () {
  'use strict';
  var A = DS.app, esc = A.esc;
  function ic(n) { return DS.protos.ic(n); }

  var TIPOS = {
    aviso: { nome: 'Aviso', rotulo: 'Aviso inserido', variantes: [
      { n: 1, nome: 'Informativo', nota: 'Fundo neutro e ícone de informação: explica sem alarmar.' },
      { n: 2, nome: 'Com ação', nota: 'Diz o que aconteceu e leva direto para resolver.' },
      { n: 3, nome: 'Alerta', nota: 'O amarelo de alerta do IDS, para o que pede atenção agora.' },
      { n: 4, nome: 'Erro', nota: 'O vermelho de erro do IDS, para quando algo deu errado.' },
    ] },
    ajuda: { nome: 'Texto de ajuda', rotulo: 'Texto de ajuda inserido', variantes: [
      { n: 1, nome: 'Com ícone', nota: 'Uma linha de ajuda junto do ponto da dúvida.' },
      { n: 2, nome: 'Saiba mais', nota: 'Fica recolhido; quem precisa abre.' },
      { n: 3, nome: 'Em destaque', nota: 'Um card próprio, para explicações que o cliente não pode perder.' },
    ] },
    botao: { nome: 'Botão', rotulo: 'Botão inserido', variantes: [
      { n: 1, nome: 'Secundário', nota: 'Contorno azul-marinho do IDS: não compete com a ação principal.' },
      { n: 2, nome: 'Link com seta', nota: 'O mais discreto: um caminho a mais, sem peso de botão.' },
      { n: 3, nome: 'Par de ações', nota: 'Ação principal em laranja e a alternativa logo abaixo.' },
      { n: 4, nome: 'Primário', nota: 'Laranja do IDS: use só se esta for a ação mais importante da tela.' },
    ] },
    campo: { nome: 'Campo', rotulo: 'Campo inserido', variantes: [
      { n: 1, nome: 'Simples', nota: 'Rótulo e linha, no padrão de campo do IDS.' },
      { n: 2, nome: 'Com ajuda', nota: 'Uma dica embaixo responde a dúvida antes do erro.' },
      { n: 3, nome: 'Validado ao digitar', nota: 'Confirma na hora que o dado está certo.' },
    ] },
    etapas: { nome: 'Etapas', rotulo: 'Etapas inseridas', variantes: [
      { n: 1, nome: 'Lista vertical', nota: 'Cada etapa numa linha, fácil de ler no celular.' },
      { n: 2, nome: 'Trilho horizontal', nota: 'As etapas lado a lado, ocupando pouca altura.' },
      { n: 3, nome: 'Com progresso', nota: 'Mostra o que já foi feito e o que falta.' },
    ] },
    resumo: { nome: 'Resumo', rotulo: 'Resumo inserido', variantes: [
      { n: 1, nome: 'Card neutro', nota: 'O número no card padrão, sem roubar a cena.' },
      { n: 2, nome: 'Número em destaque', nota: 'O valor grande, para ser a primeira coisa lida.' },
      { n: 3, nome: 'Marca', nota: 'Fundo azul-marinho do IDS, para o resumo principal da tela.' },
    ] },
  };
  var TEXTO = {
    remessa: {
      aviso: ['Sua remessa voltou para a conta', 'O banco do beneficiário recusou o IBAN. Corrija os dados para reenviar.', 'Corrigir agora'],
      ajuda: ['O que é o IBAN?', 'É o número internacional da conta do beneficiário. Peça o código completo, com as letras do país.'],
      botao: ['Ver detalhes do envio', 'Falar com especialista'],
      campo: ['IBAN do beneficiário', 'US64 BOFA 0260 0959 3810 22', 'As duas primeiras letras indicam o país.', 'Formato válido para Estados Unidos'],
      etapas: ['Como funciona a remessa', 'Remessa enviada', 'No banco intermediário', 'Entregue ao beneficiário'],
      resumo: ['Total debitado', 'R$ 2.740,13', 'Chega em até 2 dias úteis'],
    },
    extrato: {
      aviso: ['Agora você vê até 5 anos', 'Escolha qualquer período e baixe os comprovantes direto da lista.', 'Escolher período'],
      ajuda: ['Saldo do dia e saldo disponível', 'O saldo do dia mostra o que entrou e saiu hoje; o disponível inclui o limite da conta.'],
      botao: ['Exportar período em PDF', 'Buscar lançamento'],
      campo: ['Buscar lançamento', 'Mercado', 'Busque por nome da loja ou por valor.', '12 lançamentos encontrados'],
      etapas: ['Como baixar o extrato', 'Escolha o período', 'Confira os lançamentos', 'Exporte em PDF'],
      resumo: ['Saídas no período', 'R$ 12.480,32', 'Abril de 2026'],
    },
    reserva: {
      aviso: ['Cotação abaixo da sua média', 'O euro está a R$ 6,04, abaixo da média de R$ 6,12 das suas compras.', 'Comprar agora'],
      ajuda: ['Como calculamos a média', 'A cotação média considera todas as compras desta meta, pelo valor pago em reais.'],
      botao: ['Programar nova compra', 'Ver histórico de cotações'],
      campo: ['Valor por semana', '€ 180,00', 'Você pode mudar quando quiser.', 'Cabe na meta até 12 dez'],
      etapas: ['Como a reserva funciona', 'Defina o destino', 'Escolha o valor', 'Programe as compras'],
      resumo: ['Falta juntar', '€ 1.760', 'Em 10 semanas, até 12 dez'],
    },
    pix: {
      aviso: ['Falta saldo para o Pix de amanhã', 'O Pix agendado de R$ 850,00 para Imobiliária Sol pode não ser feito.', 'Adicionar dinheiro'],
      ajuda: ['Quando o Pix agendado é feito', 'Às 6h da data marcada, se houver saldo. Avisamos na véspera se faltar.'],
      botao: ['Adicionar dinheiro', 'Ver todos os agendados'],
      campo: ['Chave Pix', '(11) 98765-1234', 'Celular, CPF, e-mail ou chave aleatória.', 'Chave de Marina Lopes'],
      etapas: ['Como agendar um Pix', 'Escolha a chave', 'Informe o valor e a data', 'Confirme'],
      resumo: ['Agendados nesta semana', 'R$ 1.250,00', '3 Pix até domingo'],
    },
  };
  /* Onde a tela muda o contexto, o texto do aviso e da ajuda acompanha */
  var TEXTO_TELA = {
    'remessa.revisar': {
      aviso: ['Confira o IBAN antes de enviar', 'IBAN incompleto é a causa mais comum de remessa recusada. Confira as letras do país e todos os números.', 'Conferir IBAN'],
    },
    'remessa.confirmar': {
      aviso: ['Falta aceitar os termos', 'Para confirmar, aceite os termos da operação de câmbio logo acima.', 'Ir para os termos'],
      ajuda: ['Por que preciso aceitar os termos?', 'Toda operação de câmbio exige que você declare a finalidade do envio.'],
    },
    'extrato.periodo': {
      aviso: ['Até 5 anos de extrato', 'Escolha datas livres ou use os atalhos de mês, trimestre e ano.', 'Ver atalhos'],
    },
    'pix.colar': {
      aviso: ['Chave colada sem espaços', 'Tiramos os espaços e os traços da chave que você copiou de outro app.', 'Ver de quem é a chave'],
      ajuda: ['Que chave posso usar?', 'Celular, CPF, e-mail ou chave aleatória. Colar já limpa a formatação.'],
    },
  };
  var SUGESTOES = [
    ['aviso', 'Aviso', 'Um aviso explicando o que aconteceu e o que fazer'],
    ['ajuda', 'Texto de ajuda', 'Um texto de ajuda para a dúvida mais comum aqui'],
    ['botao', 'Botão', 'Um botão para o próximo passo do cliente'],
    ['campo', 'Campo', 'Um campo para o cliente preencher'],
    ['etapas', 'Etapas', 'As etapas do processo, do começo ao fim'],
    ['resumo', 'Resumo', 'Um resumo com o valor total'],
  ];

  function tipoDoPedido(t) {
    t = (t || '').toLowerCase();
    /* a ordem importa: "um aviso explicando…" é aviso, "botão para o próximo passo" é botão */
    if (/aviso|alerta|avisar/.test(t)) return 'aviso';
    if (/bot[aã]o|cta|link/.test(t)) return 'botao';
    if (/campo|input|digit|preench|formul/.test(t)) return 'campo';
    if (/etapa|passo|progresso|linha do tempo|andamento/.test(t)) return 'etapas';
    if (/ajuda|explic|d[uú]vida|o que [eé]|dica/.test(t)) return 'ajuda';
    if (/resumo|total|saldo|valor|n[uú]mero/.test(t)) return 'resumo';
    return 'aviso';
  }
  function texto(app, tipo, tela) { var esp = TEXTO_TELA[app + '.' + tela]; return (esp && esp[tipo]) || (TEXTO[app] || TEXTO.remessa)[tipo]; }

  /* id: quando o elemento já foi aceito, vira um bloco editável (Editar) */
  function html(tipo, n, app, id, tela) {
    var c = texto(app, tipo, tela);
    var pick = id ? ' data-pick="' + id + '" data-pick-label="' + esc(TIPOS[tipo].rotulo) + '"' : '';
    if (tipo === 'aviso') {
      var cls = n === 3 ? 'alerta' : n === 4 ? 'erro' : 'info';
      return '<div class="pt-ins-aviso ' + cls + '"' + pick + ' role="status">' + ic(n >= 3 ? 'alert' : 'info') +
        '<div><strong>' + c[0] + '</strong><span>' + c[1] + '</span>' + (n === 2 || n === 4 ? '<button class="pt-link">' + c[2] + ic('arrow') + '</button>' : '') + '</div></div>';
    }
    if (tipo === 'ajuda') {
      if (n === 2) return '<details class="pt-ins-detalhe"' + pick + '><summary>' + ic('info') + c[0] + '</summary><p class="pt-muted">' + c[1] + '</p></details>';
      if (n === 3) return '<div class="pt-card"' + pick + '><p class="pt-h2">' + c[0] + '</p><p class="pt-muted">' + c[1] + '</p></div>';
      return '<p class="pt-ins-ajuda"' + pick + '>' + ic('info') + '<span><b>' + c[0] + '</b> ' + c[1] + '</span></p>';
    }
    if (tipo === 'botao') {
      if (n === 2) return '<button class="pt-link"' + pick + '>' + c[0] + ic('arrow') + '</button>';
      if (n === 3) return '<div class="pt-ins-acoes"' + pick + '><button class="pt-btn pt-btn-primary pt-btn-block">' + c[0] + '</button><button class="pt-btn pt-btn-ghost pt-btn-block">' + c[1] + '</button></div>';
      if (n === 4) return '<button class="pt-btn pt-btn-primary pt-btn-block"' + pick + '>' + c[0] + '</button>';
      return '<button class="pt-btn pt-btn-ghost pt-btn-block"' + pick + '>' + c[0] + '</button>';
    }
    if (tipo === 'campo') {
      return '<div class="pt-ins-campo' + (n === 3 ? ' ok' : '') + '"' + pick + '>' + c[0] + '<span class="v">' + c[1] + '</span>' +
        (n === 2 ? '<span>' + c[2] + '</span>' : n === 3 ? '<em>' + c[3] + '</em>' : '') + '</div>';
    }
    if (tipo === 'etapas') {
      var itens = c.slice(1).map(function (e, i) { return '<li' + (n === 3 && i === 0 ? ' class="feita"' : '') + '>' + e + '</li>'; }).join('');
      return '<div class="pt-card"' + pick + '><p class="pt-h2">' + c[0] + '</p><ol class="pt-ins-etapas' + (n === 2 ? ' trilho' : '') + '">' + itens + '</ol></div>';
    }
    return '<div class="pt-card pt-ins-resumo' + (n === 3 ? ' marca' : '') + '"' + pick + '><span class="pt-muted">' + c[0] + '</span><strong class="' + (n === 1 ? 'pt-big' : 'pt-huge') + '">' + c[1] + '</strong><span class="pt-muted">' + c[2] + '</span></div>';
  }

  A.inserir = {
    TIPOS: TIPOS,
    SUGESTOES: SUGESTOES,
    tipoDoPedido: tipoDoPedido,
    html: html,
    variantes: function (tipo, qtd) { return TIPOS[tipo].variantes.slice(0, qtd); },
  };
})();
