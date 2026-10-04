import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createChatHistoryStore, type ChatHistoryStore } from '../chatHistoryStore'
import { listModuleConversations } from './conversations'

/**
 * Design Studio — the conversations "Recentes" lists (Landing 8 and 10).
 *
 * A module conversation is an ordinary `chatHistoryStore` session whose
 * workspace key is `<raiz>/<Produto>`. A Produto is a folder in `<raiz>`
 * (decision 3), so the listing walks those folders and asks the store for
 * each one — against a real store on a real temp dir, because the hash of the
 * key is the whole contract and a fake would not have one.
 */

let base: string
let root: string
let store: ChatHistoryStore

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'hive-ds-conversations-'))
  root = join(base, 'Documentos', 'Design Studio')
  store = createChatHistoryStore(join(base, 'userData'))
})

afterEach(() => {
  rmSync(base, { recursive: true, force: true })
})

/** A conversation in `<raiz>/<produto>` whose first message titles it. */
function converse(produto: string, text: string): string {
  const workspace = join(root, produto)
  const session = store.create(workspace, 'claude-cli')
  store.appendMessage(workspace, session.id, { role: 'user', text })
  return session.id
}

describe('listModuleConversations', () => {
  it('is empty before the module ever created its root', () => {
    expect(listModuleConversations(store, root)).toEqual([])
  })

  it('is empty for a root with Produto folders and no conversation', () => {
    for (const produto of ['Câmbio', 'Extrato', 'Pix'])
      mkdirSync(join(root, produto), { recursive: true })
    expect(listModuleConversations(store, root)).toEqual([])
  })

  it('tags every conversation with the Produto folder it is keyed under', () => {
    for (const produto of ['Câmbio', 'Extrato', 'Pix'])
      mkdirSync(join(root, produto), { recursive: true })
    const cambio = converse('Câmbio', 'Por que o estorno não avisa?')
    const pix = converse('Pix', 'Compare as três Fontes')

    const listed = listModuleConversations(store, root)
    expect(listed.map((meta) => [meta.produto, meta.id, meta.title]).sort()).toEqual(
      [
        ['Câmbio', cambio, 'Por que o estorno não avisa?'],
        ['Pix', pix, 'Compare as três Fontes']
      ].sort()
    )
  })

  it('never reaches a Hive conversation, nor one keyed on the root itself', () => {
    mkdirSync(join(root, 'Câmbio'), { recursive: true })
    converse('Câmbio', 'do módulo')
    // A Hive workspace conversation and a session keyed on `<raiz>` alone:
    // neither is a Produto's, so neither belongs in Recentes.
    const hive = store.create(join(base, 'workspace'), 'claude-cli')
    store.appendMessage(join(base, 'workspace'), hive.id, { role: 'user', text: 'do Hive' })
    const bare = store.create(root, 'claude-cli')
    store.appendMessage(root, bare.id, { role: 'user', text: 'na raiz' })

    expect(listModuleConversations(store, root).map((meta) => meta.title)).toEqual(['do módulo'])
  })

  it('skips plain files sitting in the root', () => {
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'LEIA-ME.txt'), 'notas', 'utf-8')
    mkdirSync(join(root, 'Extrato'))
    converse('Extrato', 'Histórico de 90 dias')
    expect(listModuleConversations(store, root).map((meta) => meta.produto)).toEqual(['Extrato'])
  })

  it('reads an unreadable root as no conversations rather than failing the sidebar', () => {
    mkdirSync(base, { recursive: true })
    // A FILE where the root folder should be: `readdirSync` throws ENOTDIR.
    writeFileSync(join(base, 'Documentos'), 'not a folder', 'utf-8')
    expect(listModuleConversations(store, join(base, 'Documentos'))).toEqual([])
  })
})
