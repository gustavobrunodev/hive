import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, type Page } from '@playwright/test'
import type { SeededWorkspace } from './workspace'

/**
 * Design Studio fixtures for the real-Electron specs.
 *
 * Seeding, not mocking, like the rest of `fixtures/`: a module conversation is
 * written exactly where the app keeps one — a history session whose workspace
 * key is `<documents>/Design Studio/<Produto>` (Landing 8), in this case's own
 * `userData` — so the listing, the IPC bridge and the sidebar all run for real.
 */

/** `<raiz>` for this case (Landing 3 and 11). */
export function dataRoot(seeded: SeededWorkspace): string {
  return path.join(seeded.documents, 'Design Studio')
}

/** The history directory `chatHistoryStore` keys a workspace path to. */
function historyDir(seeded: SeededWorkspace, workspace: string): string {
  const hash = createHash('sha256').update(workspace).digest('hex').slice(0, 16)
  return path.join(seeded.userData, 'chat-history', hash)
}

export interface SeededConversation {
  id: string
  produto: string
  title: string
}

/** Writes one module conversation of `produto`, last updated `minutesAgo` minutes ago. */
export function seedModuleConversation(
  seeded: SeededWorkspace,
  produto: string,
  title: string,
  minutesAgo = 5
): SeededConversation {
  const workspace = path.join(dataRoot(seeded), produto)
  fs.mkdirSync(workspace, { recursive: true })
  const dir = historyDir(seeded, workspace)
  fs.mkdirSync(dir, { recursive: true })
  const id = randomUUID()
  const at = Date.now() - minutesAgo * 60_000
  fs.writeFileSync(
    path.join(dir, `${id}.json`),
    JSON.stringify({
      id,
      workspace,
      agent: 'claude-cli',
      title,
      createdAt: at - 60_000,
      updatedAt: at,
      messages: [
        { id: randomUUID(), role: 'user', text: title, at: at - 60_000 },
        { id: randomUUID(), role: 'assistant', text: 'Resposta de exemplo.', at }
      ],
      cliSessionId: null
    })
  )
  return { id, produto, title }
}

/** Writes `count` ordinary Hive conversations into the workspace's history, newest first. */
export function seedHiveConversations(seeded: SeededWorkspace, count: number): void {
  const dir = historyDir(seeded, seeded.workspace)
  fs.mkdirSync(dir, { recursive: true })
  for (let index = 0; index < count; index += 1) {
    const id = randomUUID()
    const at = Date.now() - (index + 1) * 3_600_000
    fs.writeFileSync(
      path.join(dir, `${id}.json`),
      JSON.stringify({
        id,
        workspace: seeded.workspace,
        agent: 'claude-cli',
        title: `Conversa do Hive ${index + 1}`,
        createdAt: at - 60_000,
        updatedAt: at,
        messages: [{ id: randomUUID(), role: 'user', text: `Pedido ${index + 1}`, at }],
        cliSessionId: null
      })
    )
  }
}

/** The module's entry row in the sidebar's fixed block, whichever name it wears. */
export function designRow(window: Page): ReturnType<Page['locator']> {
  return window
    .locator('.wb-sidebar-fixed')
    .getByRole('button', { name: /^(Ocultar )?Design Studio$/ })
}

/** The module's page on screen, if the module is in front. */
export async function activeDesignPage(window: Page): Promise<string | null> {
  return window.evaluate(
    () =>
      document
        .querySelector('.wb-work-layer[data-view="design"][data-active] [data-page][data-active]')
        ?.getAttribute('data-page') ?? null
  )
}

/** Brings the Design Studio to the front from the Chat & Cowork tab. */
export async function openDesignStudio(window: Page): Promise<void> {
  const tab = window.getByRole('tab', { name: 'Chat & Cowork' })
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click()
  const row = designRow(window)
  if ((await row.getAttribute('aria-current')) !== 'true') await row.click()
  await expect
    .poll(() =>
      window.evaluate(() => document.querySelector('[data-view="design"][data-active]') !== null)
    )
    .toBe(true)
}

/** Goes to one of the module's navigation pages. */
export async function goToPage(
  window: Page,
  name: 'Início' | 'Dores' | 'Relatórios'
): Promise<void> {
  await window.locator('.ds-nav').getByRole('button', { name, exact: true }).click()
}

/** The module's embedded resources, as the unpackaged app resolves them (Landing 6). */
export const RESOURCES = path.join(__dirname, '..', '..', 'resources', 'design-studio')

/** Today, `AAAA-MM-DD`, on the local calendar — the day the app names a Relatório by. */
export function todayLocal(): string {
  const now = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** Produto display name → the sample data's id. */
const PRODUTO_ID: Record<string, string> = { Câmbio: 'cambio', Extrato: 'extrato', Pix: 'pix' }

/**
 * A Relatório's text, produced by the real skill script over the real sample
 * data — what a generation leaves behind, minus the agent's narrative.
 */
export function skillRelatorioText(produto: string, fonte: 'likert' | 'voz' | 'fullstory'): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'hive-e2e-skill-'))
  const out = path.join(cwd, 'relatorios', fonte, '.rascunho.md.parcial')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const result = spawnSync(
    process.execPath,
    [
      path.join(RESOURCES, 'skills', `relatorio-${fonte}`, 'scripts', 'relatorio.mjs'),
      '--dados',
      path.join(RESOURCES, 'dados-de-exemplo', PRODUTO_ID[produto], `${fonte}.json`),
      '--saida',
      path.relative(cwd, out),
      '--agente',
      'Claude',
      '--modelo',
      'sonnet'
    ],
    { cwd, encoding: 'utf-8' }
  )
  if (result.status !== 0) throw new Error(`skill failed: ${result.stderr}`)
  return fs.readFileSync(out, 'utf-8')
}

/** Writes a valid Relatório where the app reads it: `<raiz>/<Produto>/relatorios/<fonte>/<dia>-90d.md`. */
export function seedRelatorio(
  seeded: SeededWorkspace,
  produto: string,
  fonte: 'likert' | 'voz' | 'fullstory'
): string {
  const dir = path.join(dataRoot(seeded), produto, 'relatorios', fonte)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${todayLocal()}-90d.md`)
  fs.writeFileSync(file, skillRelatorioText(produto, fonte), 'utf-8')
  return file
}

/** All three Fontes of a Produto, seeded. */
export function seedProduto(seeded: SeededWorkspace, produto: string): void {
  for (const fonte of ['likert', 'voz', 'fullstory'] as const) seedRelatorio(seeded, produto, fonte)
}
