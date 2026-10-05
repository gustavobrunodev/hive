import { createElement } from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { vi } from 'vitest'
import { DesignStudioShell } from '../DesignStudioShell'
import type { DesignPage, DesignRoute } from '../routes'
import type { DesignStudioStore } from '../useDesignStudio'
import type {
  Catalogo,
  DadosDoModulo,
  Dor,
  EventoDeGeracao,
  RelatorioDeFonte
} from '../relatorioModel'

/**
 * Design Studio renderer fixtures: the catalog the module ships with, a
 * Relatório de Fonte shaped like decision 4, a `window.hive` that answers like
 * main, and the module's work area rendered at one route. Under `__tests__/`
 * so coverage does not count it as module code.
 */

export const CATALOGO: Catalogo = {
  produtos: [
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
  ],
  fontes: [
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
}

export const VOLUMES: DadosDoModulo['volumes'] = {
  Câmbio: { likert: 6912, voz: 3205, fullstory: 48300 },
  Extrato: { likert: 18240, voz: 4870, fullstory: 212400 },
  Pix: { likert: 22480, voz: 6112, fullstory: 301800 }
}

type Fonte = RelatorioDeFonte['fonte']

const EVIDENCIA: Record<Fonte, Dor['evidencias'][number]> = {
  likert: {
    id: 'LK-30512',
    data: '2026-09-25',
    nota: 2,
    texto: 'Preciso ver um lançamento de março e o app só mostra 90 dias.',
    canal: 'App Android',
    perfil: 'Pessoa física'
  },
  voz: {
    id: 'VC-55120',
    data: '2026-09-23T10:42',
    duracao: '6 min 12 s',
    motivo: 'Estorno de remessa',
    rechamada: true,
    trechos: [
      { t: '00:14', quem: 'Cliente', texto: 'O dinheiro voltou para a conta.' },
      { t: '01:05', quem: 'Atendente', texto: 'O banco recusou o IBAN.' }
    ]
  },
  fullstory: {
    id: 'FS-88213',
    data: '2026-09-24',
    dispositivo: 'Android · app 8.42',
    tela: 'Confirmar',
    elemento: 'Botão “Confirmar remessa”',
    sinal: 'Rage click',
    momento: '00:47',
    detalhe: '9 toques em 3 segundos no botão desabilitado.'
  }
}

export interface DorSpec {
  titulo?: string
  tela?: string
  impacto?: Dor['impacto']
  volume?: number
  tendencia?: number
  categoria?: string
}

/**
 * A Relatório of `produto` × `fonte` with one Dor per spec, ranked in order.
 * Volumes fall by rank unless given; categories alternate between two.
 */
export function relatorio(
  produto: string,
  fonte: Fonte,
  specs: DorSpec[],
  overrides: Partial<RelatorioDeFonte> = {}
): RelatorioDeFonte {
  const arquivo = overrides.caminho ?? `${produto}/relatorios/${fonte}/2026-10-04-90d.md`
  const dores: Dor[] = specs.map((spec, i) => ({
    id: `${fonte}-${i + 1}`,
    rank: i + 1,
    titulo: spec.titulo ?? `${fonte} Dor ${i + 1}`,
    resumo: `Resumo da Dor ${i + 1} de ${fonte}.`,
    tela: spec.tela,
    categoria: spec.categoria ?? (i % 2 === 0 ? 'a' : 'b'),
    volume: spec.volume ?? 1000 - i * 100,
    impacto: spec.impacto ?? 'medio',
    tendencia: spec.tendencia ?? 10 - i * 4,
    semanas: Array.from({ length: 13 }, (_, w) => 10 + w + i),
    ...(fonte === 'voz' ? { rechamada: 38 - i } : {}),
    ...(fonte === 'fullstory' ? { sinal: 'Rage click' } : {}),
    evidencias: [EVIDENCIA[fonte]]
  }))
  return {
    caminho: arquivo,
    produto,
    fonte,
    periodo: { inicio: '2026-07-07', fim: '2026-10-04', dias: 90 },
    geradoEm: '2026-10-04T11:40:00.000Z',
    geradoPor: { agente: 'Claude', modelo: 'sonnet' },
    volume: VOLUMES[produto]?.[fonte] ?? 1000,
    destaque: `destaque de ${fonte} de ${produto}`,
    metodo: `Método de ${fonte}.`,
    dores,
    categorias: [
      {
        id: 'a',
        nome: 'Categoria A',
        volume: 600,
        participacao: 60,
        semanas: Array.from({ length: 13 }, (_, w) => 40 + w * 2),
        insight: 'Insight da categoria A.'
      },
      {
        id: 'b',
        nome: 'Categoria B',
        volume: 400,
        participacao: 40,
        semanas: Array.from({ length: 13 }, (_, w) => 30 - w),
        insight: 'Insight da categoria B.'
      }
    ],
    narrativa: ['Primeiro parágrafo da narrativa.', 'Segundo parágrafo da narrativa.'],
    ...overrides
  }
}

export interface Bridge {
  /** Fires one generation event at every `onGeracao` listener, as main would. */
  emit: (evento: EventoDeGeracao) => void
  dados: ReturnType<typeof vi.fn>
  relatorio: ReturnType<typeof vi.fn>
  planejarGeracao: ReturnType<typeof vi.fn>
  abandonarGeracao: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  /** Replaces what `dados()` answers from now on (a regeneration landed). */
  setRelatorios: (relatorios: RelatorioDeFonte[]) => void
}

/**
 * A `window.hive` for the module: `dados()` answers the catalog and the given
 * Relatórios; `planejarGeracao` plans like main (turn id, prompt naming the
 * skill, the Produto's scope); the agent defaults to Claude with a pin.
 */
export function stubBridge(
  options: {
    relatorios?: RelatorioDeFonte[]
    porCaminho?: Record<string, RelatorioDeFonte | null>
    hiveDefault?: string | null
    send?: () => Promise<void>
  } = {}
): Bridge {
  let relatorios = options.relatorios ?? []
  const listeners = new Set<(evento: EventoDeGeracao) => void>()
  let turno = 0
  const dados = vi.fn(async () => ({ catalogo: CATALOGO, relatorios, volumes: VOLUMES }))
  const relatorioFn = vi.fn(async (caminho: string) => options.porCaminho?.[caminho] ?? null)
  const planejarGeracao = vi.fn(
    async (pedido: { produto: string; fonte: Fonte; agente: { id: string } }) => {
      turno += 1
      return {
        ok: true as const,
        turnId: `turno-${turno}`,
        prompt: `Gere o Relatório com a skill "relatorio-${pedido.fonte}".`,
        scope: {
          cwd: `/docs/Design Studio/${pedido.produto}`,
          readRoots: ['/docs/Design Studio', '/recursos'],
          writeRoots: [`/docs/Design Studio/${pedido.produto}/relatorios`],
          commands: [`node "/recursos/skills/relatorio-${pedido.fonte}/scripts/relatorio.mjs"`]
        }
      }
    }
  )
  const abandonarGeracao = vi.fn(async () => undefined)
  const send = vi.fn(options.send ?? (async () => undefined))
  vi.stubGlobal('hive', {
    designStudio: {
      conversations: vi.fn(async () => []),
      dados,
      relatorio: relatorioFn,
      planejarGeracao,
      abandonarGeracao,
      geracaoAtual: vi.fn(async () => null),
      onGeracao: vi.fn((listener: (evento: EventoDeGeracao) => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      })
    },
    agent: {
      send,
      pins: vi.fn(async () => ({ 'claude-cli': { model: 'sonnet', effort: null } }))
    },
    profile: {
      getAgent: vi.fn(async () =>
        options.hiveDefault === undefined ? 'claude-cli' : options.hiveDefault
      ),
      agents: vi.fn(async () => [
        { id: 'claude-cli', available: true },
        { id: 'devin', available: true }
      ])
    }
  })
  return {
    emit: (evento) => {
      for (const listener of listeners) listener(evento)
    },
    dados,
    relatorio: relatorioFn,
    planejarGeracao,
    abandonarGeracao,
    send,
    setRelatorios: (next) => {
      relatorios = next
    }
  }
}

/** A navigation store standing at `route`, with only that page mounted. */
export function storeAt(route: DesignRoute, navigate = vi.fn()): DesignStudioStore {
  const pageRoutes: Partial<Record<DesignPage, DesignRoute>> = { [route.pagina]: route }
  return {
    route,
    navigate,
    mountedPages: [route.pagina],
    pageRoutes,
    conversations: [],
    loadedAt: 0
  }
}

/** The module's work area at `route`, the navigation hidden (so pages carry the seal). */
export function renderModule(route: DesignRoute, navigate = vi.fn()): RenderResult {
  return render(
    createElement(DesignStudioShell, {
      store: storeAt(route, navigate),
      userName: 'Marina',
      navVisible: false
    })
  )
}

/** The active page layer. */
export function activePage(): HTMLElement {
  const page = document.querySelector<HTMLElement>('[data-page][data-active]')
  if (!page) throw new Error('no active page')
  return page
}
