// Records a short screen-capture video of the Hive Desktop renderer UI.
// Uses the static `out/renderer` build (electron-vite build) served over
// HTTP, with `window.hive` fully mocked via an injected init script — same
// recipe as the project's visual-validation memory, but driven by a
// standalone Playwright script (not the MCP tool) so `recordVideo` can be
// configured at context-creation time.
const { chromium } = require('playwright-core')
const path = require('node:path')

const OUT_DIR = path.join(__dirname, 'video-out')
const BASE_URL = 'http://127.0.0.1:8123'

const files = {
  'README.md': '# Hive Desktop\n\nWelcome to the workspace tour.\n',
  'src/index.ts': "export function hello(): string {\n  return 'hive'\n}\n",
  'src/utils/format.ts': 'export function format(n: number): string {\n  return n.toFixed(2)\n}\n',
  'docs/notes.md': '# Notes\n\nSome project notes live here.\n'
}

function buildTree() {
  return [
    { name: 'README.md', path: 'README.md', type: 'file' },
    {
      name: 'src',
      path: 'src',
      type: 'directory',
      children: [
        { name: 'index.ts', path: 'src/index.ts', type: 'file' },
        {
          name: 'utils',
          path: 'src/utils',
          type: 'directory',
          children: [{ name: 'format.ts', path: 'src/utils/format.ts', type: 'file' }]
        }
      ]
    },
    {
      name: 'docs',
      path: 'docs',
      type: 'directory',
      children: [{ name: 'notes.md', path: 'docs/notes.md', type: 'file' }]
    }
  ]
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } }
  })

  await context.addInitScript(
    ({ tree, fileContents }) => {
      const noop = () => {}
      window.hive = {
        ping: async () => 'pong',
        chooseWorkspace: async () => '/home/demo/hive-workspace',
        openExternal: async () => {},
        getWorkspace: async () => '/home/demo/hive-workspace',
        isProvisioned: async () => true,
        provisionState: async () => true,
        getRecentWorkspaces: async () => [],
        openWorkspace: async () => ({ ok: true }),
        listTree: async () => tree,
        readFile: async (_root, rel) => fileContents[rel] ?? '',
        watchWorkspace: () => () => {},
        agent: {
          capabilities: async () => ({
            models: [{ id: 'sonnet', label: 'Sonnet' }],
            efforts: [{ id: 'medium', label: 'Medium' }],
            supportsAttachments: false
          }),
          start: async () => {},
          send: async () => {},
          runWorkflow: async () => {},
          stop: async () => {},
          onEvent: () => () => {}
        },
        installBmad: () => () => {},
        updateBmad: (_workspace, onEvent) => {
          setTimeout(() => onEvent({ type: 'done', ok: true }), 50)
          return () => {}
        },
        workflows: { list: async () => [] },
        skills: { list: async () => [] },
        profile: {
          agents: async () => [{ id: 'claude', name: 'Claude' }],
          getAgent: async () => 'claude',
          setAgent: async () => {},
          getRole: async () => 'developer',
          setRole: async () => {},
          roleActions: async () => []
        },
        fs: {
          statFile: async () => ({ mtimeMs: Date.now(), size: 0 }),
          createFile: async () => {},
          createDirectory: async () => {},
          saveFile: async () => ({ mtimeMs: Date.now(), size: 0 }),
          move: async () => {},
          importEntry: async () => {},
          exists: async () => false,
          trash: async () => {},
          pathForFile: () => ''
        }
      }
    },
    { tree: buildTree(), fileContents: files }
  )

  const page = await context.newPage()
  page.on('pageerror', (err) => console.error('PAGEERROR:', err.message))
  await page.goto(BASE_URL, { waitUntil: 'load' })
  await page.waitForTimeout(1500)

  // Expand the explorer tree and open a couple of files as tabs.
  const readme = page.getByText('README.md', { exact: true }).first()
  if (await readme.count()) {
    await readme.click()
    await page.waitForTimeout(1200)
  }

  const srcDir = page.getByText('src', { exact: true }).first()
  if (await srcDir.count()) {
    await srcDir.click()
    await page.waitForTimeout(800)
  }

  const indexFile = page.getByText('index.ts', { exact: true }).first()
  if (await indexFile.count()) {
    await indexFile.click()
    await page.waitForTimeout(1200)
  }

  const utilsDir = page.getByText('utils', { exact: true }).first()
  if (await utilsDir.count()) {
    await utilsDir.click()
    await page.waitForTimeout(800)
  }

  const formatFile = page.getByText('format.ts', { exact: true }).first()
  if (await formatFile.count()) {
    await formatFile.click()
    await page.waitForTimeout(1200)
  }

  // Toggle theme (sun/moon button in the top bar) a couple of times.
  const themeButtons = page.locator('button[aria-label], button[title]')
  const count = await themeButtons.count()
  for (let i = 0; i < count; i++) {
    const el = themeButtons.nth(i)
    const label = ((await el.getAttribute('aria-label')) || (await el.getAttribute('title')) || '').toLowerCase()
    if (label.includes('tema') || label.includes('theme')) {
      await el.click()
      await page.waitForTimeout(1000)
      await el.click()
      await page.waitForTimeout(1000)
      break
    }
  }

  await page.waitForTimeout(1500)

  await context.close()
  await browser.close()
  console.log('DONE')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
