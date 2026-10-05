#!/usr/bin/env node
// Design Studio — gera o catálogo e os dados de exemplo embarcados
// (`resources/design-studio/`, Landing 6 e 16 da tarefa A).
//
//   node scripts/gen-design-studio-data.mjs
//
// Determinístico: rodar de novo produz os mesmos bytes. Os textos, Produtos,
// telas, unidades e volumes vêm do protótipo de validação
// (`design-studio/prototype/data.js`); o resto é ruído realista para que o
// script da skill tenha o que agrupar e ranquear.
//
// O que sai é **registro bruto ponderado** (Landing 16): cada linha é uma
// resposta, ligação ou sessão da amostra, com `diasAtras` (0–89, o período é
// móvel), `tema` (ou `null`, quando a linha não fala de nenhuma Dor) e `peso`
// (quantas linhas da tabela real ela representa). Nada aqui é Dor ranqueada:
// agrupar, somar, ranquear e escolher Evidências é trabalho da skill.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'design-studio')

/** Fim do período no protótipo: as datas das Evidências viram `diasAtras` contra ele. */
const FIM_PROTOTIPO = Date.UTC(2026, 8, 29)
const MESES = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11
}
const SEMANAS = 13

const PRODUTOS = [
  {
    id: 'cambio',
    nome: 'Câmbio',
    descricao: 'Compra e envio de moeda estrangeira pelo app',
    telas: ['Simular', 'Revisar', 'Beneficiário', 'Confirmar', 'Acompanhar', 'Comprovante']
  },
  {
    id: 'extrato',
    nome: 'Extrato',
    descricao: 'Extrato da conta corrente no app e no internet banking',
    telas: ['Extrato', 'Período', 'Busca', 'Detalhe', 'Comprovante', 'Exportar']
  },
  {
    id: 'pix',
    nome: 'Pix',
    descricao: 'Transferências, agendamentos e chaves Pix',
    telas: ['Área Pix', 'Colar chave', 'Valor', 'Confirmar', 'Agendados', 'Minhas chaves']
  }
]

const FONTES = [
  {
    id: 'likert',
    nome: 'Likert',
    descricao: 'Notas de 1 a 5 e comentários abertos deixados no app',
    unidade: 'respostas',
    unidadeDor: 'menções',
    unidadeNota: 'menções'
  },
  {
    id: 'voz',
    nome: 'Voz do Cliente',
    descricao: 'Ligações em que clientes relatam dores a atendentes',
    unidade: 'ligações',
    unidadeDor: 'ligações',
    unidadeNota: 'ligações'
  },
  {
    id: 'fullstory',
    nome: 'FullStory',
    descricao: 'Comportamento real de navegação e sinais de frustração',
    unidade: 'sessões',
    unidadeDor: 'clientes afetados',
    unidadeNota: 'clientes'
  }
]

const CATEGORIAS = {
  cambio: [
    [
      'status',
      'Status e avisos',
      'O cliente descobre o que aconteceu com a remessa fora do app: no extrato, pelo beneficiário ou ligando.',
      'Mostrar cada etapa do envio e avisar na hora em que algo dá errado, com o motivo e o que fazer.'
    ],
    [
      'cotacao',
      'Cotação e taxas',
      'A taxa muda entre simular e confirmar, e o custo total só aparece no fim.',
      'Travar a cotação por alguns minutos e mostrar o total debitado desde a simulação.'
    ],
    [
      'beneficiario',
      'Cadastro do beneficiário',
      'SWIFT, IBAN e endereço numa tela só fazem o cliente desistir ou errar os dados.',
      'Dividir o cadastro em passos curtos e validar o IBAN enquanto o cliente digita.'
    ],
    [
      'confirmacao',
      'Confirmação e limites',
      'O botão de confirmar fica inativo sem dizer o que falta, e o limite só aparece tarde.',
      'Dizer o que falta antes do toque e mostrar o limite já na simulação.'
    ],
    [
      'comprovante',
      'Comprovantes',
      'Quem paga estudos ou aluguel fora precisa do comprovante e não acha onde baixar.',
      'Deixar o comprovante em PDF a um toque, na própria tela de acompanhamento.'
    ]
  ],
  extrato: [
    [
      'historico',
      'Período e histórico',
      'O limite de 90 dias leva o cliente a ligar para pedir extratos e comprovantes antigos.',
      'Liberar a escolha de período até 5 anos, com atalhos para mês e ano.'
    ],
    [
      'busca',
      'Busca e identificação',
      'O cliente não reconhece o lançamento, tenta buscar, não acha e liga.',
      'Buscar por valor e por nome da loja, e mostrar o nome comercial no lançamento.'
    ],
    [
      'lista',
      'Lista e saldos',
      'Saldos parecidos e lançamentos repetidos confundem quem confere a conta.',
      'Separar saldo do dia e saldo disponível, e explicar lançamentos repetidos.'
    ],
    [
      'exportar',
      'Exportação e documentos',
      'Exportar é difícil de achar e falha justamente em períodos longos, como o do imposto de renda.',
      'Pôr o exportar no topo do extrato e gerar o informe anual pronto.'
    ]
  ],
  pix: [
    [
      'agendamentos',
      'Agendamentos',
      'O Pix agendado falha sem aviso, e o cliente só descobre quando a conta não é paga.',
      'Avisar na véspera quando faltar saldo e resolver ali mesmo, no aviso.'
    ],
    [
      'seguranca',
      'Erros e golpes',
      'Depois de um Pix errado ou de um golpe, o cliente não sabe como pedir a devolução.',
      'Explicar a devolução no comprovante e abrir o pedido em dois toques.'
    ],
    [
      'chaves',
      'Chaves e QR Code',
      'Colar e escolher a chave falha ou confunde, e o cliente repete o toque.',
      'Fazer o Colar responder na hora, limpar a formatação e mostrar de quem é a chave.'
    ],
    [
      'limites',
      'Limites',
      'O limite noturno e o limite por transação só aparecem quando o Pix é recusado.',
      'Mostrar o limite disponível antes do valor e oferecer o ajuste ali mesmo.'
    ],
    [
      'comprovantes',
      'Comprovantes',
      'O comprovante existe, mas não sai do app do jeito que o cliente precisa mandar.',
      'Oferecer o compartilhamento do comprovante direto na tela de sucesso.'
    ]
  ]
}

const L = (id, data, nota, texto, canal = 'App Android', perfil = 'Pessoa física') => ({
  id,
  data,
  nota,
  texto,
  canal,
  perfil
})
const V = (id, data, duracao, rechamada, trechos) => ({ id, data, duracao, rechamada, trechos })
const T = (t, quem, texto) => ({ t, quem, texto })
const F = (id, data, dispositivo, momento, detalhe) => ({ id, data, dispositivo, momento, detalhe })

/*
 * Os temas de cada Produto × Fonte. Campos: id, titulo, resumo, tela (ou null),
 * categoria, total no período, tendência alvo (%), e o que a Fonte mede:
 * `ruim` (Likert: parte das notas 1 e 2), `rechamada` (Voz, %), `sinal` e
 * `elemento` (FullStory). `evidencias` são as linhas com conteúdo.
 */
const DADOS = {
  'cambio/likert': {
    volume: 6912,
    ruim: 0.28,
    temas: [
      {
        id: 'cotacao-muda',
        titulo: 'A cotação muda entre simular e confirmar',
        resumo:
          'O cliente simula com uma taxa e encontra outra na confirmação, sem aviso de quanto tempo a cotação vale.',
        tela: 'Confirmar',
        categoria: 'cotacao',
        total: 412,
        tendencia: 22,
        ruim: 0.82,
        evidencias: [
          L(
            'LK-20931',
            '12 set 2026',
            1,
            'Simulei a 5,42 e na hora de confirmar estava 5,49. Me senti enganado.',
            'App iOS'
          ),
          L(
            'LK-21408',
            '18 set 2026',
            2,
            'Não fica claro por quanto tempo a cotação vale. Demorei para achar os dados do beneficiário e perdi a taxa.'
          ),
          L(
            'LK-19877',
            '3 set 2026',
            2,
            'Queria travar a taxa por alguns minutos enquanto preencho o resto.',
            'App iOS'
          )
        ]
      },
      {
        id: 'quando-chega',
        titulo: 'Não sei quando o dinheiro chega lá fora',
        resumo:
          'Depois de enviar, o cliente só vê “até 2 dias úteis” e não sabe em que etapa a remessa está.',
        tela: 'Acompanhar',
        categoria: 'status',
        total: 338,
        tendencia: 9,
        ruim: 0.79,
        evidencias: [
          L(
            'LK-21102',
            '15 set 2026',
            1,
            'Mandei para minha filha em Lisboa e não sei se já chegou. Tive que pedir para ela olhar o banco dela.'
          ),
          L(
            'LK-20514',
            '9 set 2026',
            2,
            'Prazo “até 2 dias úteis” não ajuda. Quero ver onde o dinheiro está.',
            'App iOS'
          )
        ]
      },
      {
        id: 'taxas-no-final',
        titulo: 'As taxas aparecem só no final',
        resumo:
          'IOF e tarifa só ficam visíveis na última tela, depois que o cliente já decidiu o valor.',
        tela: 'Revisar',
        categoria: 'cotacao',
        total: 271,
        tendencia: 4,
        ruim: 0.61,
        evidencias: [
          L(
            'LK-19650',
            '1 set 2026',
            2,
            'O IOF e a tarifa só aparecem na última tela. Tive que voltar e refazer a conta.'
          ),
          L(
            'LK-20077',
            '5 set 2026',
            3,
            'Seria bom ver o valor total que sai da minha conta já na simulação.',
            'Internet banking'
          )
        ]
      },
      {
        id: 'cadastro-beneficiario',
        titulo: 'O cadastro do beneficiário é longo demais',
        resumo: 'SWIFT, IBAN e endereço completo em uma tela só; muita gente desiste no meio.',
        tela: 'Beneficiário',
        categoria: 'beneficiario',
        total: 196,
        tendencia: -3,
        ruim: 0.62,
        evidencias: [
          L(
            'LK-18912',
            '22 ago 2026',
            1,
            'Pede SWIFT, IBAN, endereço... desisti na metade e fui pelo site.',
            'App iOS'
          ),
          L('LK-19533', '30 ago 2026', 2, 'Não sei o que é IBAN e o app não explica.')
        ]
      },
      {
        id: 'comprovante-escola',
        titulo: 'Não encontro o comprovante para a escola',
        resumo:
          'Clientes que pagam estudos fora precisam do comprovante em PDF e não acham onde baixar.',
        tela: 'Comprovante',
        categoria: 'comprovante',
        total: 133,
        tendencia: 11,
        ruim: 0.42,
        evidencias: [
          L(
            'LK-21220',
            '16 set 2026',
            2,
            'Precisei do comprovante para a universidade e não achei em PDF.',
            'App iOS'
          )
        ]
      },
      {
        id: 'app-lento-simular',
        titulo: 'A simulação demora a responder',
        resumo: 'Trocar a moeda ou o valor leva segundos para atualizar a cotação.',
        tela: 'Simular',
        categoria: 'cotacao',
        total: 88,
        tendencia: 2,
        ruim: 0.4,
        evidencias: [
          L(
            'LK-20388',
            '10 set 2026',
            3,
            'Cada vez que mudo o valor a tela trava um pouco antes de mostrar a cotação.'
          )
        ]
      },
      {
        id: 'limite-diario',
        titulo: 'Não sei qual é o meu limite diário de compra',
        resumo: 'O limite de operações por dia não aparece em lugar nenhum antes da confirmação.',
        tela: 'Simular',
        categoria: 'confirmacao',
        total: 61,
        tendencia: -6,
        ruim: 0.35,
        evidencias: [
          L(
            'LK-19204',
            '27 ago 2026',
            3,
            'Queria saber quanto ainda posso comprar hoje antes de começar.',
            'Internet banking'
          )
        ]
      },
      {
        id: 'chat-nao-resolve',
        titulo: 'O chat não resolve problema de câmbio',
        resumo: 'O assistente do app responde com textos genéricos e encaminha para a central.',
        tela: null,
        categoria: 'status',
        total: 47,
        tendencia: 1,
        ruim: 0.45,
        evidencias: [
          L(
            'LK-20910',
            '13 set 2026',
            2,
            'Perguntei da minha remessa no chat e ele me mandou ligar.'
          )
        ]
      }
    ]
  },
  'cambio/voz': {
    volume: 3205,
    temas: [
      {
        id: 'estorno-sem-aviso',
        titulo: 'Minha transação de câmbio estornou e não recebi nenhuma notificação',
        resumo:
          'A remessa volta para a conta quando o banco do beneficiário recusa os dados, e o cliente só descobre olhando o extrato.',
        tela: 'Acompanhar',
        categoria: 'status',
        total: 1284,
        tendencia: 31,
        rechamada: 38,
        motivo: 'Estorno de remessa',
        evidencias: [
          V('VC-55120', '23 set 2026, 10:42', '6 min 12 s', true, [
            T(
              '00:14',
              'Cliente',
              'Fiz uma remessa para os Estados Unidos na segunda e hoje vi que o dinheiro voltou para a conta.'
            ),
            T('00:41', 'Cliente', 'Ninguém me avisou nada. Nem e-mail, nem notificação no app.'),
            T(
              '01:05',
              'Atendente',
              'A remessa foi estornada porque o banco do beneficiário recusou o IBAN informado.'
            ),
            T(
              '01:12',
              'Cliente',
              'E como eu ia saber disso? O aluguel da minha filha vence amanhã.'
            )
          ]),
          V('VC-54877', '21 set 2026, 16:03', '4 min 40 s', false, [
            T(
              '00:22',
              'Cliente',
              'O app mostra “em processamento” há três dias e o dinheiro já está de volta na minha conta.'
            ),
            T(
              '00:58',
              'Atendente',
              'O status do app atualiza depois do estorno. Vou abrir uma solicitação.'
            )
          ]),
          V('VC-53990', '15 set 2026, 09:17', '7 min 55 s', true, [
            T(
              '02:31',
              'Cliente',
              'É a segunda vez que eu ligo. Quero saber o que eu preciso corrigir para mandar de novo.'
            )
          ])
        ]
      },
      {
        id: 'motivo-recusa',
        titulo: 'Não entendo o motivo da remessa recusada',
        resumo: 'O app mostra só “recusada”, sem dizer o que o cliente precisa corrigir.',
        tela: 'Acompanhar',
        categoria: 'status',
        total: 512,
        tendencia: 12,
        rechamada: 24,
        motivo: 'Remessa recusada',
        evidencias: [
          V('VC-55311', '24 set 2026, 11:20', '5 min 03 s', false, [
            T('02:10', 'Cliente', 'O app só diz recusada, mas recusada por quê?'),
            T(
              '02:26',
              'Atendente',
              'O código de retorno indica divergência no nome do beneficiário.'
            )
          ]),
          V('VC-54402', '19 set 2026, 14:48', '3 min 37 s', true, [
            T('00:35', 'Cliente', 'Eu corrigi o que achei que era e foi recusada de novo.')
          ])
        ]
      },
      {
        id: 'cotacao-diferente',
        titulo: 'A cotação cobrada foi diferente da simulada',
        resumo: 'Cliente liga para contestar a diferença entre a taxa simulada e a efetivada.',
        tela: 'Confirmar',
        categoria: 'cotacao',
        total: 388,
        tendencia: 7,
        rechamada: 11,
        motivo: 'Contestação de taxa',
        evidencias: [
          V('VC-54019', '17 set 2026, 10:05', '6 min 48 s', false, [
            T('01:02', 'Cliente', 'Simulei, fui buscar o IBAN e quando voltei a cotação era outra.')
          ])
        ]
      },
      {
        id: 'alterar-beneficiario',
        titulo: 'Preciso alterar dados do beneficiário depois de enviar',
        resumo: 'Erro de digitação descoberto depois do envio, sem caminho de correção no app.',
        tela: 'Acompanhar',
        categoria: 'beneficiario',
        total: 241,
        tendencia: 0,
        rechamada: 19,
        motivo: 'Alteração de beneficiário',
        evidencias: [
          V('VC-53712', '12 set 2026, 15:31', '8 min 10 s', true, [
            T('00:48', 'Cliente', 'Digitei uma letra errada no nome e não tem onde corrigir.')
          ])
        ]
      },
      {
        id: 'limite-nao-aparece',
        titulo: 'O limite de envio não aparece antes',
        resumo: 'O cliente descobre o limite só depois de preencher tudo.',
        tela: 'Simular',
        categoria: 'confirmacao',
        total: 167,
        tendencia: -5,
        rechamada: 6,
        motivo: 'Limite de operação',
        evidencias: [
          V('VC-53200', '8 set 2026, 13:12', '3 min 22 s', false, [
            T(
              '00:31',
              'Cliente',
              'Preenchi tudo e no final disse que passei do limite. Por que não avisou antes?'
            )
          ])
        ]
      },
      {
        id: 'iof-duvida',
        titulo: 'Não entendi quanto paguei de IOF',
        resumo: 'O comprovante mostra o total, mas não separa IOF, tarifa e cotação.',
        tela: 'Revisar',
        categoria: 'cotacao',
        total: 96,
        tendencia: 3,
        rechamada: 5,
        motivo: 'Dúvida sobre impostos',
        evidencias: [
          V('VC-54630', '20 set 2026, 12:02', '4 min 05 s', false, [
            T('00:19', 'Cliente', 'Quanto disso aqui foi IOF? No comprovante só aparece o total.')
          ])
        ]
      },
      {
        id: 'cartao-viagem',
        titulo: 'Quero usar o saldo em moeda no cartão de viagem',
        resumo: 'Clientes não sabem se a moeda comprada vai para o cartão pré-pago.',
        tela: null,
        categoria: 'cotacao',
        total: 72,
        tendencia: 9,
        rechamada: 8,
        motivo: 'Cartão de viagem',
        evidencias: [
          V('VC-54210', '18 set 2026, 18:40', '5 min 27 s', false, [
            T(
              '00:33',
              'Cliente',
              'Comprei dólar no app. Ele vai direto para o meu cartão de viagem?'
            )
          ])
        ]
      },
      {
        id: 'token-confirmar',
        titulo: 'O token não chega na hora de confirmar',
        resumo: 'O SMS de confirmação demora, e a cotação expira enquanto o cliente espera.',
        tela: 'Confirmar',
        categoria: 'confirmacao',
        total: 58,
        tendencia: -2,
        rechamada: 9,
        motivo: 'Token e segurança',
        evidencias: [
          V('VC-53870', '13 set 2026, 08:55', '3 min 49 s', false, [
            T('00:27', 'Cliente', 'O código não chegou e quando chegou a cotação já tinha mudado.')
          ])
        ]
      }
    ]
  },
  'cambio/fullstory': {
    volume: 48300,
    temas: [
      {
        id: 'rage-confirmar-remessa',
        titulo: 'Rage click no botão Confirmar remessa',
        resumo:
          'O botão fica desabilitado até o aceite dos termos, sem dizer por quê. O cliente toca várias vezes seguidas.',
        tela: 'Confirmar',
        categoria: 'confirmacao',
        total: 2140,
        tendencia: 26,
        sinal: 'Rage click',
        elemento: 'Botão “Confirmar remessa”',
        evidencias: [
          F(
            'FS-88213',
            '24 set 2026',
            'Android · app 8.42',
            '00:47',
            '9 toques em 3 segundos no botão desabilitado; depois volta para Revisar.'
          ),
          F(
            'FS-87760',
            '22 set 2026',
            'iOS · app 8.42',
            '01:12',
            '6 toques; rola a tela até achar a caixa de aceite.'
          ),
          F(
            'FS-86104',
            '14 set 2026',
            'Android · app 8.41',
            '00:39',
            '11 toques e abandono da sessão.'
          )
        ]
      },
      {
        id: 'dead-selo-status',
        titulo: 'Dead click no selo “Em processamento”',
        resumo: 'Clientes tocam no selo de status esperando detalhes; nada acontece.',
        tela: 'Acompanhar',
        categoria: 'status',
        total: 1318,
        tendencia: 18,
        sinal: 'Dead click',
        elemento: 'Selo “Em processamento”',
        evidencias: [
          F(
            'FS-88022',
            '23 set 2026',
            'iOS · app 8.42',
            '00:18',
            '4 toques no selo, depois abre o extrato.'
          ),
          F(
            'FS-87431',
            '20 set 2026',
            'Android · app 8.42',
            '00:09',
            '2 toques; liga para a central em seguida.'
          )
        ]
      },
      {
        id: 'abandono-iban',
        titulo: 'Abandono no campo IBAN do beneficiário',
        resumo:
          'O formulário do beneficiário perde clientes no campo IBAN, que não tem ajuda nem máscara.',
        tela: 'Beneficiário',
        categoria: 'beneficiario',
        total: 906,
        tendencia: 6,
        sinal: 'Abandono de formulário',
        elemento: 'Campo “IBAN”',
        evidencias: [
          F(
            'FS-86650',
            '17 set 2026',
            'Android · app 8.41',
            '02:04',
            'Digita, apaga duas vezes e sai do app.'
          )
        ]
      },
      {
        id: 'error-baixar-comprovante',
        titulo: 'Error click em “Baixar comprovante”',
        resumo: 'O download do comprovante falha com tempo esgotado em parte das tentativas.',
        tela: 'Comprovante',
        categoria: 'comprovante',
        total: 544,
        tendencia: 2,
        sinal: 'Error click',
        elemento: 'Botão “Baixar comprovante”',
        evidencias: [
          F(
            'FS-87102',
            '19 set 2026',
            'Internet banking · Chrome',
            '00:33',
            'Erro de tempo esgotado; tenta 3 vezes.'
          )
        ]
      },
      {
        id: 'cursor-tabela-taxas',
        titulo: 'Cursor agitado na tabela de taxas',
        resumo:
          'No internet banking, o cursor vai e volta sobre a tabela de taxas antes da confirmação.',
        tela: 'Revisar',
        categoria: 'cotacao',
        total: 289,
        tendencia: -4,
        sinal: 'Cursor agitado',
        elemento: 'Tabela “Taxas e impostos”',
        evidencias: [
          F(
            'FS-85931',
            '11 set 2026',
            'Internet banking · Edge',
            '01:26',
            '14 segundos de movimento sobre a tabela, sem clique.'
          )
        ]
      },
      {
        id: 'dead-bandeira-moeda',
        titulo: 'Dead click na bandeira da moeda',
        resumo: 'A bandeira ao lado do valor parece trocar a moeda, mas não reage ao toque.',
        tela: 'Simular',
        categoria: 'cotacao',
        total: 212,
        tendencia: 1,
        sinal: 'Dead click',
        elemento: 'Ícone da bandeira',
        evidencias: [
          F(
            'FS-87240',
            '21 set 2026',
            'iOS · app 8.42',
            '00:15',
            '3 toques na bandeira; abre o seletor de moeda pelo menu.'
          )
        ]
      },
      {
        id: 'rage-voltar-revisar',
        titulo: 'Rage click em Voltar na revisão',
        resumo:
          'Voltar da revisão perde os dados do beneficiário, e o cliente toca de novo esperando outra coisa.',
        tela: 'Revisar',
        categoria: 'confirmacao',
        total: 154,
        tendencia: -3,
        sinal: 'Rage click',
        elemento: 'Botão “Voltar”',
        evidencias: [
          F(
            'FS-86377',
            '16 set 2026',
            'Android · app 8.41',
            '01:40',
            '5 toques em Voltar; preenche o beneficiário de novo.'
          )
        ]
      },
      {
        id: 'abandono-valor-simulacao',
        titulo: 'Abandono no campo de valor da simulação',
        resumo: 'Clientes digitam o valor em reais esperando ver em dólar e desistem.',
        tela: 'Simular',
        categoria: 'cotacao',
        total: 133,
        tendencia: 4,
        sinal: 'Abandono de formulário',
        elemento: 'Campo “Valor em reais”',
        evidencias: [
          F(
            'FS-85702',
            '9 set 2026',
            'iOS · app 8.41',
            '00:52',
            'Troca o valor quatro vezes e fecha o app.'
          )
        ]
      }
    ]
  },
  'extrato/likert': {
    volume: 18240,
    ruim: 0.31,
    temas: [
      {
        id: 'historico-90-dias',
        titulo: 'Não consigo ver o histórico maior que 90 dias',
        resumo:
          'O app mostra só os últimos 90 dias e não oferece outro período; o site mostra mais, e o cliente não entende por quê.',
        tela: 'Período',
        categoria: 'historico',
        total: 1932,
        tendencia: 14,
        ruim: 0.86,
        evidencias: [
          L(
            'LK-30512',
            '20 set 2026',
            1,
            'Preciso ver um lançamento de março e o app só mostra 90 dias.'
          ),
          L(
            'LK-30177',
            '14 set 2026',
            1,
            'Para o imposto de renda tenho que ligar no banco. Absurdo em 2026.',
            'App iOS'
          ),
          L('LK-29934', '9 set 2026', 2, 'Por que no site eu vejo mais e no app não?')
        ]
      },
      {
        id: 'busca-nao-encontra',
        titulo: 'A busca não encontra o lançamento',
        resumo:
          'Buscar pelo nome da loja não traz resultado quando o lançamento aparece com outro nome.',
        tela: 'Busca',
        categoria: 'busca',
        total: 744,
        tendencia: 8,
        ruim: 0.7,
        evidencias: [
          L('LK-30044', '11 set 2026', 2, 'Procuro pelo nome da loja e não acha nada.', 'App iOS'),
          L(
            'LK-29711',
            '4 set 2026',
            2,
            'A busca só funciona se eu digitar exatamente igual ao extrato.'
          )
        ]
      },
      {
        id: 'nomes-desconhecidos',
        titulo: 'Lançamentos com nomes que não reconheço',
        resumo: 'Descrições como “PG *XPTO 3321” geram desconfiança e ligações de contestação.',
        tela: 'Detalhe',
        categoria: 'busca',
        total: 612,
        tendencia: 3,
        ruim: 0.6,
        evidencias: [
          L('LK-29540', '1 set 2026', 2, 'Aparece “PG *XPTO 3321” e eu não sei o que é.')
        ]
      },
      {
        id: 'saldo-confuso',
        titulo: 'Saldo do dia confunde com saldo disponível',
        resumo: 'Dois saldos lado a lado, sem explicação da diferença.',
        tela: 'Extrato',
        categoria: 'lista',
        total: 455,
        tendencia: -2,
        ruim: 0.52,
        evidencias: [
          L(
            'LK-29102',
            '25 ago 2026',
            3,
            'Nunca sei qual dos dois saldos é o que eu posso usar.',
            'App iOS'
          )
        ]
      },
      {
        id: 'exportar-escondido',
        titulo: 'Exportar em PDF fica escondido',
        resumo: 'A opção de exportar está num menu de três pontos que pouca gente abre.',
        tela: 'Exportar',
        categoria: 'exportar',
        total: 301,
        tendencia: 5,
        ruim: 0.36,
        evidencias: [
          L('LK-28870', '19 ago 2026', 3, 'Demorei para descobrir que dava para exportar.')
        ]
      },
      {
        id: 'extrato-demora',
        titulo: 'O extrato demora para carregar',
        resumo:
          'Abrir o extrato leva segundos com a tela em branco, principalmente no começo do mês.',
        tela: 'Extrato',
        categoria: 'lista',
        total: 268,
        tendencia: 6,
        ruim: 0.55,
        evidencias: [
          L('LK-30290', '17 set 2026', 2, 'Todo dia 1º o extrato fica carregando um tempão.')
        ]
      },
      {
        id: 'filtro-entradas',
        titulo: 'Queria filtrar só entradas ou só saídas',
        resumo: 'Não há como separar o que entrou do que saiu sem rolar a lista inteira.',
        tela: 'Busca',
        categoria: 'busca',
        total: 190,
        tendencia: 2,
        ruim: 0.3,
        evidencias: [
          L(
            'LK-29380',
            '29 ago 2026',
            3,
            'Só queria ver o que entrou na conta este mês.',
            'App iOS'
          )
        ]
      },
      {
        id: 'modo-escuro-ilegivel',
        titulo: 'O extrato fica ilegível no modo escuro',
        resumo: 'Valores negativos em vermelho somem sobre o fundo escuro.',
        tela: null,
        categoria: 'lista',
        total: 84,
        tendencia: -1,
        ruim: 0.4,
        evidencias: [
          L('LK-29950', '10 set 2026', 2, 'No modo escuro mal dá para ler os valores em vermelho.')
        ]
      }
    ]
  },
  'extrato/voz': {
    volume: 4870,
    temas: [
      {
        id: 'comprovante-antigo',
        titulo: 'Preciso de um comprovante de Pix de mais de 90 dias',
        resumo: 'Cliente liga para pedir comprovantes antigos que o app não alcança.',
        tela: 'Comprovante',
        categoria: 'historico',
        total: 1106,
        tendencia: 17,
        rechamada: 21,
        motivo: 'Segunda via de comprovante',
        evidencias: [
          V('VC-61204', '22 set 2026, 09:51', '5 min 40 s', false, [
            T(
              '00:19',
              'Cliente',
              'O condomínio diz que não recebeu o Pix de abril e eu preciso do comprovante.'
            ),
            T('00:44', 'Cliente', 'No app só vai até julho. Onde eu acho o de abril?'),
            T('01:10', 'Atendente', 'Consigo enviar por e-mail em até dois dias úteis.')
          ]),
          V('VC-60871', '18 set 2026, 17:26', '4 min 12 s', true, [
            T('00:37', 'Cliente', 'Já liguei semana passada e o comprovante não chegou.')
          ])
        ]
      },
      {
        id: 'lancamento-duplicado',
        titulo: 'Lançamento duplicado no extrato',
        resumo: 'Compras aparecem duas vezes enquanto uma delas ainda está pendente.',
        tela: 'Extrato',
        categoria: 'lista',
        total: 623,
        tendencia: 9,
        rechamada: 16,
        motivo: 'Lançamento duplicado',
        evidencias: [
          V('VC-60455', '15 set 2026, 12:08', '6 min 01 s', false, [
            T('00:26', 'Cliente', 'Paguei uma vez e aparece duas no extrato. Fui cobrado em dobro?')
          ])
        ]
      },
      {
        id: 'compra-desconhecida',
        titulo: 'Não reconheço uma compra',
        resumo:
          'Descrição do lançamento não identifica a loja; o cliente liga achando que é fraude.',
        tela: 'Detalhe',
        categoria: 'busca',
        total: 588,
        tendencia: 4,
        rechamada: 9,
        motivo: 'Contestação de compra',
        evidencias: [
          V('VC-60102', '12 set 2026, 19:44', '7 min 30 s', false, [
            T(
              '00:51',
              'Cliente',
              'Tem um débito de 89 reais com um nome estranho. Eu não fiz essa compra.'
            )
          ])
        ]
      },
      {
        id: 'extrato-anual',
        titulo: 'Extrato anual para o imposto de renda',
        resumo: 'Pedido de extrato consolidado do ano, que o app não gera.',
        tela: 'Exportar',
        categoria: 'exportar',
        total: 402,
        tendencia: 2,
        rechamada: 7,
        motivo: 'Informe e extrato anual',
        evidencias: [
          V('VC-59870', '9 set 2026, 10:15', '4 min 55 s', false, [
            T('00:40', 'Cliente', 'Meu contador pediu o extrato do ano todo. O app não deixa.')
          ])
        ]
      },
      {
        id: 'tarifa-sem-aviso',
        titulo: 'Tarifa cobrada sem aviso',
        resumo: 'Tarifa de pacote aparece no extrato sem explicação.',
        tela: 'Extrato',
        categoria: 'lista',
        total: 277,
        tendencia: 0,
        rechamada: 5,
        motivo: 'Tarifas',
        evidencias: [
          V('VC-59433', '3 set 2026, 14:22', '3 min 48 s', false, [
            T('00:29', 'Cliente', 'Apareceu uma tarifa de 39,90 que eu não sei de onde veio.')
          ])
        ]
      },
      {
        id: 'saldo-bloqueado',
        titulo: 'Parte do saldo aparece bloqueada sem explicação',
        resumo: 'Valores reservados por compras pendentes reduzem o saldo sem aviso.',
        tela: 'Extrato',
        categoria: 'lista',
        total: 214,
        tendencia: 5,
        rechamada: 12,
        motivo: 'Saldo bloqueado',
        evidencias: [
          V('VC-60730', '17 set 2026, 11:37', '5 min 10 s', true, [
            T(
              '00:21',
              'Cliente',
              'Tenho mil reais na conta mas só posso usar oitocentos. Cadê o resto?'
            )
          ])
        ]
      },
      {
        id: 'estorno-nao-aparece',
        titulo: 'O estorno da compra não aparece no extrato',
        resumo: 'A loja diz que estornou, e o extrato não mostra o crédito.',
        tela: 'Detalhe',
        categoria: 'busca',
        total: 176,
        tendencia: 8,
        rechamada: 14,
        motivo: 'Estorno de compra',
        evidencias: [
          V('VC-60321', '14 set 2026, 16:58', '6 min 22 s', true, [
            T(
              '00:44',
              'Cliente',
              'A loja me mandou o comprovante do estorno e no meu extrato não aparece nada.'
            )
          ])
        ]
      },
      {
        id: 'informe-rendimentos',
        titulo: 'Não acho o informe de rendimentos',
        resumo: 'O informe existe, mas fica em outro menu que o cliente não associa ao extrato.',
        tela: null,
        categoria: 'exportar',
        total: 131,
        tendencia: -4,
        rechamada: 6,
        motivo: 'Informe de rendimentos',
        evidencias: [
          V('VC-59612', '5 set 2026, 09:20', '3 min 15 s', false, [
            T(
              '00:17',
              'Cliente',
              'Onde fica o informe de rendimentos? Procurei no extrato e não achei.'
            )
          ])
        ]
      }
    ]
  },
  'extrato/fullstory': {
    volume: 212400,
    temas: [
      {
        id: 'dead-rotulo-90-dias',
        titulo: 'Dead click no rótulo “Últimos 90 dias”',
        resumo:
          'O rótulo parece um filtro, mas não é tocável. Clientes tocam esperando trocar o período.',
        tela: 'Período',
        categoria: 'historico',
        total: 8410,
        tendencia: 15,
        sinal: 'Dead click',
        elemento: 'Rótulo “Últimos 90 dias”',
        evidencias: [
          F(
            'FS-91450',
            '25 set 2026',
            'Android · app 8.42',
            '00:06',
            '3 toques no rótulo; rola até o fim da lista.'
          ),
          F(
            'FS-91022',
            '21 set 2026',
            'iOS · app 8.42',
            '00:11',
            '2 toques; abre a busca e digita “abril”.'
          )
        ]
      },
      {
        id: 'rage-carregar-mais',
        titulo: 'Rage click em “Carregar mais”',
        resumo: 'O fim da lista demora a carregar e o cliente toca repetidamente.',
        tela: 'Extrato',
        categoria: 'lista',
        total: 3902,
        tendencia: 10,
        sinal: 'Rage click',
        elemento: 'Botão “Carregar mais”',
        evidencias: [
          F('FS-90877', '20 set 2026', 'Android · app 8.42', '00:52', '7 toques em 4 segundos.')
        ]
      },
      {
        id: 'error-exportar-pdf',
        titulo: 'Error click em “Exportar PDF”',
        resumo: 'A exportação falha para períodos com muitos lançamentos.',
        tela: 'Exportar',
        categoria: 'exportar',
        total: 1211,
        tendencia: 3,
        sinal: 'Error click',
        elemento: 'Botão “Exportar PDF”',
        evidencias: [
          F(
            'FS-90231',
            '16 set 2026',
            'Internet banking · Chrome',
            '00:44',
            'Mensagem de erro genérica; tenta de novo.'
          )
        ]
      },
      {
        id: 'abandono-busca',
        titulo: 'Abandono da busca depois de duas tentativas',
        resumo:
          'Clientes desistem da busca quando a primeira e a segunda tentativa não trazem nada.',
        tela: 'Busca',
        categoria: 'busca',
        total: 980,
        tendencia: 6,
        sinal: 'Abandono de formulário',
        elemento: 'Campo de busca',
        evidencias: [
          F(
            'FS-89904',
            '13 set 2026',
            'iOS · app 8.41',
            '00:37',
            'Busca “mercado”, depois “super”, e fecha.'
          )
        ]
      },
      {
        id: 'cursor-detalhe',
        titulo: 'Cursor agitado no detalhe do lançamento',
        resumo: 'No internet banking, o cursor percorre o detalhe procurando o nome da loja.',
        tela: 'Detalhe',
        categoria: 'busca',
        total: 402,
        tendencia: -1,
        sinal: 'Cursor agitado',
        elemento: 'Bloco “Estabelecimento”',
        evidencias: [
          F(
            'FS-89510',
            '10 set 2026',
            'Internet banking · Edge',
            '00:58',
            '9 segundos sobre o bloco, sem clique.'
          )
        ]
      },
      {
        id: 'dead-icone-categoria',
        titulo: 'Dead click no ícone de categoria do lançamento',
        resumo:
          'O ícone colorido ao lado do lançamento parece abrir a categoria, mas não faz nada.',
        tela: 'Extrato',
        categoria: 'lista',
        total: 640,
        tendencia: 2,
        sinal: 'Dead click',
        elemento: 'Ícone de categoria',
        evidencias: [
          F(
            'FS-90512',
            '18 set 2026',
            'iOS · app 8.42',
            '00:24',
            '2 toques no ícone; abre o detalhe pelo valor.'
          )
        ]
      },
      {
        id: 'rage-filtro-data',
        titulo: 'Rage click no filtro de data',
        resumo: 'O campo de data inicial recusa datas além de 90 dias sem explicar.',
        tela: 'Período',
        categoria: 'historico',
        total: 515,
        tendencia: 7,
        sinal: 'Rage click',
        elemento: 'Campo “Data inicial”',
        evidencias: [
          F(
            'FS-90633',
            '19 set 2026',
            'Internet banking · Chrome',
            '01:03',
            '6 cliques no campo; a data volta para 90 dias atrás.'
          )
        ]
      },
      {
        id: 'abandono-formato-exportar',
        titulo: 'Abandono na escolha do formato de exportação',
        resumo: 'Três formatos sem explicação fazem o cliente desistir de exportar.',
        tela: 'Exportar',
        categoria: 'exportar',
        total: 288,
        tendencia: 1,
        sinal: 'Abandono de formulário',
        elemento: 'Seletor “Formato”',
        evidencias: [
          F(
            'FS-89770',
            '12 set 2026',
            'Internet banking · Edge',
            '00:41',
            'Abre o seletor, alterna entre OFX e CSV, e fecha.'
          )
        ]
      }
    ]
  },
  'pix/likert': {
    volume: 22480,
    ruim: 0.19,
    temas: [
      {
        id: 'agendado-falha',
        titulo: 'O Pix agendado falha e ninguém me avisa',
        resumo:
          'Quando falta saldo no dia, o agendamento não acontece e o cliente só descobre depois.',
        tela: 'Agendados',
        categoria: 'agendamentos',
        total: 864,
        tendencia: 19,
        ruim: 0.83,
        evidencias: [
          L(
            'LK-40211',
            '21 set 2026',
            1,
            'Agendei o aluguel, faltou saldo e o app não avisou. Paguei multa.'
          ),
          L('LK-39874', '14 set 2026', 2, 'Queria uma notificação no dia anterior.', 'App iOS')
        ]
      },
      {
        id: 'limite-noturno',
        titulo: 'O limite noturno é confuso',
        resumo: 'O cliente não sabe a partir de que horas vale o limite reduzido.',
        tela: 'Valor',
        categoria: 'limites',
        total: 512,
        tendencia: 6,
        ruim: 0.62,
        evidencias: [
          L('LK-39502', '7 set 2026', 2, 'Às 20h01 meu Pix não passou. Ninguém explica o horário.')
        ]
      },
      {
        id: 'chaves-demais',
        titulo: 'Tenho chaves demais e não sei qual usar',
        resumo: 'Gerenciar várias chaves é confuso; clientes não sabem qual compartilhar.',
        tela: 'Minhas chaves',
        categoria: 'chaves',
        total: 301,
        tendencia: 2,
        ruim: 0.31,
        evidencias: [
          L(
            'LK-39020',
            '28 ago 2026',
            3,
            'Tenho CPF, celular, e-mail e aleatória. Qual eu passo?',
            'App iOS'
          )
        ]
      },
      {
        id: 'qr-nao-le',
        titulo: 'A câmera não lê o QR Code de primeira',
        resumo: 'Ler um QR Code impresso exige várias tentativas e aproximações.',
        tela: 'Área Pix',
        categoria: 'chaves',
        total: 276,
        tendencia: 5,
        ruim: 0.55,
        evidencias: [
          L(
            'LK-39711',
            '11 set 2026',
            2,
            'Tenho que afastar e aproximar o celular umas cinco vezes para ler o QR.'
          )
        ]
      },
      {
        id: 'comprovante-whatsapp',
        titulo: 'Quero mandar o comprovante direto pelo WhatsApp',
        resumo: 'Compartilhar o comprovante exige salvar a imagem antes.',
        tela: 'Confirmar',
        categoria: 'comprovantes',
        total: 198,
        tendencia: 11,
        ruim: 0.3,
        evidencias: [
          L(
            'LK-40055',
            '18 set 2026',
            3,
            'Todo Pix eu salvo o print para mandar no WhatsApp. Podia ter um botão.',
            'App iOS'
          )
        ]
      },
      {
        id: 'pix-demora-concluir',
        titulo: 'O Pix demora para aparecer como concluído',
        resumo: 'O status fica em processamento por segundos que parecem minutos.',
        tela: null,
        categoria: 'agendamentos',
        total: 143,
        tendencia: -2,
        ruim: 0.42,
        evidencias: [
          L(
            'LK-39388',
            '5 set 2026',
            2,
            'Fiquei olhando a tela de processando e achei que tinha dado erro.'
          )
        ]
      }
    ]
  },
  'pix/voz': {
    volume: 6112,
    temas: [
      {
        id: 'pix-pessoa-errada',
        titulo: 'Fiz um Pix para a pessoa errada, como devolvo?',
        resumo: 'Cliente não encontra o caminho de pedido de devolução no app.',
        tela: 'Confirmar',
        categoria: 'seguranca',
        total: 932,
        tendencia: 11,
        rechamada: 27,
        motivo: 'Devolução de Pix',
        evidencias: [
          V('VC-70110', '25 set 2026, 08:33', '6 min 20 s', true, [
            T('00:15', 'Cliente', 'Colei a chave errada e o Pix foi. Como eu peço de volta?')
          ])
        ]
      },
      {
        id: 'golpe-pix',
        titulo: 'Caí num golpe e quero cancelar o Pix',
        resumo: 'Ligações urgentes de clientes que fizeram Pix para golpistas.',
        tela: 'Confirmar',
        categoria: 'seguranca',
        total: 710,
        tendencia: 8,
        rechamada: 14,
        motivo: 'Golpe',
        evidencias: [
          V('VC-69871', '22 set 2026, 21:12', '9 min 02 s', false, [
            T(
              '00:22',
              'Cliente',
              'Me pediram um Pix dizendo que era do banco. Quero cancelar agora.'
            )
          ])
        ]
      },
      {
        id: 'agendado-nao-feito',
        titulo: 'O Pix agendado não foi feito',
        resumo: 'Cliente descobre pelo recebedor que o agendamento falhou.',
        tela: 'Agendados',
        categoria: 'agendamentos',
        total: 455,
        tendencia: 13,
        rechamada: 10,
        motivo: 'Agendamento',
        evidencias: [
          V('VC-69440', '18 set 2026, 10:40', '4 min 18 s', false, [
            T('00:30', 'Cliente', 'O dono do imóvel disse que o Pix não caiu. Estava agendado.')
          ])
        ]
      },
      {
        id: 'aumentar-limite',
        titulo: 'Quero aumentar meu limite de Pix',
        resumo: 'O ajuste de limite existe no app, mas o cliente não o encontra.',
        tela: 'Valor',
        categoria: 'limites',
        total: 301,
        tendencia: 4,
        rechamada: 8,
        motivo: 'Limite de Pix',
        evidencias: [
          V('VC-69120', '15 set 2026, 13:05', '3 min 58 s', false, [
            T('00:18', 'Cliente', 'Preciso mandar oito mil hoje e o app não deixa. Como aumento?')
          ])
        ]
      },
      {
        id: 'chave-outro-banco',
        titulo: 'Minha chave está presa em outro banco',
        resumo: 'A portabilidade da chave não é explicada, e o cliente não consegue cadastrá-la.',
        tela: 'Minhas chaves',
        categoria: 'chaves',
        total: 212,
        tendencia: 2,
        rechamada: 18,
        motivo: 'Portabilidade de chave',
        evidencias: [
          V('VC-68930', '12 set 2026, 17:44', '5 min 33 s', true, [
            T(
              '00:41',
              'Cliente',
              'Diz que meu celular já é chave em outro banco. Eu nem uso mais aquele banco.'
            )
          ])
        ]
      },
      {
        id: 'devolucao-demora',
        titulo: 'A devolução do Pix ainda não caiu',
        resumo: 'Depois de pedir a devolução, o cliente não sabe em quanto tempo o dinheiro volta.',
        tela: null,
        categoria: 'seguranca',
        total: 167,
        tendencia: 6,
        rechamada: 22,
        motivo: 'Devolução em andamento',
        evidencias: [
          V('VC-69605', '20 set 2026, 09:12', '4 min 47 s', true, [
            T(
              '00:26',
              'Cliente',
              'Pedi a devolução há cinco dias e ninguém me diz quando o dinheiro volta.'
            )
          ])
        ]
      }
    ]
  },
  'pix/fullstory': {
    volume: 301800,
    temas: [
      {
        id: 'rage-colar-chave',
        titulo: 'Rage click em “Colar chave”',
        resumo: 'O botão de colar não reage quando a área de transferência tem espaços extras.',
        tela: 'Colar chave',
        categoria: 'chaves',
        total: 5120,
        tendencia: 21,
        sinal: 'Rage click',
        elemento: 'Botão “Colar”',
        evidencias: [
          F(
            'FS-95510',
            '26 set 2026',
            'Android · app 8.42',
            '00:12',
            '8 toques; digita a chave à mão.'
          )
        ]
      },
      {
        id: 'dead-qr-salvo',
        titulo: 'Dead click no QR Code salvo',
        resumo: 'A miniatura do QR Code salvo parece tocável, mas não abre.',
        tela: 'Área Pix',
        categoria: 'chaves',
        total: 2230,
        tendencia: 5,
        sinal: 'Dead click',
        elemento: 'Miniatura do QR Code',
        evidencias: [
          F('FS-95002', '20 set 2026', 'iOS · app 8.42', '00:21', '3 toques na miniatura.')
        ]
      },
      {
        id: 'abandono-acima-limite',
        titulo: 'Abandono na confirmação acima do limite',
        resumo: 'A mensagem de limite aparece só na confirmação e o cliente desiste.',
        tela: 'Confirmar',
        categoria: 'limites',
        total: 1140,
        tendencia: 4,
        sinal: 'Abandono de formulário',
        elemento: 'Aviso “Limite excedido”',
        evidencias: [
          F('FS-94471', '15 set 2026', 'Android · app 8.41', '00:48', 'Lê o aviso e fecha o app.')
        ]
      },
      {
        id: 'error-agendar',
        titulo: 'Error click em “Agendar”',
        resumo: 'Agendar para um feriado falha com uma mensagem genérica.',
        tela: 'Agendados',
        categoria: 'agendamentos',
        total: 860,
        tendencia: 9,
        sinal: 'Error click',
        elemento: 'Botão “Agendar”',
        evidencias: [
          F(
            'FS-94812',
            '17 set 2026',
            'iOS · app 8.42',
            '00:35',
            'Erro ao agendar para 12 de outubro; tenta outra data.'
          )
        ]
      },
      {
        id: 'cursor-campo-valor',
        titulo: 'Cursor agitado no campo de valor',
        resumo: 'No internet banking, o cursor hesita sobre o valor antes do limite aparecer.',
        tela: 'Valor',
        categoria: 'limites',
        total: 410,
        tendencia: 1,
        sinal: 'Cursor agitado',
        elemento: 'Campo “Valor”',
        evidencias: [
          F(
            'FS-94233',
            '13 set 2026',
            'Internet banking · Chrome',
            '00:57',
            '11 segundos de movimento sobre o campo, sem clique.'
          )
        ]
      },
      {
        id: 'dead-favoritos',
        titulo: 'Dead click na lista de favoritos',
        resumo: 'Tocar no nome de um favorito não preenche a chave.',
        tela: 'Área Pix',
        categoria: 'chaves',
        total: 335,
        tendencia: -2,
        sinal: 'Dead click',
        elemento: 'Contato favorito',
        evidencias: [
          F(
            'FS-94055',
            '11 set 2026',
            'Android · app 8.41',
            '00:14',
            '2 toques no nome; procura a chave na agenda.'
          )
        ]
      }
    ]
  }
}

/* ------------------------------------------------------------------------ */

function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** "12 set 2026" ou "23 set 2026, 10:42" → dias antes do fim do período do protótipo. */
function diasAtrasDe(data) {
  const [dia, mes, ano] = data.split(',')[0].trim().split(' ')
  const quando = Date.UTC(Number(ano), MESES[mes], Number(dia))
  return Math.max(0, Math.min(89, Math.round((FIM_PROTOTIPO - quando) / 86400000)))
}

/**
 * A série semanal de um tema (13 semanas, a mais antiga primeiro), somando
 * `total`. A forma é a do protótipo (`graficos.js`): uma rampa pela tendência
 * mais duas senoides de ruído, determinísticas pelo id. O fator 1,6 compensa a
 * leitura da skill (6 últimas sobre 6 primeiras), para a tendência medida
 * ficar perto da do protótipo.
 */
function serie(id, total, tendencia) {
  const t = (tendencia / 100) * 1.6
  const h = hash(id)
  const pesos = []
  for (let i = 0; i < SEMANAS; i += 1) {
    const base = 1 - t / 2 + t * (i / (SEMANAS - 1))
    pesos.push(
      Math.max(
        0.25,
        base + 0.07 * Math.sin(i * 1.3 + (h % 11)) + 0.04 * Math.sin(i * 2.9 + (h % 5))
      )
    )
  }
  const soma = pesos.reduce((a, b) => a + b, 0)
  const valores = pesos.map((p) => Math.round((total * p) / soma))
  valores[SEMANAS - 1] += total - valores.reduce((a, b) => a + b, 0)
  return valores
}

/** O dia, dentro da semana `i`, de uma linha (determinístico). */
function diaDaSemana(i, chave) {
  return Math.min(89, (SEMANAS - 1 - i) * 7 + (hash(chave) % 7))
}

const CANAIS = ['App Android', 'App iOS', 'Internet banking']
const DISPOSITIVOS = [
  'Android · app 8.42',
  'iOS · app 8.42',
  'Android · app 8.41',
  'Internet banking · Chrome'
]

function linhasLikert(prefixo, tema, semanal) {
  const linhas = []
  semanal.forEach((w, i) => {
    const ruim = Math.round(w * tema.ruim)
    const partes = [
      [ruim, i % 2 === 0 ? 1 : 2],
      [w - ruim, i % 2 === 0 ? 3 : 4]
    ]
    partes.forEach(([peso, nota], k) => {
      if (peso <= 0) return
      const chave = `${tema.id}:${i}:${k}`
      linhas.push({
        id: `${prefixo}-${tema.id}-${i}${k}`,
        diasAtras: diaDaSemana(i, chave),
        tema: tema.id,
        peso,
        nota,
        canal: CANAIS[hash(chave) % CANAIS.length],
        perfil: 'Pessoa física'
      })
    })
  })
  for (const e of tema.evidencias) {
    linhas.push({
      id: e.id,
      diasAtras: diasAtrasDe(e.data),
      tema: tema.id,
      peso: 1,
      nota: e.nota,
      canal: e.canal,
      perfil: e.perfil,
      texto: e.texto
    })
  }
  return linhas
}

function linhasVoz(prefixo, tema, semanal) {
  const linhas = []
  semanal.forEach((w, i) => {
    const rech = Math.round((w * tema.rechamada) / 100)
    ;[
      [rech, true],
      [w - rech, false]
    ].forEach(([peso, rechamada], k) => {
      if (peso <= 0) return
      linhas.push({
        id: `${prefixo}-${tema.id}-${i}${k}`,
        diasAtras: diaDaSemana(i, `${tema.id}:${i}:${k}`),
        tema: tema.id,
        peso,
        rechamada
      })
    })
  })
  for (const e of tema.evidencias) {
    linhas.push({
      id: e.id,
      diasAtras: diasAtrasDe(e.data),
      tema: tema.id,
      peso: 1,
      rechamada: e.rechamada,
      hora: e.data.split(',')[1].trim(),
      duracao: e.duracao,
      trechos: e.trechos
    })
  }
  return linhas
}

function linhasFullStory(prefixo, tema, semanal) {
  const linhas = semanal
    .map((w, i) => ({
      id: `${prefixo}-${tema.id}-${i}`,
      diasAtras: diaDaSemana(i, `${tema.id}:${i}`),
      tema: tema.id,
      peso: w,
      dispositivo: DISPOSITIVOS[hash(`${tema.id}:${i}`) % DISPOSITIVOS.length]
    }))
    .filter((linha) => linha.peso > 0)
  for (const e of tema.evidencias) {
    linhas.push({
      id: e.id,
      diasAtras: diasAtrasDe(e.data),
      tema: tema.id,
      peso: 1,
      dispositivo: e.dispositivo,
      momento: e.momento,
      detalhe: e.detalhe
    })
  }
  return linhas
}

/**
 * As linhas que não falam de nenhuma Dor (`tema: null`): o resto do volume da
 * Fonte. No Likert carregam a distribuição das notas, para que a parte de
 * notas 1 e 2 no período inteiro chegue à do protótipo.
 */
function linhasSemTema(prefixo, fonte, spec, temaLinhas) {
  const usado = temaLinhas.reduce((soma, linha) => soma + linha.peso, 0)
  const resto = Math.max(0, spec.volume - usado)
  const porSemana = serie(`${prefixo}:resto`, resto, 0)
  if (fonte !== 'likert') {
    return porSemana.map((peso, i) => ({
      id: `${prefixo}-geral-${i}`,
      diasAtras: diaDaSemana(i, `${prefixo}:resto:${i}`),
      tema: null,
      peso,
      ...(fonte === 'voz'
        ? { rechamada: false }
        : { dispositivo: DISPOSITIVOS[i % DISPOSITIVOS.length] })
    }))
  }
  const ruimUsado = temaLinhas.filter((l) => l.nota <= 2).reduce((s, l) => s + l.peso, 0)
  const ruimResto =
    Math.max(0, Math.round(spec.ruim * spec.volume) - ruimUsado) / Math.max(1, resto)
  const linhas = []
  porSemana.forEach((w, i) => {
    const ruim = Math.round(w * ruimResto)
    const bom = w - ruim
    const partes = [
      [Math.round(ruim * 0.6), 1],
      [ruim - Math.round(ruim * 0.6), 2],
      [Math.round(bom * 0.2), 3],
      [Math.round(bom * 0.35), 4],
      [bom - Math.round(bom * 0.2) - Math.round(bom * 0.35), 5]
    ]
    partes.forEach(([peso, nota]) => {
      if (peso <= 0) return
      linhas.push({
        id: `${prefixo}-geral-${i}${nota}`,
        diasAtras: diaDaSemana(i, `${prefixo}:${i}:${nota}`),
        tema: null,
        peso,
        nota,
        canal: CANAIS[(i + nota) % CANAIS.length],
        perfil: 'Pessoa física'
      })
    })
  })
  return linhas
}

const PREFIXO = { likert: 'LK', voz: 'VC', fullstory: 'FS' }

function arquivoDeDados(produto, fonte) {
  const spec = DADOS[`${produto.id}/${fonte.id}`]
  const prefixo = `${PREFIXO[fonte.id]}-${produto.id}`
  const temaLinhas = spec.temas.flatMap((tema) => {
    const evidencias = tema.evidencias.length
    const semanal = serie(tema.id, tema.total - evidencias, tema.tendencia)
    if (fonte.id === 'likert') return linhasLikert(prefixo, tema, semanal)
    if (fonte.id === 'voz') return linhasVoz(prefixo, tema, semanal)
    return linhasFullStory(prefixo, tema, semanal)
  })
  const registros = [...temaLinhas, ...linhasSemTema(prefixo, fonte.id, spec, temaLinhas)].sort(
    (a, b) => b.diasAtras - a.diasAtras || a.id.localeCompare(b.id)
  )
  const temas = spec.temas.map((tema) => {
    const base = {
      id: tema.id,
      titulo: tema.titulo,
      resumo: tema.resumo,
      tela: tema.tela,
      categoria: tema.categoria
    }
    if (fonte.id === 'voz') return { ...base, motivo: tema.motivo }
    if (fonte.id === 'fullstory') return { ...base, sinal: tema.sinal, elemento: tema.elemento }
    return base
  })
  return {
    formato: 'dados-de-exemplo/1',
    produto: produto.nome,
    fonte: fonte.id,
    volume: registros.reduce((soma, linha) => soma + linha.peso, 0),
    categorias: CATEGORIAS[produto.id].map(([id, nome, padrao, sugestao]) => ({
      id,
      nome,
      padrao,
      sugestao
    })),
    temas,
    registros
  }
}

/**
 * Writes one file in the repository's own JSON style (Prettier), so a
 * regeneration produces the committed bytes and the commit hook has nothing
 * to rewrite.
 */
async function escrever(caminho, valor) {
  const destino = join(ROOT, caminho)
  mkdirSync(dirname(destino), { recursive: true })
  const config = (await prettier.resolveConfig(destino)) ?? {}
  const texto = await prettier.format(JSON.stringify(valor, null, 2), { ...config, parser: 'json' })
  writeFileSync(destino, texto, 'utf-8')
}

await escrever('catalogo.json', { formato: 'catalogo/1', produtos: PRODUTOS, fontes: FONTES })
for (const produto of PRODUTOS) {
  for (const fonte of FONTES) {
    await escrever(
      join('dados-de-exemplo', produto.id, `${fonte.id}.json`),
      arquivoDeDados(produto, fonte)
    )
  }
}
console.log(`dados de exemplo gravados em ${ROOT}`)
