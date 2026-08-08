// Visual-pass scenario for agent-patch — the change an editing step is making,
// drawn inline in the transcript.
//
// Run AFTER tools/visual/boot.mjs:
//   run_code_unsafe --filename tools/visual/chat-patch.mjs
//
// Drives one settled turn and one live turn far enough that every state the
// snippet can be in is on screen at once: a two-hunk edit with word-level
// marks, a created file (the `novo` chip), a failed edit that must not look
// like it landed, and a long patch parked behind its line cap.
//
// Theme is chosen by editing the constant below and is switched through the
// REAL topbar control, never localStorage — the boot init script rewrites that
// key on every navigation, so a probe that sets it measures its own default
// three times (docs/visual-validation.md).
//   theme: 'dark' | 'light' | 'hive'
// (The file is a bare function *expression* handed to the MCP tool, not a
// module — the knobs have to live inside it.)
async (page) => {
  const theme = 'dark'

  if (theme !== 'dark') {
    await page.locator('.wb-icon-btn[aria-label^="Aparência"]').click()
    await page.getByRole('menuitemradio', { name: { light: 'Claro', hive: 'Hive' }[theme] }).click()
    await page.waitForTimeout(250)
  }

  const type = async (text) => {
    const box = page.locator('textarea').first()
    await box.click()
    await box.fill(text)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(180)
  }

  const emit = (events) =>
    page.evaluate((list) => {
      for (const event of list) window.__agentEvent(event)
    }, events)

  const ctx = (text, no) => ({ type: 'ctx', text, no })
  const del = (text, no, spans) => ({ type: 'del', text, no, spans })
  const add = (text, no, spans) => ({ type: 'add', text, no, spans })

  // --- the patches ---------------------------------------------------------

  // A real two-hunk edit: one line rewritten (word marks on both sides) and a
  // helper extracted below it.
  const editPatch = {
    op: 'edit',
    path: '/ws/src/billing/index.ts',
    adds: 6,
    dels: 2,
    anchored: true,
    hunks: [
      {
        lines: [
          ctx('export function invoiceTotal(items: Item[]): number {', 41),
          del('  return items.reduce((sum, item) => sum + item.price, 0)', 42, [
            { text: '  return items.reduce((sum, item) => sum + item.price, 0)', changed: false }
          ]),
          add('  return items.reduce((sum, item) => sum + item.price * item.qty, 0)', 42, [
            { text: '  return items.reduce((sum, item) => sum + item.price', changed: false },
            { text: ' * item.qty', changed: true },
            { text: ', 0)', changed: false }
          ]),
          ctx('}', 43)
        ]
      },
      {
        lines: [
          ctx('export function applyDiscount(total: number, pct: number): number {', 77),
          del('  return total - total * pct', 78, [
            { text: '  return total - total * pct', changed: false }
          ]),
          add('  return round(total - total * pct)', 78, [
            { text: '  return ', changed: false },
            { text: 'round(', changed: true },
            { text: 'total - total * pct', changed: false },
            { text: ')', changed: true }
          ]),
          ctx('}', 79),
          add('', 80),
          add('/** Money never survives a float — two decimals, always. */', 81),
          add('export function round(value: number): number {', 82),
          add('  return Math.round(value * 100) / 100', 83),
          add('}', 84)
        ]
      }
    ]
  }

  const createdLines = [
    "import type { Invoice } from './types'",
    '',
    '/** Every mutation to an invoice, in the order it happened. */',
    'export interface AuditEntry {',
    '  invoiceId: string',
    '  at: number',
    "  action: 'created' | 'charged' | 'refunded'",
    '  actor: string',
    '}',
    '',
    'export function record(invoice: Invoice, entry: AuditEntry): void {',
    '  invoice.audit.push(entry)',
    '}'
  ]
  const createPatch = {
    op: 'create',
    path: '/ws/src/billing/audit.ts',
    adds: createdLines.length,
    dels: 0,
    anchored: true,
    hunks: [{ lines: createdLines.map((text, i) => add(text, i + 1)) }]
  }

  const failedPatch = {
    op: 'edit',
    path: '/ws/src/billing/legacy.ts',
    adds: 1,
    dels: 1,
    anchored: true,
    hunks: [
      {
        lines: [
          ctx('const RATE = {', 11),
          del("  currency: 'BRL',", 12, [
            { text: '  currency: ', changed: false },
            { text: "'BRL'", changed: true },
            { text: ',', changed: false }
          ]),
          add("  currency: 'USD',", 12, [
            { text: '  currency: ', changed: false },
            { text: "'USD'", changed: true },
            { text: ',', changed: false }
          ]),
          ctx('}', 13)
        ]
      }
    ]
  }

  // Long enough to be parked behind the line cap, so "Mostrar mais N linhas"
  // is on screen rather than only in a unit test.
  const reportLines = [
    "import { invoiceTotal } from './index'",
    "import type { Invoice } from './types'",
    '',
    'interface Row {',
    '  month: string',
    '  gross: number',
    '  refunded: number',
    '}',
    '',
    'export function monthlyReport(invoices: Invoice[]): Row[] {',
    '  const byMonth = new Map<string, Row>()',
    '  for (const invoice of invoices) {',
    '    const month = invoice.issuedAt.slice(0, 7)',
    '    const row = byMonth.get(month) ?? { month, gross: 0, refunded: 0 }',
    '    row.gross += invoiceTotal(invoice.items)',
    '    row.refunded += invoice.refunds.reduce((sum, r) => sum + r.amount, 0)',
    '    byMonth.set(month, row)',
    '  }',
    '  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))',
    '}',
    '',
    'export function toCsv(rows: Row[]): string {',
    "  const head = 'mes,bruto,estornado'",
    '  const body = rows',
    '    .map((row) => `${row.month},${row.gross},${row.refunded}`)',
    "    .join('\\n')",
    '  return `${head}\\n${body}`',
    '}'
  ]
  const longPatch = {
    op: 'create',
    path: '/ws/src/billing/report.ts',
    adds: reportLines.length,
    dels: 0,
    anchored: true,
    hunks: [{ lines: reportLines.map((text, i) => add(text, i + 1)) }]
  }

  // --- turn 1: settled, an edit and a created file --------------------------
  await type('Cobra por quantidade e registra a trilha de auditoria do faturamento')
  await emit([
    { type: 'token', text: 'Vou ler o módulo antes de mexer no cálculo.\n\n' },
    { type: 'tool', name: 'Read', detail: '/ws/src/billing/index.ts', toolId: 'r1', phase: 'start' }
  ])
  await page.waitForTimeout(1300)
  await emit([
    { type: 'tool', name: '', toolId: 'r1', phase: 'end', ok: true },
    {
      type: 'token',
      text: 'O total ignorava a quantidade e o desconto não arredondava. Corrigi os dois:\n\n'
    },
    {
      type: 'tool',
      name: 'Edit',
      detail: '/ws/src/billing/index.ts',
      toolId: 'e1',
      phase: 'start',
      filePath: '/ws/src/billing/index.ts',
      patch: editPatch
    }
  ])
  await page.waitForTimeout(900)
  await emit([
    { type: 'tool', name: '', toolId: 'e1', phase: 'end', ok: true },
    {
      type: 'tool',
      name: 'Write',
      detail: '/ws/src/billing/audit.ts',
      toolId: 'w1',
      phase: 'start',
      filePath: '/ws/src/billing/audit.ts',
      patch: createPatch
    }
  ])
  await page.waitForTimeout(900)
  await emit([
    { type: 'tool', name: '', toolId: 'w1', phase: 'end', ok: true },
    { type: 'token', text: 'Pronto — a trilha de auditoria vive em `billing/audit.ts`.' },
    {
      type: 'usage',
      final: true,
      usage: {
        inputTokens: 940,
        cacheReadTokens: 61_400,
        cacheCreationTokens: 14_300,
        outputTokens: 1_180,
        model: 'claude-opus-5',
        costUsd: 0.0742,
        durationMs: 19_400,
        apiDurationMs: 17_100
      }
    },
    { type: 'done' }
  ])
  await page.waitForTimeout(400)

  // --- turn 2: live — a refused edit, then a long file being written --------
  await type('Agora gera o relatório mensal em CSV')
  await emit([
    { type: 'token', text: 'Primeiro alinho a moeda no módulo legado.\n\n' },
    {
      type: 'tool',
      name: 'Edit',
      detail: '/ws/src/billing/legacy.ts',
      toolId: 'e2',
      phase: 'start',
      filePath: '/ws/src/billing/legacy.ts',
      patch: failedPatch
    }
  ])
  await page.waitForTimeout(1100)
  await emit([
    // Refused: the patch stays on screen, marked as never applied.
    { type: 'tool', name: '', toolId: 'e2', phase: 'end', ok: false },
    { type: 'token', text: 'O arquivo mudou desde a leitura. Sigo com o relatório:\n\n' },
    {
      type: 'tool',
      name: 'Write',
      detail: '/ws/src/billing/report.ts',
      toolId: 'w2',
      phase: 'start',
      filePath: '/ws/src/billing/report.ts',
      patch: longPatch
    }
  ])

  // Long enough for every staggered line to have finished arriving.
  await page.waitForTimeout(1800)
  return await page.evaluate(() => document.body.innerText.slice(0, 300))
}
