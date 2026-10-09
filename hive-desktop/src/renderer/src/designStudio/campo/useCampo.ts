import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type RefObject
} from 'react'
import { t } from '../../i18n'
import {
  useAttachments,
  type AttachmentEntry,
  type AttachmentsApi
} from '../../chat/useAttachments'
import { textoDoEnvio } from '../conversaModel'
import { fonteName, type ModuleAgent } from '../model'
import type { ModuleData } from '../moduleData'
import type { DorCitada, DorVisivel, RelatorioDeFonte } from '../relatorioModel'
import type { CampoId } from '../useRascunhos'
import { useArroba, type Arroba } from './useArroba'

/** What the field hands over on Enviar (criteria 5–9). */
export interface ParteDoEnvio {
  texto: string
  citadas: DorCitada[]
  anexos: Array<{ path: string; name: string }>
  relatoriosAnexados: Array<{ caminho: string; nome: string }>
  agente: ModuleAgent
}

export interface Campo {
  texto: string
  setTexto: (texto: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  attachments: AttachmentsApi
  relatorios: ReadonlyArray<{ caminho: string; nome: string }>
  citadas: readonly DorCitada[]
  /** Something besides text goes with the message — what lets an empty text send (criterion 5). */
  temContexto: boolean
  arroba: Arroba
  escolherDor: (dor: DorVisivel) => void
  anexarRelatorio: (relatorio: RelatorioDeFonte) => void
  tirarRelatorio: (caminho: string) => void
  colar: (event: ClipboardEvent<HTMLElement>) => void
  /** Sends what the field holds, then empties it. `false` when nothing went out. */
  enviar: (escrito: string, agente: ModuleAgent) => ParteDoEnvio | null
}

/** A pasted file: by its path when it has one (copied from disk), by its bytes otherwise (a print). */
async function anexoColado(file: File): Promise<AttachmentEntry | null> {
  const path = window.hive.fs.pathForFile(file)
  if (path !== '') return { path, name: file.name, size: file.size, kind: 'external' }
  if (!file.type.startsWith('image/')) return null
  const salvo = await window.hive.designStudio.colar(file.name, await file.arrayBuffer())
  return { path: salvo.path, name: salvo.name, size: salvo.size, kind: 'external' }
}

/**
 * The state of one chat field of the module: its text, its attachments (the
 * Hive's own `useAttachments`: picker and drag), the Relatórios attached from
 * the `+`, the Dores it cites (the module's drafts, so a citation made on
 * another page is here) and its `@`.
 */
export function useCampo(campo: CampoId, dados: ModuleData): Campo {
  const [texto, setTexto] = useState('')
  const [relatorios, setRelatorios] = useState<Array<{ caminho: string; nome: string }>>([])
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const attachments = useAttachments(true, '')
  const itensRef = useRef(attachments.items)
  useEffect(() => {
    itensRef.current = attachments.items
  }, [attachments.items])
  const arroba = useArroba(texto, setTexto, textareaRef)
  const { rascunhos } = dados
  const citadas = rascunhos.citadas(campo)
  const temContexto = citadas.length > 0 || attachments.items.length > 0 || relatorios.length > 0

  const escolherDor = useCallback(
    (visivel: DorVisivel) => {
      arroba.consumir()
      rascunhos.citar(campo, { relatorio: visivel.relatorio.caminho, dor: visivel.dor.id })
    },
    [arroba, rascunhos, campo]
  )

  const anexarRelatorio = useCallback((relatorio: RelatorioDeFonte) => {
    const nome = t(
      'designStudio.campo.relatorioAnexo',
      fonteName(relatorio.fonte),
      relatorio.produto
    )
    setRelatorios((atuais) =>
      atuais.some((r) => r.caminho === relatorio.caminho)
        ? atuais
        : [...atuais, { caminho: relatorio.caminho, nome }]
    )
  }, [])

  const tirarRelatorio = useCallback(
    (caminho: string) => setRelatorios((atuais) => atuais.filter((r) => r.caminho !== caminho)),
    []
  )

  const { replace } = attachments
  const colar = useCallback(
    (event: ClipboardEvent<HTMLElement>) => {
      const files = Array.from(event.clipboardData?.files ?? [])
      if (files.length === 0) return
      event.preventDefault()
      void Promise.all(files.map((file) => anexoColado(file).catch(() => null))).then((novos) => {
        const validos = novos.filter((entry): entry is AttachmentEntry => entry !== null)
        if (validos.length > 0) replace([...itensRef.current, ...validos])
      })
    },
    [replace]
  )

  const enviar = (escrito: string, agente: ModuleAgent): ParteDoEnvio | null => {
    const extras = attachments.items.length + relatorios.length
    const final = textoDoEnvio(escrito, citadas.length, extras)
    if (final === '') return null
    const parte: ParteDoEnvio = {
      texto: final,
      citadas: [...citadas],
      anexos: attachments.items.map((entry) => ({ path: entry.path, name: entry.name })),
      relatoriosAnexados: relatorios,
      agente
    }
    setTexto('')
    setRelatorios([])
    attachments.clear()
    rascunhos.limpar(campo)
    return parte
  }

  return {
    texto,
    setTexto,
    textareaRef,
    attachments,
    relatorios,
    citadas,
    temContexto,
    arroba,
    escolherDor,
    anexarRelatorio,
    tirarRelatorio,
    colar,
    enviar
  }
}
