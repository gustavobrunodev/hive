/* Design Studio — dados de exemplo (sintéticos).
   Nada aqui vem de clientes reais. Produtos, Dores, Evidências, números e
   conversas foram escritos para demonstrar o fluxo do POC. */
window.DS = window.DS || {};

DS.data = {
  produtos: [
    {
      id: 'cambio',
      nome: 'Câmbio',
      descricao: 'Compra e envio de moeda estrangeira pelo app',
      periodo: '1 jul a 29 set 2026',
      estacoes: [
        { id: 'simular', nome: 'Simular' }, { id: 'revisar', nome: 'Revisar' }, { id: 'beneficiario', nome: 'Beneficiário' },
        { id: 'confirmar', nome: 'Confirmar' }, { id: 'acompanhar', nome: 'Acompanhar' }, { id: 'comprovante', nome: 'Comprovante' },
      ],
      linha: 'laranja',
    },
    {
      id: 'extrato',
      nome: 'Extrato',
      descricao: 'Extrato da conta corrente no app e no internet banking',
      periodo: '1 jul a 29 set 2026',
      estacoes: [
        { id: 'lista', nome: 'Extrato' }, { id: 'periodo', nome: 'Período' }, { id: 'busca', nome: 'Busca' },
        { id: 'detalhe', nome: 'Detalhe' }, { id: 'comprovante', nome: 'Comprovante' }, { id: 'exportar', nome: 'Exportar' },
      ],
      linha: 'azul',
    },
    {
      id: 'pix',
      nome: 'Pix',
      descricao: 'Transferências, agendamentos e chaves Pix',
      periodo: '1 jul a 29 set 2026',
      estacoes: [
        { id: 'area', nome: 'Área Pix' }, { id: 'colar', nome: 'Colar chave' }, { id: 'valor', nome: 'Valor' },
        { id: 'confirmar', nome: 'Confirmar' }, { id: 'agendados', nome: 'Agendados' }, { id: 'chaves', nome: 'Minhas chaves' },
      ],
      linha: 'amarela',
    },
  ],

  fontes: {
    likert: {
      id: 'likert',
      nome: 'Likert',
      descricao: 'Notas de 1 a 5 e comentários abertos deixados no app',
      unidade: 'respostas',
      unidadeDor: 'menções',
    },
    voz: {
      id: 'voz',
      nome: 'Voz do Cliente',
      descricao: 'Ligações em que clientes relatam dores a atendentes',
      unidade: 'ligações',
      unidadeDor: 'ligações',
    },
    fullstory: {
      id: 'fullstory',
      nome: 'FullStory',
      descricao: 'Comportamento real de navegação e sinais de frustração',
      unidade: 'sessões',
      unidadeDor: 'clientes afetados',
    },
  },

  /* ------------------------------------------------------------------ */
  /* Dores                                                                */
  /* ------------------------------------------------------------------ */
  dores: [
    /* ---------- Câmbio · Likert ---------- */
    {
      id: 'cam-l1', produto: 'cambio', fonte: 'likert', rank: 1,
      titulo: 'A cotação muda entre simular e confirmar',
      resumo: 'O cliente simula com uma taxa e encontra outra na confirmação, sem aviso de quanto tempo a cotação vale.',
      volume: 412, impacto: 'alto', tendencia: 22, estacao: 'confirmar', onde: 'Revisar → Confirmar',
      relacionadas: ['cam-v3'],
      evidencias: [
        { id: 'LK-20931', nota: 1, texto: 'Simulei a 5,42 e na hora de confirmar estava 5,49. Me senti enganado.', data: '12 set 2026', canal: 'App iOS', perfil: 'Pessoa física' },
        { id: 'LK-21408', nota: 2, texto: 'Não fica claro por quanto tempo a cotação vale. Demorei para achar os dados do beneficiário e perdi a taxa.', data: '18 set 2026', canal: 'App Android', perfil: 'Pessoa física' },
        { id: 'LK-19877', nota: 2, texto: 'Queria travar a taxa por alguns minutos enquanto preencho o resto.', data: '3 set 2026', canal: 'App iOS', perfil: 'Pessoa física' },
      ],
    },
    {
      id: 'cam-l2', produto: 'cambio', fonte: 'likert', rank: 2,
      titulo: 'Não sei quando o dinheiro chega lá fora',
      resumo: 'Depois de enviar, o cliente só vê “até 2 dias úteis” e não sabe em que etapa a remessa está.',
      volume: 338, impacto: 'alto', tendencia: 9, estacao: 'acompanhar', onde: 'Acompanhar',
      relacionadas: ['cam-v1', 'cam-f2'],
      evidencias: [
        { id: 'LK-21102', nota: 1, texto: 'Mandei para minha filha em Lisboa e não sei se já chegou. Tive que pedir para ela olhar o banco dela.', data: '15 set 2026', canal: 'App Android', perfil: 'Pessoa física' },
        { id: 'LK-20514', nota: 2, texto: 'Prazo “até 2 dias úteis” não ajuda. Quero ver onde o dinheiro está.', data: '9 set 2026', canal: 'App iOS', perfil: 'Pessoa física' },
      ],
    },
    {
      id: 'cam-l3', produto: 'cambio', fonte: 'likert', rank: 3,
      titulo: 'As taxas aparecem só no final',
      resumo: 'IOF e tarifa só ficam visíveis na última tela, depois que o cliente já decidiu o valor.',
      volume: 271, impacto: 'medio', tendencia: 4, estacao: 'revisar', onde: 'Revisar',
      relacionadas: ['cam-f5'],
      evidencias: [
        { id: 'LK-19650', nota: 2, texto: 'O IOF e a tarifa só aparecem na última tela. Tive que voltar e refazer a conta.', data: '1 set 2026', canal: 'App Android', perfil: 'Pessoa física' },
        { id: 'LK-20077', nota: 3, texto: 'Seria bom ver o valor total que sai da minha conta já na simulação.', data: '5 set 2026', canal: 'Internet banking', perfil: 'Pessoa física' },
      ],
    },
    {
      id: 'cam-l4', produto: 'cambio', fonte: 'likert', rank: 4,
      titulo: 'O cadastro do beneficiário é longo demais',
      resumo: 'SWIFT, IBAN e endereço completo em uma tela só; muita gente desiste no meio.',
      volume: 196, impacto: 'medio', tendencia: -3, estacao: 'beneficiario', onde: 'Beneficiário',
      relacionadas: ['cam-f3'],
      evidencias: [
        { id: 'LK-18912', nota: 1, texto: 'Pede SWIFT, IBAN, endereço... desisti na metade e fui pelo site.', data: '22 ago 2026', canal: 'App iOS', perfil: 'Pessoa física' },
        { id: 'LK-19533', nota: 2, texto: 'Não sei o que é IBAN e o app não explica.', data: '30 ago 2026', canal: 'App Android', perfil: 'Pessoa física' },
      ],
    },
    {
      id: 'cam-l5', produto: 'cambio', fonte: 'likert', rank: 5,
      titulo: 'Não encontro o comprovante para a escola',
      resumo: 'Clientes que pagam estudos fora precisam do comprovante em PDF e não acham onde baixar.',
      volume: 133, impacto: 'baixo', tendencia: 11, estacao: 'comprovante', onde: 'Comprovante',
      relacionadas: ['cam-f4'],
      evidencias: [
        { id: 'LK-21220', nota: 2, texto: 'Precisei do comprovante para a universidade e não achei em PDF.', data: '16 set 2026', canal: 'App iOS', perfil: 'Pessoa física' },
      ],
    },

    /* ---------- Câmbio · Voz do Cliente ---------- */
    {
      id: 'cam-v1', produto: 'cambio', fonte: 'voz', rank: 1,
      titulo: 'Minha transação de câmbio estornou e não recebi nenhuma notificação',
      resumo: 'A remessa volta para a conta quando o banco do beneficiário recusa os dados, e o cliente só descobre olhando o extrato.',
      volume: 1284, impacto: 'alto', tendencia: 31, estacao: 'acompanhar', onde: 'Acompanhar',
      relacionadas: ['cam-l2', 'cam-f2'], rechamada: 38,
      evidencias: [
        { id: 'VC-55120', data: '23 set 2026, 10:42', duracao: '6 min 12 s', motivo: 'Status de remessa', rechamada: true,
          trechos: [
            { t: '00:14', quem: 'Cliente', texto: 'Fiz uma remessa para os Estados Unidos na segunda e hoje vi que o dinheiro voltou para a conta.' },
            { t: '00:41', quem: 'Cliente', texto: 'Ninguém me avisou nada. Nem e-mail, nem notificação no app.' },
            { t: '01:05', quem: 'Atendente', texto: 'A remessa foi estornada porque o banco do beneficiário recusou o IBAN informado.' },
            { t: '01:12', quem: 'Cliente', texto: 'E como eu ia saber disso? O aluguel da minha filha vence amanhã.' },
          ] },
        { id: 'VC-54877', data: '21 set 2026, 16:03', duracao: '4 min 40 s', motivo: 'Estorno de remessa', rechamada: false,
          trechos: [
            { t: '00:22', quem: 'Cliente', texto: 'O app mostra “em processamento” há três dias e o dinheiro já está de volta na minha conta.' },
            { t: '00:58', quem: 'Atendente', texto: 'O status do app atualiza depois do estorno. Vou abrir uma solicitação.' },
          ] },
        { id: 'VC-53990', data: '15 set 2026, 09:17', duracao: '7 min 55 s', motivo: 'Estorno de remessa', rechamada: true,
          trechos: [
            { t: '02:31', quem: 'Cliente', texto: 'É a segunda vez que eu ligo. Quero saber o que eu preciso corrigir para mandar de novo.' },
          ] },
      ],
    },
    {
      id: 'cam-v2', produto: 'cambio', fonte: 'voz', rank: 2,
      titulo: 'Não entendo o motivo da remessa recusada',
      resumo: 'O app mostra só “recusada”, sem dizer o que o cliente precisa corrigir.',
      volume: 512, impacto: 'alto', tendencia: 12, estacao: 'acompanhar', onde: 'Acompanhar',
      relacionadas: ['cam-v1'], rechamada: 24,
      evidencias: [
        { id: 'VC-55311', data: '24 set 2026, 11:20', duracao: '5 min 03 s', motivo: 'Remessa recusada', rechamada: false,
          trechos: [
            { t: '02:10', quem: 'Cliente', texto: 'O app só diz recusada, mas recusada por quê?' },
            { t: '02:26', quem: 'Atendente', texto: 'O código de retorno indica divergência no nome do beneficiário.' },
          ] },
        { id: 'VC-54402', data: '19 set 2026, 14:48', duracao: '3 min 37 s', motivo: 'Remessa recusada', rechamada: true,
          trechos: [
            { t: '00:35', quem: 'Cliente', texto: 'Eu corrigi o que achei que era e foi recusada de novo.' },
          ] },
      ],
    },
    {
      id: 'cam-v3', produto: 'cambio', fonte: 'voz', rank: 3,
      titulo: 'A cotação cobrada foi diferente da simulada',
      resumo: 'Cliente liga para contestar a diferença entre a taxa simulada e a efetivada.',
      volume: 388, impacto: 'medio', tendencia: 7, estacao: 'confirmar', onde: 'Confirmar',
      relacionadas: ['cam-l1'], rechamada: 11,
      evidencias: [
        { id: 'VC-54019', data: '17 set 2026, 10:05', duracao: '6 min 48 s', motivo: 'Contestação de taxa', rechamada: false,
          trechos: [
            { t: '01:02', quem: 'Cliente', texto: 'Simulei, fui buscar o IBAN e quando voltei a cotação era outra.' },
          ] },
      ],
    },
    {
      id: 'cam-v4', produto: 'cambio', fonte: 'voz', rank: 4,
      titulo: 'Preciso alterar dados do beneficiário depois de enviar',
      resumo: 'Erro de digitação descoberto depois do envio, sem caminho de correção no app.',
      volume: 241, impacto: 'medio', tendencia: 0, estacao: 'acompanhar', onde: 'Acompanhar',
      relacionadas: ['cam-v2'], rechamada: 19,
      evidencias: [
        { id: 'VC-53712', data: '12 set 2026, 15:31', duracao: '8 min 10 s', motivo: 'Alteração de beneficiário', rechamada: true,
          trechos: [
            { t: '00:48', quem: 'Cliente', texto: 'Digitei uma letra errada no nome e não tem onde corrigir.' },
          ] },
      ],
    },
    {
      id: 'cam-v5', produto: 'cambio', fonte: 'voz', rank: 5,
      titulo: 'O limite de envio não aparece antes',
      resumo: 'O cliente descobre o limite só depois de preencher tudo.',
      volume: 167, impacto: 'baixo', tendencia: -5, estacao: 'simular', onde: 'Simular',
      relacionadas: [], rechamada: 6,
      evidencias: [
        { id: 'VC-53200', data: '8 set 2026, 13:12', duracao: '3 min 22 s', motivo: 'Limite de operação', rechamada: false,
          trechos: [
            { t: '00:31', quem: 'Cliente', texto: 'Preenchi tudo e no final disse que passei do limite. Por que não avisou antes?' },
          ] },
      ],
    },

    /* ---------- Câmbio · FullStory ---------- */
    {
      id: 'cam-f1', produto: 'cambio', fonte: 'fullstory', rank: 1,
      titulo: 'Rage click no botão Confirmar remessa',
      resumo: 'O botão fica desabilitado até o aceite dos termos, sem dizer por quê. O cliente toca várias vezes seguidas.',
      volume: 2140, impacto: 'alto', tendencia: 26, estacao: 'confirmar', onde: 'Confirmar · botão “Confirmar remessa”', sinal: 'Rage click',
      relacionadas: ['cam-l1'],
      evidencias: [
        { id: 'FS-88213', data: '24 set 2026', dispositivo: 'Android · app 8.42', tela: 'Confirmar', elemento: 'Botão “Confirmar remessa”', sinal: 'Rage click', momento: '00:47', detalhe: '9 toques em 3 segundos no botão desabilitado; depois volta para Revisar.' },
        { id: 'FS-87760', data: '22 set 2026', dispositivo: 'iOS · app 8.42', tela: 'Confirmar', elemento: 'Botão “Confirmar remessa”', sinal: 'Rage click', momento: '01:12', detalhe: '6 toques; rola a tela até achar a caixa de aceite.' },
        { id: 'FS-86104', data: '14 set 2026', dispositivo: 'Android · app 8.41', tela: 'Confirmar', elemento: 'Botão “Confirmar remessa”', sinal: 'Rage click', momento: '00:39', detalhe: '11 toques e abandono da sessão.' },
      ],
    },
    {
      id: 'cam-f2', produto: 'cambio', fonte: 'fullstory', rank: 2,
      titulo: 'Dead click no selo “Em processamento”',
      resumo: 'Clientes tocam no selo de status esperando detalhes; nada acontece.',
      volume: 1318, impacto: 'alto', tendencia: 18, estacao: 'acompanhar', onde: 'Acompanhar · selo de status', sinal: 'Dead click',
      relacionadas: ['cam-l2', 'cam-v1'],
      evidencias: [
        { id: 'FS-88022', data: '23 set 2026', dispositivo: 'iOS · app 8.42', tela: 'Acompanhar', elemento: 'Selo “Em processamento”', sinal: 'Dead click', momento: '00:18', detalhe: '4 toques no selo, depois abre o extrato.' },
        { id: 'FS-87431', data: '20 set 2026', dispositivo: 'Android · app 8.42', tela: 'Acompanhar', elemento: 'Selo “Em processamento”', sinal: 'Dead click', momento: '00:09', detalhe: '2 toques; liga para a central em seguida.' },
      ],
    },
    {
      id: 'cam-f3', produto: 'cambio', fonte: 'fullstory', rank: 3,
      titulo: 'Abandono no campo IBAN do beneficiário',
      resumo: 'O formulário do beneficiário perde clientes no campo IBAN, que não tem ajuda nem máscara.',
      volume: 906, impacto: 'medio', tendencia: 6, estacao: 'beneficiario', onde: 'Beneficiário · campo IBAN', sinal: 'Abandono de formulário',
      relacionadas: ['cam-l4'],
      evidencias: [
        { id: 'FS-86650', data: '17 set 2026', dispositivo: 'Android · app 8.41', tela: 'Beneficiário', elemento: 'Campo “IBAN”', sinal: 'Abandono de formulário', momento: '02:04', detalhe: 'Digita, apaga duas vezes e sai do app.' },
      ],
    },
    {
      id: 'cam-f4', produto: 'cambio', fonte: 'fullstory', rank: 4,
      titulo: 'Error click em “Baixar comprovante”',
      resumo: 'O download do comprovante falha com tempo esgotado em parte das tentativas.',
      volume: 544, impacto: 'medio', tendencia: 2, estacao: 'comprovante', onde: 'Comprovante · botão “Baixar”', sinal: 'Error click',
      relacionadas: ['cam-l5'],
      evidencias: [
        { id: 'FS-87102', data: '19 set 2026', dispositivo: 'Internet banking · Chrome', tela: 'Comprovante', elemento: 'Botão “Baixar comprovante”', sinal: 'Error click', momento: '00:33', detalhe: 'Erro de tempo esgotado; tenta 3 vezes.' },
      ],
    },
    {
      id: 'cam-f5', produto: 'cambio', fonte: 'fullstory', rank: 5,
      titulo: 'Cursor agitado na tabela de taxas',
      resumo: 'No internet banking, o cursor vai e volta sobre a tabela de taxas antes da confirmação.',
      volume: 289, impacto: 'baixo', tendencia: -4, estacao: 'revisar', onde: 'Revisar · tabela de taxas', sinal: 'Cursor agitado',
      relacionadas: ['cam-l3'],
      evidencias: [
        { id: 'FS-85931', data: '11 set 2026', dispositivo: 'Internet banking · Edge', tela: 'Revisar', elemento: 'Tabela “Taxas e impostos”', sinal: 'Cursor agitado', momento: '01:26', detalhe: '14 segundos de movimento sobre a tabela, sem clique.' },
      ],
    },

    /* ---------- Extrato · Likert ---------- */
    {
      id: 'ext-l1', produto: 'extrato', fonte: 'likert', rank: 1,
      titulo: 'Não consigo ver o histórico maior que 90 dias',
      resumo: 'O app mostra só os últimos 90 dias e não oferece outro período; o site mostra mais, e o cliente não entende por quê.',
      volume: 1932, impacto: 'alto', tendencia: 14, estacao: 'periodo', onde: 'Extrato · período',
      relacionadas: ['ext-f1', 'ext-v1'],
      evidencias: [
        { id: 'LK-30512', nota: 1, texto: 'Preciso ver um lançamento de março e o app só mostra 90 dias.', data: '20 set 2026', canal: 'App Android', perfil: 'Pessoa física' },
        { id: 'LK-30177', nota: 1, texto: 'Para o imposto de renda tenho que ligar no banco. Absurdo em 2026.', data: '14 set 2026', canal: 'App iOS', perfil: 'Pessoa física' },
        { id: 'LK-29934', nota: 2, texto: 'Por que no site eu vejo mais e no app não?', data: '9 set 2026', canal: 'App Android', perfil: 'Pessoa física' },
      ],
    },
    {
      id: 'ext-l2', produto: 'extrato', fonte: 'likert', rank: 2,
      titulo: 'A busca não encontra o lançamento',
      resumo: 'Buscar pelo nome da loja não traz resultado quando o lançamento aparece com outro nome.',
      volume: 744, impacto: 'medio', tendencia: 8, estacao: 'busca', onde: 'Busca',
      relacionadas: ['ext-f4'],
      evidencias: [
        { id: 'LK-30044', nota: 2, texto: 'Procuro pelo nome da loja e não acha nada.', data: '11 set 2026', canal: 'App iOS', perfil: 'Pessoa física' },
        { id: 'LK-29711', nota: 2, texto: 'A busca só funciona se eu digitar exatamente igual ao extrato.', data: '4 set 2026', canal: 'App Android', perfil: 'Pessoa física' },
      ],
    },
    {
      id: 'ext-l3', produto: 'extrato', fonte: 'likert', rank: 3,
      titulo: 'Lançamentos com nomes que não reconheço',
      resumo: 'Descrições como “PG *XPTO 3321” geram desconfiança e ligações de contestação.',
      volume: 612, impacto: 'medio', tendencia: 3, estacao: 'detalhe', onde: 'Detalhe do lançamento',
      relacionadas: ['ext-v3'],
      evidencias: [
        { id: 'LK-29540', nota: 2, texto: 'Aparece “PG *XPTO 3321” e eu não sei o que é.', data: '1 set 2026', canal: 'App Android', perfil: 'Pessoa física' },
      ],
    },
    {
      id: 'ext-l4', produto: 'extrato', fonte: 'likert', rank: 4,
      titulo: 'Saldo do dia confunde com saldo disponível',
      resumo: 'Dois saldos lado a lado, sem explicação da diferença.',
      volume: 455, impacto: 'medio', tendencia: -2, estacao: 'lista', onde: 'Extrato · topo',
      relacionadas: [],
      evidencias: [
        { id: 'LK-29102', nota: 3, texto: 'Nunca sei qual dos dois saldos é o que eu posso usar.', data: '25 ago 2026', canal: 'App iOS', perfil: 'Pessoa física' },
      ],
    },
    {
      id: 'ext-l5', produto: 'extrato', fonte: 'likert', rank: 5,
      titulo: 'Exportar em PDF fica escondido',
      resumo: 'A opção de exportar está num menu de três pontos que pouca gente abre.',
      volume: 301, impacto: 'baixo', tendencia: 5, estacao: 'exportar', onde: 'Exportar',
      relacionadas: ['ext-f3'],
      evidencias: [
        { id: 'LK-28870', nota: 3, texto: 'Demorei para descobrir que dava para exportar.', data: '19 ago 2026', canal: 'App Android', perfil: 'Pessoa física' },
      ],
    },

    /* ---------- Extrato · Voz do Cliente ---------- */
    {
      id: 'ext-v1', produto: 'extrato', fonte: 'voz', rank: 1,
      titulo: 'Preciso de um comprovante de Pix de mais de 90 dias',
      resumo: 'Cliente liga para pedir comprovantes antigos que o app não alcança.',
      volume: 1106, impacto: 'alto', tendencia: 17, estacao: 'comprovante', onde: 'Comprovante',
      relacionadas: ['ext-l1'], rechamada: 21,
      evidencias: [
        { id: 'VC-61204', data: '22 set 2026, 09:51', duracao: '5 min 40 s', motivo: 'Segunda via de comprovante', rechamada: false,
          trechos: [
            { t: '00:19', quem: 'Cliente', texto: 'O condomínio diz que não recebeu o Pix de abril e eu preciso do comprovante.' },
            { t: '00:44', quem: 'Cliente', texto: 'No app só vai até julho. Onde eu acho o de abril?' },
            { t: '01:10', quem: 'Atendente', texto: 'Consigo enviar por e-mail em até dois dias úteis.' },
          ] },
        { id: 'VC-60871', data: '18 set 2026, 17:26', duracao: '4 min 12 s', motivo: 'Segunda via de comprovante', rechamada: true,
          trechos: [
            { t: '00:37', quem: 'Cliente', texto: 'Já liguei semana passada e o comprovante não chegou.' },
          ] },
      ],
    },
    {
      id: 'ext-v2', produto: 'extrato', fonte: 'voz', rank: 2,
      titulo: 'Lançamento duplicado no extrato',
      resumo: 'Compras aparecem duas vezes enquanto uma delas ainda está pendente.',
      volume: 623, impacto: 'alto', tendencia: 9, estacao: 'lista', onde: 'Extrato · lista',
      relacionadas: [], rechamada: 16,
      evidencias: [
        { id: 'VC-60455', data: '15 set 2026, 12:08', duracao: '6 min 01 s', motivo: 'Lançamento duplicado', rechamada: false,
          trechos: [
            { t: '00:26', quem: 'Cliente', texto: 'Paguei uma vez e aparece duas no extrato. Fui cobrado em dobro?' },
          ] },
      ],
    },
    {
      id: 'ext-v3', produto: 'extrato', fonte: 'voz', rank: 3,
      titulo: 'Não reconheço uma compra',
      resumo: 'Descrição do lançamento não identifica a loja; o cliente liga achando que é fraude.',
      volume: 588, impacto: 'medio', tendencia: 4, estacao: 'detalhe', onde: 'Detalhe do lançamento',
      relacionadas: ['ext-l3'], rechamada: 9,
      evidencias: [
        { id: 'VC-60102', data: '12 set 2026, 19:44', duracao: '7 min 30 s', motivo: 'Contestação de compra', rechamada: false,
          trechos: [
            { t: '00:51', quem: 'Cliente', texto: 'Tem um débito de 89 reais com um nome estranho. Eu não fiz essa compra.' },
          ] },
      ],
    },
    {
      id: 'ext-v4', produto: 'extrato', fonte: 'voz', rank: 4,
      titulo: 'Extrato anual para o imposto de renda',
      resumo: 'Pedido de extrato consolidado do ano, que o app não gera.',
      volume: 402, impacto: 'medio', tendencia: 2, estacao: 'exportar', onde: 'Exportar',
      relacionadas: ['ext-l1'], rechamada: 7,
      evidencias: [
        { id: 'VC-59870', data: '9 set 2026, 10:15', duracao: '4 min 55 s', motivo: 'Informe e extrato anual', rechamada: false,
          trechos: [
            { t: '00:40', quem: 'Cliente', texto: 'Meu contador pediu o extrato do ano todo. O app não deixa.' },
          ] },
      ],
    },
    {
      id: 'ext-v5', produto: 'extrato', fonte: 'voz', rank: 5,
      titulo: 'Tarifa cobrada sem aviso',
      resumo: 'Tarifa de pacote aparece no extrato sem explicação.',
      volume: 277, impacto: 'baixo', tendencia: 0, estacao: 'lista', onde: 'Extrato · lista',
      relacionadas: [], rechamada: 5,
      evidencias: [
        { id: 'VC-59433', data: '3 set 2026, 14:22', duracao: '3 min 48 s', motivo: 'Tarifas', rechamada: false,
          trechos: [
            { t: '00:29', quem: 'Cliente', texto: 'Apareceu uma tarifa de 39,90 que eu não sei de onde veio.' },
          ] },
      ],
    },

    /* ---------- Extrato · FullStory ---------- */
    {
      id: 'ext-f1', produto: 'extrato', fonte: 'fullstory', rank: 1,
      titulo: 'Dead click no rótulo “Últimos 90 dias”',
      resumo: 'O rótulo parece um filtro, mas não é tocável. Clientes tocam esperando trocar o período.',
      volume: 8410, impacto: 'alto', tendencia: 15, estacao: 'periodo', onde: 'Extrato · rótulo de período', sinal: 'Dead click',
      relacionadas: ['ext-l1'],
      evidencias: [
        { id: 'FS-91450', data: '25 set 2026', dispositivo: 'Android · app 8.42', tela: 'Extrato', elemento: 'Rótulo “Últimos 90 dias”', sinal: 'Dead click', momento: '00:06', detalhe: '3 toques no rótulo; rola até o fim da lista.' },
        { id: 'FS-91022', data: '21 set 2026', dispositivo: 'iOS · app 8.42', tela: 'Extrato', elemento: 'Rótulo “Últimos 90 dias”', sinal: 'Dead click', momento: '00:11', detalhe: '2 toques; abre a busca e digita “abril”.' },
      ],
    },
    {
      id: 'ext-f2', produto: 'extrato', fonte: 'fullstory', rank: 2,
      titulo: 'Rage click em “Carregar mais”',
      resumo: 'O fim da lista demora a carregar e o cliente toca repetidamente.',
      volume: 3902, impacto: 'alto', tendencia: 10, estacao: 'lista', onde: 'Extrato · fim da lista', sinal: 'Rage click',
      relacionadas: [],
      evidencias: [
        { id: 'FS-90877', data: '20 set 2026', dispositivo: 'Android · app 8.42', tela: 'Extrato', elemento: 'Botão “Carregar mais”', sinal: 'Rage click', momento: '00:52', detalhe: '7 toques em 4 segundos.' },
      ],
    },
    {
      id: 'ext-f3', produto: 'extrato', fonte: 'fullstory', rank: 3,
      titulo: 'Error click em “Exportar PDF”',
      resumo: 'A exportação falha para períodos com muitos lançamentos.',
      volume: 1211, impacto: 'medio', tendencia: 3, estacao: 'exportar', onde: 'Exportar · botão “Exportar PDF”', sinal: 'Error click',
      relacionadas: ['ext-l5'],
      evidencias: [
        { id: 'FS-90231', data: '16 set 2026', dispositivo: 'Internet banking · Chrome', tela: 'Exportar', elemento: 'Botão “Exportar PDF”', sinal: 'Error click', momento: '00:44', detalhe: 'Mensagem de erro genérica; tenta de novo.' },
      ],
    },
    {
      id: 'ext-f4', produto: 'extrato', fonte: 'fullstory', rank: 4,
      titulo: 'Abandono da busca depois de duas tentativas',
      resumo: 'Clientes desistem da busca quando a primeira e a segunda tentativa não trazem nada.',
      volume: 980, impacto: 'medio', tendencia: 6, estacao: 'busca', onde: 'Busca · campo de busca', sinal: 'Abandono de formulário',
      relacionadas: ['ext-l2'],
      evidencias: [
        { id: 'FS-89904', data: '13 set 2026', dispositivo: 'iOS · app 8.41', tela: 'Busca', elemento: 'Campo de busca', sinal: 'Abandono de formulário', momento: '00:37', detalhe: 'Busca “mercado”, depois “super”, e fecha.' },
      ],
    },
    {
      id: 'ext-f5', produto: 'extrato', fonte: 'fullstory', rank: 5,
      titulo: 'Cursor agitado no detalhe do lançamento',
      resumo: 'No internet banking, o cursor percorre o detalhe procurando o nome da loja.',
      volume: 402, impacto: 'baixo', tendencia: -1, estacao: 'detalhe', onde: 'Detalhe do lançamento', sinal: 'Cursor agitado',
      relacionadas: ['ext-l3'],
      evidencias: [
        { id: 'FS-89510', data: '10 set 2026', dispositivo: 'Internet banking · Edge', tela: 'Detalhe do lançamento', elemento: 'Bloco “Estabelecimento”', sinal: 'Cursor agitado', momento: '00:58', detalhe: '9 segundos sobre o bloco, sem clique.' },
      ],
    },

    /* ---------- Pix (gerado durante o fluxo guiado) ---------- */
    {
      id: 'pix-l1', produto: 'pix', fonte: 'likert', rank: 1,
      titulo: 'O Pix agendado falha e ninguém me avisa',
      resumo: 'Quando falta saldo no dia, o agendamento não acontece e o cliente só descobre depois.',
      volume: 864, impacto: 'alto', tendencia: 19, estacao: 'agendados', onde: 'Agendados',
      relacionadas: ['pix-v3'],
      evidencias: [
        { id: 'LK-40211', nota: 1, texto: 'Agendei o aluguel, faltou saldo e o app não avisou. Paguei multa.', data: '21 set 2026', canal: 'App Android', perfil: 'Pessoa física' },
        { id: 'LK-39874', nota: 2, texto: 'Queria uma notificação no dia anterior.', data: '14 set 2026', canal: 'App iOS', perfil: 'Pessoa física' },
      ],
    },
    {
      id: 'pix-l2', produto: 'pix', fonte: 'likert', rank: 2,
      titulo: 'O limite noturno é confuso',
      resumo: 'O cliente não sabe a partir de que horas vale o limite reduzido.',
      volume: 512, impacto: 'medio', tendencia: 6, estacao: 'valor', onde: 'Valor',
      relacionadas: [],
      evidencias: [
        { id: 'LK-39502', nota: 2, texto: 'Às 20h01 meu Pix não passou. Ninguém explica o horário.', data: '7 set 2026', canal: 'App Android', perfil: 'Pessoa física' },
      ],
    },
    {
      id: 'pix-l3', produto: 'pix', fonte: 'likert', rank: 3,
      titulo: 'Tenho chaves demais e não sei qual usar',
      resumo: 'Gerenciar várias chaves é confuso; clientes não sabem qual compartilhar.',
      volume: 301, impacto: 'baixo', tendencia: 2, estacao: 'chaves', onde: 'Minhas chaves',
      relacionadas: [],
      evidencias: [
        { id: 'LK-39020', nota: 3, texto: 'Tenho CPF, celular, e-mail e aleatória. Qual eu passo?', data: '28 ago 2026', canal: 'App iOS', perfil: 'Pessoa física' },
      ],
    },
    {
      id: 'pix-v1', produto: 'pix', fonte: 'voz', rank: 1,
      titulo: 'Fiz um Pix para a pessoa errada, como devolvo?',
      resumo: 'Cliente não encontra o caminho de pedido de devolução no app.',
      volume: 932, impacto: 'alto', tendencia: 11, estacao: 'confirmar', onde: 'Confirmar',
      relacionadas: ['pix-f1'], rechamada: 27,
      evidencias: [
        { id: 'VC-70110', data: '25 set 2026, 08:33', duracao: '6 min 20 s', motivo: 'Devolução de Pix', rechamada: true,
          trechos: [
            { t: '00:15', quem: 'Cliente', texto: 'Colei a chave errada e o Pix foi. Como eu peço de volta?' },
          ] },
      ],
    },
    {
      id: 'pix-v2', produto: 'pix', fonte: 'voz', rank: 2,
      titulo: 'Caí num golpe e quero cancelar o Pix',
      resumo: 'Ligações urgentes de clientes que fizeram Pix para golpistas.',
      volume: 710, impacto: 'alto', tendencia: 8, estacao: 'confirmar', onde: 'Confirmar',
      relacionadas: [], rechamada: 14,
      evidencias: [
        { id: 'VC-69871', data: '22 set 2026, 21:12', duracao: '9 min 02 s', motivo: 'Golpe', rechamada: false,
          trechos: [
            { t: '00:22', quem: 'Cliente', texto: 'Me pediram um Pix dizendo que era do banco. Quero cancelar agora.' },
          ] },
      ],
    },
    {
      id: 'pix-v3', produto: 'pix', fonte: 'voz', rank: 3,
      titulo: 'O Pix agendado não foi feito',
      resumo: 'Cliente descobre pelo recebedor que o agendamento falhou.',
      volume: 455, impacto: 'medio', tendencia: 13, estacao: 'agendados', onde: 'Agendados',
      relacionadas: ['pix-l1'], rechamada: 10,
      evidencias: [
        { id: 'VC-69440', data: '18 set 2026, 10:40', duracao: '4 min 18 s', motivo: 'Agendamento', rechamada: false,
          trechos: [
            { t: '00:30', quem: 'Cliente', texto: 'O dono do imóvel disse que o Pix não caiu. Estava agendado.' },
          ] },
      ],
    },
    {
      id: 'pix-f1', produto: 'pix', fonte: 'fullstory', rank: 1,
      titulo: 'Rage click em “Colar chave”',
      resumo: 'O botão de colar não reage quando a área de transferência tem espaços extras.',
      volume: 5120, impacto: 'alto', tendencia: 21, estacao: 'colar', onde: 'Colar chave · botão “Colar”', sinal: 'Rage click',
      relacionadas: ['pix-v1'],
      evidencias: [
        { id: 'FS-95510', data: '26 set 2026', dispositivo: 'Android · app 8.42', tela: 'Colar chave', elemento: 'Botão “Colar”', sinal: 'Rage click', momento: '00:12', detalhe: '8 toques; digita a chave à mão.' },
      ],
    },
    {
      id: 'pix-f2', produto: 'pix', fonte: 'fullstory', rank: 2,
      titulo: 'Dead click no QR Code salvo',
      resumo: 'A miniatura do QR Code salvo parece tocável, mas não abre.',
      volume: 2230, impacto: 'medio', tendencia: 5, estacao: 'area', onde: 'Área Pix · QR salvo', sinal: 'Dead click',
      relacionadas: [],
      evidencias: [
        { id: 'FS-95002', data: '20 set 2026', dispositivo: 'iOS · app 8.42', tela: 'Área Pix', elemento: 'Miniatura do QR Code', sinal: 'Dead click', momento: '00:21', detalhe: '3 toques na miniatura.' },
      ],
    },
    {
      id: 'pix-f3', produto: 'pix', fonte: 'fullstory', rank: 3,
      titulo: 'Abandono na confirmação acima do limite',
      resumo: 'A mensagem de limite aparece só na confirmação e o cliente desiste.',
      volume: 1140, impacto: 'medio', tendencia: 4, estacao: 'confirmar', onde: 'Confirmar · aviso de limite', sinal: 'Abandono de formulário',
      relacionadas: ['pix-l2'],
      evidencias: [
        { id: 'FS-94471', data: '15 set 2026', dispositivo: 'Android · app 8.41', tela: 'Confirmar', elemento: 'Aviso “Limite excedido”', sinal: 'Abandono de formulário', momento: '00:48', detalhe: 'Lê o aviso e fecha o app.' },
      ],
    },
  ],

  /* ------------------------------------------------------------------ */
  /* Relatórios de Fonte                                                 */
  /* ------------------------------------------------------------------ */
  relatorios: [
    {
      id: 'rel-cambio-likert', produto: 'cambio', fonte: 'likert',
      periodo: '1 jul a 29 set 2026', geradoEm: '29 set 2026, 08:40', geradoPor: 'Claude',
      volume: 6912, destaque: '28% das respostas com nota 1 ou 2',
      narrativa: [
        'Em 90 dias, 6.912 clientes avaliaram a jornada de Câmbio. A nota média ficou em 3,4, e 28% das respostas deram nota 1 ou 2. As cinco Dores abaixo concentram 1.350 menções.',
        'A Dor que mais cresce é a mudança de cotação entre simular e confirmar (+22%). Ela aparece junto de um padrão: o cliente sai para buscar dados do beneficiário, volta e a taxa já é outra. A mesma queixa chega pela Voz do Cliente como contestação de taxa.',
        'A segunda Dor é a falta de visibilidade depois do envio. “Até 2 dias úteis” não responde à pergunta que o cliente faz, que é onde o dinheiro está agora.',
      ],
      metodo: 'Comentários agrupados por tema; uma menção conta uma vez por resposta. Notas 1 e 2 pesam no impacto.',
    },
    {
      id: 'rel-cambio-voz', produto: 'cambio', fonte: 'voz',
      periodo: '1 jul a 29 set 2026', geradoEm: '29 set 2026, 08:52', geradoPor: 'Claude',
      volume: 3205, destaque: '41% das ligações perguntam pelo status da remessa',
      narrativa: [
        'Foram 3.205 ligações sobre Câmbio no período. Quatro em cada dez perguntam pelo status de uma remessa, e a maior parte delas termina descobrindo um estorno.',
        'A Dor número um, o estorno sem notificação, soma 1.284 ligações e cresceu 31%. Em 38% dos casos o cliente liga mais de uma vez: na primeira para entender o que houve, na segunda para saber o que corrigir.',
        'O motivo da recusa raramente chega ao cliente em linguagem que ele entende. Atendentes traduzem códigos de retorno como “divergência no nome do beneficiário”, uma informação que o app poderia mostrar no momento do estorno.',
      ],
      metodo: 'Transcrições agrupadas pelo motivo declarado nos primeiros 60 segundos. Rechamada é uma nova ligação do mesmo cliente em até 7 dias.',
    },
    {
      id: 'rel-cambio-fullstory', produto: 'cambio', fonte: 'fullstory',
      periodo: '1 jul a 29 set 2026', geradoEm: '29 set 2026, 09:05', geradoPor: 'Claude',
      volume: 48300, destaque: '6,1% das sessões com sinal de frustração',
      narrativa: [
        'Das 48.300 sessões na jornada de Câmbio, 6,1% tiveram ao menos um sinal de frustração. Dois elementos respondem pela maior parte: o botão Confirmar remessa e o selo de status em Acompanhar.',
        'O rage click em Confirmar acontece porque o botão fica desabilitado até o aceite dos termos e não diz isso. Clientes tocam em sequência, rolam a tela e, em parte das sessões, desistem.',
        'O dead click no selo “Em processamento” confirma o que a Voz do Cliente mostra: o cliente procura detalhes do status e não encontra.',
      ],
      metodo: 'Sinais nativos do FullStory (rage, dead e error click, cursor agitado, abandono de formulário), contados por cliente único.',
    },
    {
      id: 'rel-extrato-likert', produto: 'extrato', fonte: 'likert',
      periodo: '1 jul a 29 set 2026', geradoEm: '28 set 2026, 17:10', geradoPor: 'Claude',
      volume: 18240, destaque: '31% das respostas com nota 1 ou 2',
      narrativa: [
        'Foram 18.240 avaliações do Extrato em 90 dias. A Dor dominante é o limite de 90 dias, com 1.932 menções, quase duas vezes e meia a segunda colocada.',
        'Os comentários mostram para que o cliente precisa do histórico: imposto de renda, comprovantes para condomínio e escola, conferência de compras antigas. O site mostra um período maior, e a diferença entre canais aparece como sinal de descuido.',
        'Busca e nomes de lançamento formam um segundo bloco: quando o cliente não reconhece um lançamento, tenta buscar, não encontra e liga.',
      ],
      metodo: 'Comentários agrupados por tema; uma menção conta uma vez por resposta. Notas 1 e 2 pesam no impacto.',
    },
    {
      id: 'rel-extrato-voz', produto: 'extrato', fonte: 'voz',
      periodo: '1 jul a 29 set 2026', geradoEm: '28 set 2026, 17:22', geradoPor: 'Claude',
      volume: 4870, destaque: '23% das ligações pedem segunda via de comprovante',
      narrativa: [
        'O Extrato gerou 4.870 ligações. Quase um quarto pede a segunda via de um comprovante, e a maioria desses comprovantes tem mais de 90 dias.',
        'Esse pedido é a mesma Dor que lidera o Likert, vista de outro ângulo: o cliente que não acha o lançamento antigo no app liga para pedir o comprovante.',
      ],
      metodo: 'Transcrições agrupadas pelo motivo declarado nos primeiros 60 segundos.',
    },
    {
      id: 'rel-extrato-fullstory', produto: 'extrato', fonte: 'fullstory',
      periodo: '1 jul a 29 set 2026', geradoEm: '28 set 2026, 17:35', geradoPor: 'Claude',
      volume: 212400, destaque: '8.410 clientes tocaram no rótulo de período',
      narrativa: [
        'O sinal mais frequente do Extrato é um dead click no rótulo “Últimos 90 dias”: 8.410 clientes tocaram nele esperando trocar o período. É o comportamento que confirma a Dor do Likert.',
        'O segundo sinal é o rage click em “Carregar mais”, causado pelo carregamento lento no fim da lista.',
      ],
      metodo: 'Sinais nativos do FullStory contados por cliente único.',
    },
    {
      id: 'rel-pix-likert', produto: 'pix', fonte: 'likert', guiado: true,
      periodo: '1 jul a 29 set 2026', geradoEm: 'agora', geradoPor: 'Claude',
      volume: 22480, destaque: '19% das respostas com nota 1 ou 2',
      narrativa: [
        'Foram 22.480 avaliações da área Pix. A Dor que lidera é o agendamento que falha sem aviso, com 864 menções e crescimento de 19%.',
        'O padrão é o mesmo da Voz do Cliente: o cliente descobre a falha pelo recebedor, às vezes com multa.',
      ],
      metodo: 'Comentários agrupados por tema; uma menção conta uma vez por resposta.',
    },
    {
      id: 'rel-pix-voz', produto: 'pix', fonte: 'voz', guiado: true,
      periodo: '1 jul a 29 set 2026', geradoEm: 'agora', geradoPor: 'Claude',
      volume: 6112, destaque: '15% das ligações pedem devolução de Pix',
      narrativa: [
        'Foram 6.112 ligações sobre Pix. Devolução de Pix enviado por engano lidera, seguida de golpes.',
      ],
      metodo: 'Transcrições agrupadas pelo motivo declarado nos primeiros 60 segundos.',
    },
    {
      id: 'rel-pix-fullstory', produto: 'pix', fonte: 'fullstory', guiado: true,
      periodo: '1 jul a 29 set 2026', geradoEm: 'agora', geradoPor: 'Claude',
      volume: 301800, destaque: '5.120 clientes com rage click em “Colar”',
      narrativa: [
        'O botão “Colar” da tela de chave concentra o sinal de frustração mais frequente da área Pix: 5.120 clientes tocaram várias vezes sem resposta.',
      ],
      metodo: 'Sinais nativos do FullStory contados por cliente único.',
    },
  ],

  /* ------------------------------------------------------------------ */
  /* Protótipos                                                          */
  /* ------------------------------------------------------------------ */
  prototipos: [
    {
      id: 'remessa', produto: 'cambio', nome: 'Remessa sem susto', tipo: 'existente',
      dores: ['cam-v1', 'cam-f1', 'cam-l2'],
      referencias: [
        { tipo: 'print', nome: 'Acompanhar (app atual).png' },
        { tipo: 'print', nome: 'Confirmar (app atual).png' },
        { tipo: 'print', nome: 'Revisar (app atual).png' },
        { tipo: 'sessao', nome: 'Sessão FS-88213 · rage click em Confirmar' },
      ],
      agente: 'claude', atualizado: 'há 12 min', criado: '28 set 2026',
      app: 'remessa',
      telas: ['revisar', 'confirmar', 'acompanhar'],
      telaInicial: 'acompanhar',
      propostas: [
        { id: 'atual', nome: 'Atual', estado: 'atual', resumo: 'Recriado a partir de 3 prints e 1 sessão do FullStory.', flags: {} },
        { id: 'a', nome: 'Proposta A', titulo: 'Status que avisa', estado: 'ativa', resumo: 'Estorno como passo da linha do tempo, com motivo e próximo passo; aviso por notificação; Confirmar guia o que falta.', flags: { timeline: true, notificacao: true, guiaConfirmar: true } },
        { id: 'b', nome: 'Proposta B', titulo: 'Rastreio do envio', estado: 'rascunho', resumo: 'O caminho do dinheiro em três paradas, do Brasil ao banco do beneficiário.', flags: { rastreio: true, guiaConfirmar: true } },
        { id: 'c', nome: 'Proposta C', titulo: 'Aviso no topo', estado: 'descartada', resumo: 'Faixa de aviso no topo do app. Descartada: o aviso some quando o cliente sai da tela.', flags: { faixa: true } },
      ],
      pontos: [
        { id: 'p1', quando: '28 set, 14:02', titulo: 'Protótipo criado', detalhe: '3 Dores e 4 Referências' },
        { id: 'p2', quando: '28 set, 14:06', titulo: 'Atual recriado', detalhe: 'Revisar, Confirmar e Acompanhar' },
        { id: 'p3', quando: '28 set, 14:19', titulo: 'Proposta A criada', detalhe: 'Status que avisa' },
        { id: 'p4', quando: '28 set, 14:31', titulo: 'Estorno na linha do tempo', detalhe: 'Proposta A · Acompanhar' },
        { id: 'p5', quando: '28 set, 14:40', titulo: 'Aviso de estorno por notificação', detalhe: 'Proposta A · Acompanhar' },
        { id: 'p6', quando: '28 set, 15:02', titulo: 'Variante 2 aceita', detalhe: 'Botão Confirmar remessa' },
        { id: 'p7', quando: '28 set, 15:10', titulo: 'Revisão de usabilidade', detalhe: '3 achados, 1 corrigido' },
        { id: 'p8', quando: '29 set, 09:15', titulo: 'Proposta B criada', detalhe: 'Rastreio do envio' },
        { id: 'p9', quando: '29 set, 09:28', titulo: 'Proposta C descartada', detalhe: 'Aviso no topo' },
      ],
      hipotese: {
        acreditamos: 'mostrar o estorno como um passo do status, com motivo e próximo passo, e avisar por notificação',
        resolve: 'o estorno sem notificação e as rechamadas para entender o que corrigir',
        saberemos: 'pelo menos 8 de 10 participantes dizem o que aconteceu com a remessa e o que fazer, sem ajuda',
      },
    },
    {
      id: 'historico', produto: 'extrato', nome: 'Extrato sem limite de 90 dias', tipo: 'existente',
      dores: ['ext-l1', 'ext-f1', 'ext-v1'],
      referencias: [
        { tipo: 'print', nome: 'Extrato (app atual).png' },
        { tipo: 'url', nome: 'Internet banking · página de extrato' },
        { tipo: 'sessao', nome: 'Sessão FS-91450 · toque no rótulo de período' },
      ],
      agente: 'devin', atualizado: 'ontem, 18:04', criado: '29 set 2026',
      app: 'extrato',
      telas: ['extrato', 'periodo'],
      telaInicial: 'extrato',
      propostas: [
        { id: 'atual', nome: 'Atual', estado: 'atual', resumo: 'Recriado a partir de 1 print, 1 página do site e 1 sessão.', flags: {} },
        { id: 'a', nome: 'Proposta A', titulo: 'Período livre', estado: 'ativa', resumo: 'O rótulo vira seletor de período com atalhos (mês, trimestre, ano) e datas livres até 5 anos.', flags: { periodoLivre: true, exportar: true } },
        { id: 'b', nome: 'Proposta B', titulo: 'Navegar por mês', estado: 'rascunho', resumo: 'Linha de meses rolável no topo; cada mês carrega o seu extrato.', flags: { meses: true } },
      ],
      pontos: [
        { id: 'p1', quando: '29 set, 16:40', titulo: 'Protótipo criado', detalhe: '3 Dores e 3 Referências' },
        { id: 'p2', quando: '29 set, 16:45', titulo: 'Atual recriado', detalhe: 'Extrato e Período' },
        { id: 'p3', quando: '29 set, 17:20', titulo: 'Proposta A criada', detalhe: 'Período livre' },
        { id: 'p4', quando: '29 set, 18:04', titulo: 'Proposta B criada', detalhe: 'Navegar por mês' },
      ],
    },
    {
      id: 'reserva', produto: 'cambio', nome: 'Reserva em moeda para viagem', tipo: 'novo',
      dores: [],
      briefing: 'Permitir que o cliente guarde reais em dólar ou euro aos poucos, para uma viagem com data marcada, vendo quanto já juntou e a cotação média das compras.',
      referencias: [{ tipo: 'arquivo', nome: 'PRD Reserva em moeda v0.2.pdf' }],
      agente: 'claude', atualizado: '27 set, 11:30', criado: '27 set 2026',
      app: 'reserva',
      telas: ['meta'],
      telaInicial: 'meta',
      propostas: [
        { id: 'a', nome: 'Proposta A', titulo: 'Meta de viagem', estado: 'ativa', resumo: 'Meta com data, valor em moeda e compras programadas.', flags: { meta: true } },
      ],
      pontos: [
        { id: 'p1', quando: '27 set, 10:52', titulo: 'Protótipo criado', detalhe: 'A partir de um Briefing' },
        { id: 'p2', quando: '27 set, 11:30', titulo: 'Proposta A criada', detalhe: 'Meta de viagem' },
      ],
    },
  ],

  /* ------------------------------------------------------------------ */
  /* Conversas                                                           */
  /* ------------------------------------------------------------------ */
  conversas: {
    remessa: [
      { tipo: 'registro', texto: 'Protótipo criado com 3 Dores e 4 Referências', quando: '28 set, 14:02' },
      { tipo: 'agente', agente: 'claude', quando: '14:06',
        texto: [
          'Recriei o Atual a partir dos 3 prints e da sessão do FullStory: Revisar, Confirmar e Acompanhar.',
          'Duas coisas aparecem já no Atual. O botão Confirmar remessa fica cinza sem dizer por quê, que é o rage click da sessão FS-88213. E a tela Acompanhar mostra “Em processamento” mesmo depois do estorno.',
        ],
        acoes: ['Recriou 3 telas do app atual', 'Conferiu o Protótipo: abre sem erros'], ponto: 'Atual recriado' },
      { tipo: 'usuario', quando: '14:12',
        texto: 'Resolve primeiro o estorno sem aviso. O cliente precisa saber que o dinheiro voltou e o que fazer.',
        cita: ['cam-v1'] },
      { tipo: 'agente', agente: 'claude', quando: '14:19',
        texto: [
          'Criei a Proposta A. Na tela Acompanhar, o estorno agora é um passo da linha do tempo, com o motivo em linguagem simples (“O banco do beneficiário recusou o IBAN”) e o próximo passo (“Corrigir dados e reenviar”).',
          'Também adicionei o aviso por notificação no momento do estorno, que é o que faltava nas ligações VC-55120 e VC-54877.',
        ],
        acoes: ['Criou a Proposta A', 'Editou a tela Acompanhar', 'Conferiu o Protótipo: abre sem erros'],
        verNoCanvas: { proposta: 'a', tela: 'acompanhar' }, ponto: 'Proposta A criada' },
      { tipo: 'selecao', quando: '14:55', elemento: 'Botão “Confirmar remessa”', acao: 'Deixar mais claro', pedido: 'Por que ele está desabilitado?' },
      { tipo: 'agente', agente: 'claude', quando: '15:02',
        texto: [
          'Gerei 3 Variantes para o botão. Você aceitou a Variante 2: o botão continua ativo e, se o cliente tocar sem aceitar os termos, a tela mostra o que falta e leva até a caixa de aceite.',
        ],
        carimbo: 'Variante 2 aceita',
        acoes: ['Aplicou a Variante 2 na Proposta A'], ponto: 'Variante 2 aceita' },
      { tipo: 'usuario', quando: '15:06', texto: 'Revisar usabilidade', atalho: true },
      { tipo: 'revisao', agente: 'claude', quando: '15:10',
        titulo: 'Revisão de usabilidade da Proposta A',
        achados: [
          { gravidade: 'resolvido', texto: 'Visibilidade do status: o estorno agora aparece com motivo e próximo passo.' },
          { gravidade: 'alto', texto: 'Prevenção de erros: o IBAN só é validado depois do envio. É a causa mais comum de estorno nas ligações.' },
          { gravidade: 'medio', texto: 'Linguagem: “Em processamento” continua vago nas etapas anteriores ao estorno.' },
        ],
        sugestoes: ['Validar o IBAN ao digitar', 'Trocar “Em processamento” por etapas', 'Criar Proposta com rastreio'], ponto: 'Revisão de usabilidade' },
    ],
    historico: [
      { tipo: 'registro', texto: 'Protótipo criado com 3 Dores e 3 Referências', quando: '29 set, 16:40' },
      { tipo: 'agente', agente: 'devin', quando: '16:45',
        texto: ['Recriei o Atual do Extrato. O rótulo “Últimos 90 dias” está no topo da lista e não é tocável, como nas sessões do FullStory.'],
        acoes: ['Recriou 2 telas do app atual'], ponto: 'Atual recriado' },
      { tipo: 'usuario', quando: '17:02', texto: 'Quero que o cliente escolha qualquer período até 5 anos, sem ligar para o banco.', cita: ['ext-l1'] },
      { tipo: 'agente', agente: 'devin', quando: '17:20',
        texto: ['Criei a Proposta A. O rótulo virou um seletor com atalhos (este mês, último trimestre, ano passado) e datas livres. Cada comprovante dentro do período pode ser exportado direto da lista.'],
        acoes: ['Criou a Proposta A', 'Editou a tela Extrato', 'Criou a tela Período'],
        verNoCanvas: { proposta: 'a', tela: 'periodo' }, ponto: 'Proposta A criada' },
    ],
    reserva: [
      { tipo: 'registro', texto: 'Protótipo criado a partir de um Briefing', quando: '27 set, 10:52' },
      { tipo: 'agente', agente: 'claude', quando: '11:30',
        texto: ['Li o Briefing e o PRD. Criei a Proposta A com uma meta de viagem: destino, data, valor em moeda e compras programadas. A cotação média das compras fica sempre visível.'],
        acoes: ['Criou a Proposta A', 'Criou a tela Meta'], ponto: 'Proposta A criada' },
    ],
  },

  conversaProduto: {
    cambio: [
      { tipo: 'usuario', quando: 'ontem, 16:20', texto: 'Quais Dores de Câmbio aparecem em mais de uma Fonte?' },
      { tipo: 'agente', agente: 'claude', quando: 'ontem, 16:21',
        texto: [
          'Três Dores se repetem entre as Fontes.',
          'O estorno sem notificação aparece na Voz do Cliente (1.284 ligações), no Likert como “não sei quando o dinheiro chega” e no FullStory como toques no selo “Em processamento”.',
          'A mudança de cotação aparece no Likert e na Voz do Cliente. O cadastro do beneficiário aparece no Likert e no FullStory, no abandono do campo IBAN.',
        ],
        citaDores: ['cam-v1', 'cam-l2', 'cam-f2', 'cam-l1', 'cam-v3'],
        criar: { dores: ['cam-v1', 'cam-l2', 'cam-f2'] } },
    ],
    extrato: [],
    pix: [],
  },

  agentes: [
    { id: 'claude', nome: 'Claude', estado: 'conectado', detalhe: 'Conectado com a sua conta',
      modelos: [
        { id: 'opus', nome: 'Opus', nota: 'O mais capaz, para Protótipos complexos' },
        { id: 'sonnet', nome: 'Sonnet', nota: 'Equilíbrio entre qualidade e velocidade' },
        { id: 'haiku', nome: 'Haiku', nota: 'O mais rápido, para ajustes pequenos' },
        { id: 'fable', nome: 'Fable', nota: 'Escrita e textos da interface' },
      ], modeloPadrao: 'sonnet' },
    { id: 'devin', nome: 'Devin', estado: 'conectado', detalhe: 'Conectado com a sua conta',
      modelos: [
        { id: 'auto', nome: 'Automático', nota: 'O Devin escolhe o modelo para cada tarefa' },
        { id: 'swe', nome: 'SWE', nota: 'Modelo próprio do Devin para construir' },
        { id: 'opus', nome: 'Opus', nota: 'Via Devin' },
        { id: 'sonnet', nome: 'Sonnet', nota: 'Via Devin' },
        { id: 'gpt', nome: 'GPT', nota: 'Via Devin' },
        { id: 'gemini', nome: 'Gemini', nota: 'Via Devin' },
      ], modeloPadrao: 'auto' },
  ],

  skillUX: {
    nome: 'impeccable', versao: '4.3.1', atualizada: 'hoje, 09:12',
    teste: 'Testada num Protótipo de teste: o modo ao vivo abriu e aplicou uma Variante.',
    template: 'prototipo-angular 0.3.0',
    historico: [
      { versao: '4.3.1', data: '1 out 2026', estado: 'Em uso' },
      { versao: '4.3.0', data: '24 set 2026', estado: 'Anterior' },
      { versao: '4.2.2', data: '10 set 2026', estado: 'Anterior' },
    ],
  },

  atalhos: [
    { id: 'critique', rotulo: 'Revisar usabilidade', dica: 'Avalia a Proposta e lista achados por gravidade' },
    { id: 'audit', rotulo: 'Checar acessibilidade', dica: 'Contraste, foco, teclado e leitor de tela' },
    { id: 'clarify', rotulo: 'Deixar mais claro', dica: 'Reescreve textos, rótulos e mensagens de erro' },
    { id: 'distill', rotulo: 'Simplificar', dica: 'Tira o que não ajuda a tarefa' },
    { id: 'polish', rotulo: 'Acabamento final', dica: 'Ajustes finos antes de mostrar' },
    { id: 'adapt', rotulo: 'Adaptar para desktop', dica: 'Versão para telas grandes' },
    { id: 'onboard', rotulo: 'Melhorar primeiro uso', dica: 'Estados vazios e primeiros passos' },
    { id: 'nova', rotulo: 'Nova Proposta', dica: 'Outra abordagem para as mesmas Dores' },
  ],

  /* Ações do modo ao vivo (vocabulário da Skill de UX em linguagem de PM) */
  acoesLive: [
    { id: 'impeccable', rotulo: 'Livre' },
    { id: 'clarify', rotulo: 'Deixar mais claro' },
    { id: 'distill', rotulo: 'Simplificar' },
    { id: 'bolder', rotulo: 'Mais destaque' },
    { id: 'quieter', rotulo: 'Mais discreto' },
    { id: 'layout', rotulo: 'Espaçamento' },
    { id: 'typeset', rotulo: 'Tipografia' },
    { id: 'colorize', rotulo: 'Cor' },
    { id: 'adapt', rotulo: 'Adaptar' },
    { id: 'polish', rotulo: 'Acabamento' },
  ],
};

/* ------------------------------------------------------------------ */
/* Categorias de Dor (Gráficos do Relatório). Sintéticas, como o resto. */
/* "padrao" e "sugestao" alimentam os insights por categoria.           */
/* ------------------------------------------------------------------ */
DS.data.categorias = {
  cambio: [
    { id: 'status', nome: 'Status e avisos', padrao: 'O cliente descobre o que aconteceu com a remessa fora do app: no extrato, pelo beneficiário ou ligando.', sugestao: 'Mostrar cada etapa do envio e avisar na hora em que algo dá errado, com o motivo e o que fazer.' },
    { id: 'cotacao', nome: 'Cotação e taxas', padrao: 'A taxa muda entre simular e confirmar, e o custo total só aparece no fim.', sugestao: 'Travar a cotação por alguns minutos e mostrar o total debitado desde a simulação.' },
    { id: 'beneficiario', nome: 'Cadastro do beneficiário', padrao: 'SWIFT, IBAN e endereço numa tela só fazem o cliente desistir ou errar os dados.', sugestao: 'Dividir o cadastro em passos curtos e validar o IBAN enquanto o cliente digita.' },
    { id: 'confirmacao', nome: 'Confirmação e limites', padrao: 'O botão de confirmar fica inativo sem dizer o que falta, e o limite só aparece tarde.', sugestao: 'Dizer o que falta antes do toque e mostrar o limite já na simulação.' },
    { id: 'comprovante', nome: 'Comprovantes', padrao: 'Quem paga estudos ou aluguel fora precisa do comprovante e não acha onde baixar.', sugestao: 'Deixar o comprovante em PDF a um toque, na própria tela de acompanhamento.' },
  ],
  extrato: [
    { id: 'historico', nome: 'Período e histórico', padrao: 'O limite de 90 dias leva o cliente a ligar para pedir extratos e comprovantes antigos.', sugestao: 'Liberar a escolha de período até 5 anos, com atalhos para mês e ano.' },
    { id: 'busca', nome: 'Busca e identificação', padrao: 'O cliente não reconhece o lançamento, tenta buscar, não acha e liga.', sugestao: 'Buscar por valor e por nome da loja, e mostrar o nome comercial no lançamento.' },
    { id: 'lista', nome: 'Lista e saldos', padrao: 'Saldos parecidos e lançamentos repetidos confundem quem confere a conta.', sugestao: 'Separar saldo do dia e saldo disponível, e explicar lançamentos repetidos.' },
    { id: 'exportar', nome: 'Exportação e documentos', padrao: 'Exportar é difícil de achar e falha justamente em períodos longos, como o do imposto de renda.', sugestao: 'Pôr o exportar no topo do extrato e gerar o informe anual pronto.' },
  ],
  pix: [
    { id: 'agendamentos', nome: 'Agendamentos', padrao: 'O Pix agendado falha sem aviso, e o cliente só descobre quando a conta não é paga.', sugestao: 'Avisar na véspera quando faltar saldo e resolver ali mesmo, no aviso.' },
    { id: 'seguranca', nome: 'Erros e golpes', padrao: 'Depois de um Pix errado ou de um golpe, o cliente não sabe como pedir a devolução.', sugestao: 'Explicar a devolução no comprovante e abrir o pedido em dois toques.' },
    { id: 'chaves', nome: 'Chaves e QR Code', padrao: 'Colar e escolher a chave falha ou confunde, e o cliente repete o toque.', sugestao: 'Fazer o Colar responder na hora, limpar a formatação e mostrar de quem é a chave.' },
    { id: 'limites', nome: 'Limites', padrao: 'O limite noturno e o limite por transação só aparecem quando o Pix é recusado.', sugestao: 'Mostrar o limite disponível antes do valor e oferecer o ajuste ali mesmo.' },
  ],
};
(function () {
  var mapa = {
    'cam-l1': 'cotacao', 'cam-l2': 'status', 'cam-l3': 'cotacao', 'cam-l4': 'beneficiario', 'cam-l5': 'comprovante',
    'cam-v1': 'status', 'cam-v2': 'status', 'cam-v3': 'cotacao', 'cam-v4': 'beneficiario', 'cam-v5': 'confirmacao',
    'cam-f1': 'confirmacao', 'cam-f2': 'status', 'cam-f3': 'beneficiario', 'cam-f4': 'comprovante', 'cam-f5': 'cotacao',
    'ext-l1': 'historico', 'ext-l2': 'busca', 'ext-l3': 'busca', 'ext-l4': 'lista', 'ext-l5': 'exportar',
    'ext-v1': 'historico', 'ext-v2': 'lista', 'ext-v3': 'busca', 'ext-v4': 'exportar', 'ext-v5': 'lista',
    'ext-f1': 'historico', 'ext-f2': 'lista', 'ext-f3': 'exportar', 'ext-f4': 'busca', 'ext-f5': 'busca',
    'pix-l1': 'agendamentos', 'pix-l2': 'limites', 'pix-l3': 'chaves',
    'pix-v1': 'seguranca', 'pix-v2': 'seguranca', 'pix-v3': 'agendamentos',
    'pix-f1': 'chaves', 'pix-f2': 'chaves', 'pix-f3': 'limites',
  };
  DS.data.dores.forEach(function (d) { d.categoria = mapa[d.id]; });
})();
