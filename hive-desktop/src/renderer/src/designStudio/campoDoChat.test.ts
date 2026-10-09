// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { DictationE2EHarness } from '../dictation/e2eDictationSeam'
import type { Tick } from '../dictation/segmenter'
import { camada, prepararDom, relatorio, renderModuloVivo, stubBridge } from './__tests__/fixtures'

/**
 * The module's chat field (criteria 4–9 of task 1, `composer.js`), on the
 * home: the agent and its models, when Enviar may send, the `@` list, the
 * attachments of every kind, and dictation.
 *
 * Dictation runs the Hive's own pipeline here: the microphone is the E2E
 * seam's stand-in (jsdom has no audio), but the engine is the real client over
 * `window.hive.asr` — so what reaches the bridge, and what does not reach the
 * network, is the production path.
 */

vi.mock('../dictation/e2eDictationSeam', async (importActual) => {
  const actual = await importActual<typeof import('../dictation/e2eDictationSeam')>()
  return { ...actual, e2eDictationEngine: () => null }
})

beforeAll(prepararDom)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete (globalThis as { __hiveDictationE2E?: DictationE2EHarness }).__hiveDictationE2E
})

/** Twelve Dores of Câmbio over two Relatórios, impact and volume spelled out. */
const CAMBIO = [
  relatorio('Câmbio', 'likert', [
    { titulo: 'L alto 500', impacto: 'alto', volume: 500 },
    { titulo: 'L médio 900', impacto: 'medio', volume: 900 },
    { titulo: 'L baixo 990', impacto: 'baixo', volume: 990 },
    { titulo: 'L alto 300', impacto: 'alto', volume: 300 },
    { titulo: 'L médio 100', impacto: 'medio', volume: 100 },
    { titulo: 'L baixo 50', impacto: 'baixo', volume: 50 }
  ]),
  relatorio('Câmbio', 'voz', [
    { titulo: 'V alto 800', impacto: 'alto', volume: 800 },
    { titulo: 'V médio 700', impacto: 'medio', volume: 700 },
    { titulo: 'V baixo 600', impacto: 'baixo', volume: 600 },
    { titulo: 'V alto 100', impacto: 'alto', volume: 100 },
    { titulo: 'V médio 400', impacto: 'medio', volume: 400 },
    { titulo: 'V baixo 20', impacto: 'baixo', volume: 20 }
  ]),
  relatorio('Extrato', 'likert', [{ titulo: 'Dor do Extrato', impacto: 'alto' }])
]

async function abrir(relatorios = CAMBIO): Promise<ReturnType<typeof stubBridge>> {
  const bridge = stubBridge({ relatorios })
  renderModuloVivo()
  await screen.findByRole('heading', { level: 2, name: 'Dores em alta' })
  return bridge
}

const inicio = (): HTMLElement => camada('inicio')
const campo = (): HTMLTextAreaElement =>
  within(inicio()).getByRole('textbox', { name: 'Mensagem para o agente' }) as HTMLTextAreaElement
const enviar = (): HTMLButtonElement =>
  within(inicio()).getByRole('button', { name: 'Enviar' }) as HTMLButtonElement
const contexto = (): HTMLElement => inicio().querySelector('.ds-campo-contexto') as HTMLElement

function escrever(texto: string): void {
  fireEvent.change(campo(), { target: { value: texto } })
}

/** Radix opens a menu on a primary-button pointerdown. */
function abrirMenu(botao: HTMLElement): void {
  fireEvent.pointerDown(botao, { button: 0, ctrlKey: false, pointerType: 'mouse' })
}

async function escolherNoMais(item: string): Promise<void> {
  abrirMenu(within(inicio()).getByRole('button', { name: /^Adicionar arquivos/ }))
  fireEvent.click(await screen.findByRole('menuitem', { name: new RegExp(`^${item}`) }))
}

function nota(titulo: string): HTMLElement {
  const el = Array.from(inicio().querySelectorAll<HTMLElement>('.hds-note')).find(
    (n) => n.querySelector('.hds-note-title')?.textContent === titulo
  )
  if (!el) throw new Error(`no note "${titulo}"`)
  return el
}

/** The agent picker's trigger, by what it is called. */
const gatilhoDoAgente = (): HTMLElement =>
  within(inicio()).getByRole('button', { name: /^Agente da conversa:/ })
const gatilhoDoModelo = (): HTMLElement =>
  within(inicio()).getByRole('button', { name: /^Motor da conversa:/ })

function tick(rms: number): Tick {
  return { rms, samples: new Float32Array(16_000) }
}

function armarMicrofone(): DictationE2EHarness {
  const harness: DictationE2EHarness = { ticks: [], levels: [] }
  ;(globalThis as { __hiveDictationE2E?: DictationE2EHarness }).__hiveDictationE2E = harness
  return harness
}

/** A quiet tick seeds the noise floor, then speech, then the silence that cuts the phrase. */
async function falar(harness: DictationE2EHarness): Promise<void> {
  await act(async () => {
    for (const rms of [0.001, 0.5, 0.5, 0.001]) harness.ticks?.forEach((push) => push(tick(rms)))
  })
}

describe('the agent and its models', () => {
  it('1-C4a: lists only Claude and Devin, each with its logo and the models its capabilities() reports — never Copilot', async () => {
    const bridge = await abrir()
    await waitFor(() => expect(gatilhoDoAgente().textContent).toContain('Claude'))
    abrirMenu(gatilhoDoAgente())
    const itens = await screen.findAllByRole('menuitemradio')
    expect(itens.map((item) => item.textContent)).toEqual(['Claude', 'Devin'])
    for (const item of itens) expect(item.querySelector('svg')).not.toBeNull()
    expect(screen.queryByRole('menuitemradio', { name: /Copilot/ })).toBeNull()

    // Claude's models, from Claude's capabilities.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    fireEvent.click(gatilhoDoModelo())
    const claude = await screen.findByRole('listbox', { name: 'Escolher modelo' })
    expect(
      within(claude)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(
      expect.arrayContaining([expect.stringContaining('Sonnet'), expect.stringContaining('Opus')])
    )
    expect(within(claude).getAllByRole('option')).toHaveLength(2)
    fireEvent.keyDown(claude, { key: 'Escape' })

    // Devin's, from Devin's.
    abrirMenu(gatilhoDoAgente())
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /Devin/ }))
    await waitFor(() =>
      expect(bridge.campo.agent.capabilities).toHaveBeenCalledWith('devin', undefined)
    )
    await waitFor(() => expect(gatilhoDoModelo().textContent).toContain('SWE-1.5'))
    fireEvent.click(gatilhoDoModelo())
    const devin = await screen.findByRole('listbox', { name: 'Escolher modelo' })
    expect(
      within(devin)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('SWE-1.5'),
        expect.stringContaining('Adaptive')
      ])
    )
    expect(bridge.campo.agent.capabilities).not.toHaveBeenCalledWith('github-copilot', undefined)
  })

  it('1-C4b: choosing an agent and a model says "<Agente> <Modelo> vai responder"', async () => {
    await abrir()
    await waitFor(() => expect(gatilhoDoAgente().textContent).toContain('Claude'))
    abrirMenu(gatilhoDoAgente())
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /Devin/ }))
    expect(await screen.findByText('Devin SWE-1.5 vai responder')).toBeTruthy()

    fireEvent.click(gatilhoDoModelo())
    fireEvent.click(await screen.findByRole('option', { name: /Adaptive/ }))
    expect(await screen.findByText('Devin Adaptive vai responder')).toBeTruthy()
  })
})

describe('when Enviar may send', () => {
  it('1-C5a: with the field empty, no attachment and no Dor cited, Enviar is disabled and Enter does not send', async () => {
    const bridge = await abrir()
    expect(enviar().disabled).toBe(true)
    escrever('   ')
    expect(enviar().disabled).toBe(true)
    fireEvent.keyDown(campo(), { key: 'Enter' })
    await act(async () => {})
    expect(bridge.conversa.planejarConversa).not.toHaveBeenCalled()
  })

  it('1-C5b: while dictation is recording, Enviar is disabled even with text in the field', async () => {
    armarMicrofone()
    await abrir()
    escrever('Quero ver o extrato')
    await waitFor(() => expect(enviar().disabled).toBe(false))
    fireEvent.click(within(inicio()).getByRole('button', { name: 'Ditar' }))
    await within(inicio()).findByRole('button', { name: 'Concluir' })
    expect(enviar().disabled).toBe(true)
  })

  it('1-C5c: with only a Dor cited, or only an attachment, and no text, Enviar is enabled', async () => {
    const bridge = await abrir()
    fireEvent.click(nota('L alto 500'))
    await waitFor(() => expect(enviar().disabled).toBe(false))
    fireEvent.click(nota('L alto 500'))
    await waitFor(() => expect(enviar().disabled).toBe(true))

    bridge.campo.agent.chooseAttachments = vi.fn(async () => [
      { path: '/Downloads/print.png', name: 'print.png', size: 2048 }
    ])
    await escolherNoMais('Anexar arquivos')
    await within(inicio()).findByText('print.png')
    expect(enviar().disabled).toBe(false)
  })
})

describe('the @ list', () => {
  it('1-C6a: typing @ opens at most 9 Dores of the Produto, by impact and, on a tie, by volume', async () => {
    await abrir()
    escrever('@')
    const lista = await within(inicio()).findByRole('listbox', { name: 'Dores de Câmbio' })
    expect(
      within(lista)
        .getAllByRole('option')
        .map((o) => o.querySelector('b')?.textContent)
    ).toEqual([
      'V alto 800',
      'L alto 500',
      'L alto 300',
      'V alto 100',
      'L médio 900',
      'V médio 700',
      'V médio 400',
      'L médio 100',
      'L baixo 990'
    ])
  })

  it('1-C6b: choosing a Dor puts its chip in the field, and the chip’s × takes the citation out', async () => {
    await abrir()
    escrever('Olhe @')
    const lista = await within(inicio()).findByRole('listbox', { name: 'Dores de Câmbio' })
    fireEvent.click(within(lista).getAllByRole('option')[0])
    await waitFor(() => expect(contexto()).not.toBeNull())
    expect(within(contexto()).getByText('V alto 800')).toBeTruthy()
    expect(campo().value).toBe('Olhe ')
    expect(within(inicio()).queryByRole('listbox')).toBeNull()

    fireEvent.click(
      within(contexto()).getByRole('button', { name: 'Tirar a citação de “V alto 800”' })
    )
    await waitFor(() => expect(inicio().querySelector('.ds-campo-contexto')).toBeNull())
  })

  it('1-C6b: the keyboard picks from the list too — arrows move, Enter chooses without sending', async () => {
    const bridge = await abrir()
    escrever('@')
    await within(inicio()).findByRole('listbox', { name: 'Dores de Câmbio' })
    fireEvent.keyDown(campo(), { key: 'ArrowDown' })
    fireEvent.keyDown(campo(), { key: 'Enter' })
    await waitFor(() => expect(contexto()).not.toBeNull())
    expect(within(contexto()).getByText('L alto 500')).toBeTruthy()
    expect(bridge.conversa.planejarConversa).not.toHaveBeenCalled()
  })

  it('1-C6c: with no Relatório of the Produto, the list says "Ainda não há Relatórios de <Produto>."', async () => {
    await abrir()
    fireEvent.click(within(inicio()).getByRole('radio', { name: 'Pix' }))
    escrever('@')
    expect(await within(inicio()).findByText('Ainda não há Relatórios de Pix.')).toBeTruthy()
    expect(within(inicio()).queryByRole('option')).toBeNull()
  })
})

describe('attachments', () => {
  it('1-C7a: an image, a PDF and a .docx from the + menu each become an attachment with a remove button that takes it out', async () => {
    const bridge = await abrir()
    bridge.campo.agent.chooseAttachments = vi.fn(async () => [
      { path: '/Downloads/print.png', name: 'print.png', size: 2048 },
      { path: '/Downloads/prd.pdf', name: 'prd.pdf', size: 4096 },
      { path: '/Downloads/briefing.docx', name: 'briefing.docx', size: 8192 }
    ])
    await escolherNoMais('Anexar arquivos')
    // Each one a chip of its own (its name is split in two spans to keep the
    // extension in sight), each with its remove button.
    const chip = (nome: string): Element | null =>
      Array.from(contexto()?.querySelectorAll('.hds-attachment') ?? []).find(
        (el) => el.querySelector('.hds-attachment-name')?.textContent === nome
      ) ?? null
    await waitFor(() => expect(chip('briefing.docx')).not.toBeNull())
    for (const nome of ['print.png', 'prd.pdf', 'briefing.docx']) {
      expect(chip(nome)).not.toBeNull()
      expect(within(inicio()).getByRole('button', { name: `Remover anexo ${nome}` })).toBeTruthy()
    }
    fireEvent.click(within(inicio()).getByRole('button', { name: 'Remover anexo prd.pdf' }))
    await waitFor(() => expect(chip('prd.pdf')).toBeNull())
    expect(chip('print.png')).not.toBeNull()
    expect(chip('briefing.docx')).not.toBeNull()
  })

  it('1-C7b: dragging a file onto the field attaches it', async () => {
    const bridge = await abrir()
    const arquivo = new File(['x'], 'tela.png', { type: 'image/png' })
    bridge.campo.fs.pathForFile = vi.fn(() => '/Desktop/tela.png')
    const zona = inicio().querySelector('.ds-campo') as HTMLElement
    const dataTransfer = { types: ['Files'], files: [arquivo], dropEffect: 'none' }
    fireEvent.dragEnter(zona, { dataTransfer })
    fireEvent.dragOver(zona, { dataTransfer })
    fireEvent.drop(zona, { dataTransfer })
    expect(await within(inicio()).findByText('tela.png')).toBeTruthy()
  })

  it('1-C7c: Ctrl+V with an image on the clipboard attaches it', async () => {
    const bridge = await abrir()
    const print = new File([new Uint8Array([1, 2, 3])], 'image.png', { type: 'image/png' })
    fireEvent.paste(campo(), { clipboardData: { files: [print], types: ['Files'] } })
    expect(await within(inicio()).findByText('image.png')).toBeTruthy()
    expect(bridge.conversa.colar).toHaveBeenCalledWith('image.png', expect.any(ArrayBuffer))
  })

  it('1-C8a: "Anexar um Relatório de Fonte" lists the Relatórios already generated of the Produto', async () => {
    await abrir()
    abrirMenu(within(inicio()).getByRole('button', { name: /^Adicionar arquivos/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Anexar um Relatório de Fonte/ }))
    await screen.findByText('Relatórios de Fonte')
    // The Produto's two Relatórios, in the Fonte order — then the way back.
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^Likert · Câmbio/),
      expect.stringMatching(/^Voz do Cliente · Câmbio/),
      'Voltar'
    ])
    expect(screen.queryByRole('menuitem', { name: /Extrato/ })).toBeNull()
  })

  it('1-C8b: the chosen Relatório becomes the attachment "Relatório de <Fonte> · <Produto>"', async () => {
    await abrir()
    abrirMenu(within(inicio()).getByRole('button', { name: /^Adicionar arquivos/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Anexar um Relatório de Fonte/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: /^Voz do Cliente · Câmbio/ }))
    await waitFor(() => expect(contexto()).not.toBeNull())
    expect(within(contexto()).getByText('Relatório de Voz do Cliente · Câmbio')).toBeTruthy()
  })
})

describe('dictation', () => {
  it('1-C9a: touching the microphone and speaking writes the Hive dictation’s pt-BR transcript into the field, after what was there', async () => {
    const harness = armarMicrofone()
    const bridge = await abrir()
    bridge.campo.asr.transcribe = vi.fn(async () => 'quais dores crescem mais')
    escrever('Me diga')
    fireEvent.click(within(inicio()).getByRole('button', { name: 'Ditar' }))
    await waitFor(() => expect(harness.ticks?.length).toBeGreaterThan(0))
    await falar(harness)
    await waitFor(() => expect(campo().value).toMatch(/^Me diga quais dores crescem mais/))
  })

  it('1-C9b: dictating makes no network request — fetch is never called, and the audio goes only to the local bridge', async () => {
    const harness = armarMicrofone()
    const bridge = await abrir()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    bridge.campo.asr.transcribe = vi.fn(async () => 'texto ditado')
    fireEvent.click(within(inicio()).getByRole('button', { name: 'Ditar' }))
    await waitFor(() => expect(harness.ticks?.length).toBeGreaterThan(0))
    await falar(harness)
    await waitFor(() => expect(campo().value).toMatch(/texto ditado/i))
    expect(bridge.campo.asr.transcribe).toHaveBeenCalledWith(expect.any(Float32Array))
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
