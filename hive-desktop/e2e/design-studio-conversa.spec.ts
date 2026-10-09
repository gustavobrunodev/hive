import fs from 'node:fs'
import path from 'node:path'
import type { ElectronApplication, Locator, Page } from '@playwright/test'
import {
  test,
  expect,
  launchSeededApp,
  waitForWorkUI,
  type SeededWorkspace
} from './fixtures/workspace'
import { openSidebar } from './fixtures/sidebar'
import { dataRoot, openDesignStudio, seedProduto } from './fixtures/designStudio'
import { armScriptedAgent, type AgentScript } from './fixtures/scriptedAgent'

/**
 * Design Studio — task 1, the chat field and the conversa do Produto, in the
 * real Electron app (lote 1 of the build: S1–S4).
 *
 * What only the real app can answer: where the focus lands, what the agent's
 * CLI actually receives, what survives closing the Hive, and that what the
 * agent does underneath — a tool, a permission question — never reaches the
 * module's conversation. The agent is the scripted stand-in
 * (`e2e/__fixtures__/scripted-agent-cli.cjs`), spawned the way the real CLI is.
 */

async function abrir(
  seeded: SeededWorkspace,
  env?: Record<string, string>
): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await launchSeededApp(seeded, env ? { env } : undefined)
  const window = await app.firstWindow()
  await waitForWorkUI(window)
  await openSidebar(window, 'chat')
  await openDesignStudio(window)
  return { app, window }
}

/** A page layer of the module, by its page. */
function camada(window: Page, pagina: 'inicio' | 'conversa'): Locator {
  return window.locator(`.wb-work-layer[data-view="design"] [data-page="${pagina}"]`)
}

function campo(layer: Locator): Locator {
  return layer.getByRole('textbox', { name: 'Mensagem para o agente' })
}

/** Writes in a field and sends with Enter, once the field knows who answers. */
async function enviar(layer: Locator, texto: string): Promise<void> {
  await expect(layer.getByRole('button', { name: /^Agente da conversa:/ })).toBeVisible({
    timeout: 15_000
  })
  await campo(layer).fill(texto)
  await expect(layer.getByRole('button', { name: 'Enviar' })).toBeEnabled()
  await campo(layer).press('Enter')
}

const RESPOSTA: AgentScript = {
  sessionId: 'ds-conversa',
  chunks: ['As Dores ', 'que mais crescem são duas.'],
  usage: { input_tokens: 120, output_tokens: 30 },
  model: 'claude-sonnet-4-5'
}

test.describe('Design Studio — o campo do chat e a conversa do Produto', () => {
  test('1-C1b: opening the module in the real app puts the focus in the home’s chat field', async ({
    seeded
  }) => {
    seedProduto(seeded, 'Câmbio')
    const { app, window } = await abrir(seeded)
    try {
      await expect(campo(camada(window, 'inicio'))).toBeFocused({ timeout: 15_000 })
    } finally {
      await app.close()
    }
  })

  test('1-C7d: an attachment sent with the message reaches the agent — the stand-in receives the file in its turn', async ({
    seeded
  }) => {
    seedProduto(seeded, 'Câmbio')
    const agent = armScriptedAgent(seeded, { ...RESPOSTA, chunks: ['Vi o print.'] })
    const { app, window } = await abrir(seeded, agent.env)
    try {
      const inicio = camada(window, 'inicio')
      // A print on the clipboard: bytes with no path, pasted into the field.
      await campo(inicio).evaluate((textarea) => {
        const transfer = new DataTransfer()
        const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
        transfer.items.add(new File([bytes], 'tela-do-app.png', { type: 'image/png' }))
        textarea.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true })
        )
      })
      await expect(inicio.locator('.ds-campo-contexto .hds-attachment')).toHaveCount(1)
      await enviar(inicio, 'O que você vê neste print?')

      const conversa = camada(window, 'conversa')
      await expect(conversa.getByText('Vi o print.')).toBeVisible({ timeout: 30_000 })
      const turno = agent
        .invocations()
        .find(
          (entry) => entry.kind === 'turn' && entry.prompt?.includes('O que você vê neste print?')
        )
      expect(turno?.prompt).toContain('<attached-files>')
      const copia = new RegExp(
        `${path.join(dataRoot(seeded), 'Câmbio', 'relatorios', '.anexos').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\s]*tela-do-app\\.png`
      ).exec(turno?.prompt ?? '')?.[0]
      expect(copia, 'the turn names the copy the scoped turn may read').toBeTruthy()
      expect([...fs.readFileSync(copia as string)]).toEqual([
        137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3
      ])
    } finally {
      await app.close()
    }
  })

  test('1-C16: after closing and reopening the Hive, the conversation is still in Recentes and shows its messages in order, each reply with its agent and model', async ({
    seeded
  }) => {
    seedProduto(seeded, 'Câmbio')
    const agent = armScriptedAgent(seeded, { ...RESPOSTA, chunks: ['Primeira resposta.'] })
    const primeira = await abrir(seeded, agent.env)
    try {
      await enviar(camada(primeira.window, 'inicio'), 'Quais Dores crescem mais?')
      const conversa = camada(primeira.window, 'conversa')
      await expect(conversa.getByText('Primeira resposta.')).toBeVisible({ timeout: 30_000 })
      agent.rearm({ ...RESPOSTA, chunks: ['Segunda resposta.'] })
      await enviar(conversa, 'E a segunda?')
      await expect(conversa.getByText('Segunda resposta.')).toBeVisible({ timeout: 30_000 })
    } finally {
      await primeira.app.close()
    }

    const segunda = await abrir(seeded, agent.env)
    try {
      const recente = segunda.window
        .locator('.ds-nav-recentes')
        .getByRole('button', { name: /Quais Dores crescem mais\?/ })
      await expect(recente).toBeVisible({ timeout: 15_000 })
      await recente.click()
      const conversa = camada(segunda.window, 'conversa')
      const log = conversa.getByRole('log', { name: 'Mensagens da conversa' })
      await expect(log.locator('.ds-msg')).toHaveCount(4, { timeout: 15_000 })
      const linhas = await log.locator('.ds-msg').evaluateAll((msgs) =>
        msgs.map((msg) => ({
          quem: msg.classList.contains('ds-msg-agente') ? 'agente' : 'pessoa',
          texto: (msg.querySelector('.ds-bolha, .ds-msg-texto')?.textContent ?? '').trim(),
          agente: msg.querySelector('.ds-msg-cab .ds-msg-agente')?.textContent ?? null,
          modelo: msg.querySelector('.ds-msg-modelo')?.textContent ?? null
        }))
      )
      expect(linhas).toEqual([
        { quem: 'pessoa', texto: 'Quais Dores crescem mais?', agente: null, modelo: null },
        {
          quem: 'agente',
          texto: 'Primeira resposta.',
          agente: 'Claude',
          modelo: 'claude-sonnet-4-5'
        },
        { quem: 'pessoa', texto: 'E a segunda?', agente: null, modelo: null },
        {
          quem: 'agente',
          texto: 'Segunda resposta.',
          agente: 'Claude',
          modelo: 'claude-sonnet-4-5'
        }
      ])
    } finally {
      await segunda.app.close()
    }
  })

  test('1-C17b: with the stand-in emitting a tool_use and permission requests, the module’s conversation shows no tool card, no permission card and no file path', async ({
    seeded
  }) => {
    seedProduto(seeded, 'Câmbio')
    const agent = armScriptedAgent(seeded, {
      ...RESPOSTA,
      chunks: ['Resposta só com palavras.'],
      writes: [{ path: 'rascunho-do-agente.md', content: 'escrito por baixo' }],
      approvals: [
        { tool: 'Bash', input: { command: 'git status --porcelain' } },
        { tool: 'Write', input: { file_path: '/etc/hosts' } }
      ]
    })
    const { app, window } = await abrir(seeded, agent.env)
    try {
      await enviar(camada(window, 'inicio'), 'Quais Dores crescem mais?')
      const conversa = camada(window, 'conversa')
      await expect(conversa.getByText('Resposta só com palavras.')).toBeVisible({
        timeout: 30_000
      })
      // The reply streams first; the questions and the write come after it,
      // so the turn is over only once Enviar is back.
      await expect(conversa.getByRole('button', { name: 'Enviar' })).toBeVisible({
        timeout: 30_000
      })
      // The questions were really asked — and answered by the turn's scope.
      await expect
        .poll(() =>
          agent
            .invocations()
            .filter((entry) => entry.kind === 'approval')
            .map((entry) => [entry.tool, entry.behavior])
        )
        .toEqual([
          ['Bash', 'deny'],
          ['Write', 'deny']
        ])
      // …and none of it is on screen: no tool card, no permission card, no path.
      await expect(window.locator('.wb-approval')).toHaveCount(0)
      await expect(conversa.locator('.wb-activity, .wb-approval')).toHaveCount(0)
      const texto = (await conversa.textContent()) ?? ''
      for (const proibido of [
        'rascunho-do-agente.md',
        'git status',
        '/etc/hosts',
        'Bash',
        dataRoot(seeded)
      ]) {
        expect(texto).not.toContain(proibido)
      }
    } finally {
      await app.close()
    }
  })
})
