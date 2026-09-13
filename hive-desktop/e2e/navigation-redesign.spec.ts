import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { test, expect, launchSeededApp, type SeededWorkspace } from './fixtures/workspace'

const DAY = 86_400_000

/** Real persisted sessions exercise IPC reads, full-text search and mutations. */
function seedHistory(seeded: SeededWorkspace): Map<string, string> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const histories = [
    { title: 'Zulu retomada', age: 0, created: 60 },
    { title: 'Beta recente', age: 1, created: 1 },
    { title: 'Alpha planejamento', age: 4, created: 4 },
    { title: 'Gamma pesquisa', age: 12, created: 12 },
    ...Array.from({ length: 9 }, (_, index) => ({
      title: `Histórico ${index + 1}`,
      age: 40 + index,
      created: 40 + index
    }))
  ]
  const hash = createHash('sha256').update(seeded.workspace).digest('hex').slice(0, 16)
  const directory = path.join(seeded.userData, 'chat-history', hash)
  fs.mkdirSync(directory, { recursive: true })
  const files = new Map<string, string>()
  for (const entry of histories) {
    const id = randomUUID()
    const at = today.getTime() - entry.age * DAY + 1
    const file = path.join(directory, `${id}.json`)
    fs.writeFileSync(
      file,
      JSON.stringify({
        id,
        workspace: seeded.workspace,
        agent: 'claude-cli',
        title: entry.title,
        createdAt: today.getTime() - entry.created * DAY,
        updatedAt: at,
        messages: [
          { id: randomUUID(), role: 'user', text: `Registro ${entry.title}: orquídea`, at }
        ],
        cliSessionId: null
      })
    )
    files.set(entry.title, file)
  }
  return files
}

async function chooseFilter(window: Page, scope: Locator, label: string): Promise<void> {
  await scope.getByRole('button', { name: /^Filtrar por última atividade:/ }).click()
  await window.getByRole('menuitemradio', { name: label, exact: true }).click()
}

async function chooseSort(window: Page, scope: Locator, label: string): Promise<void> {
  await scope.getByRole('button', { name: /^Ordenar conversas:/ }).click()
  await window.getByRole('menuitemradio', { name: label, exact: true }).click()
}

test.describe('navigation redesign (real Electron)', () => {
  test('@p0 navbar, tabs, tools, search, themes and user settings remain reachable', async ({
    seeded
  }) => {
    fs.writeFileSync(path.join(seeded.workspace, 'navigation-notes.md'), '# Navigation\n')
    const app = await launchSeededApp(seeded)
    try {
      const window = await app.firstWindow()
      const runtimeErrors: string[] = []
      window.on('pageerror', (error) => runtimeErrors.push(error.message))
      const navbar = window.locator('.wb-navbar')
      await expect(navbar).toBeVisible({ timeout: 45_000 })
      await expect(window.getByRole('tab', { name: 'Chat & Cowork', exact: true })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      await expect(
        window.getByRole('button', { name: 'Novo — iniciar uma nova conversa' })
      ).toBeVisible()
      await expect(window.getByText('Nenhuma conversa ainda', { exact: true })).toBeVisible()
      await expect(navbar.locator('.wb-usermenu-trigger')).toHaveCount(0)
      await expect(navbar.locator('input')).toHaveCount(0)
      const mark = await navbar.locator('.wb-navbar-logo').boundingBox()
      expect(mark?.width).toBeLessThanOrEqual(24)
      expect(mark?.height).toBeLessThanOrEqual(24)
      const controls = await navbar.locator('button').all()
      expect(controls).toHaveLength(4)
      const boxes = await Promise.all(controls.map((control) => control.boundingBox()))
      for (let index = 1; index < boxes.length; index++) {
        expect(boxes[index]!.x).toBeGreaterThan(boxes[index - 1]!.x)
        expect(Math.abs(boxes[index]!.y - boxes[0]!.y)).toBeLessThanOrEqual(3)
      }

      await window.getByRole('button', { name: 'Ocultar barra lateral', exact: true }).hover()
      await expect(window.getByRole('tooltip', { name: 'Ocultar barra lateral' })).toBeVisible()
      await window.getByRole('button', { name: 'Ocultar barra lateral', exact: true }).click()
      await expect(window.getByRole('button', { name: 'Exibir barra lateral' })).toHaveAttribute(
        'aria-expanded',
        'false'
      )
      await expect(navbar).toBeVisible()

      // Workspace search is the navbar's second control, and the point of it
      // being there rather than in the Arquivos tab is that it answers "where
      // is that file" with the sidebar away and from either tab.
      const search = navbar.getByRole('button', { name: 'Buscar arquivos no workspace' })
      // Focus, not hover — and deliberately, because it is the stronger half of
      // the promise: `TooltipIconButton` exists so an icon-only control shows
      // its name on **keyboard focus**, which the native `title` attribute
      // cannot do. (The toggle above covers the hover path. A synthetic hover
      // here proved flaky under Electron+xvfb after the neighbouring button
      // re-rendered, while Chromium showed the tooltip every time — a harness
      // difference, not a product one.)
      await search.focus()
      await expect(
        window.getByRole('tooltip', { name: /Buscar arquivos no workspace/ })
      ).toBeVisible()
      await expect(search).toHaveAttribute('aria-expanded', 'false')
      await search.click()
      // Not asserted while the palette is up: it is a *modal* dialog, so the
      // rest of the app leaves the accessibility tree and the trigger becomes
      // unreachable by role — which is the dialog behaving correctly, not the
      // button losing its state.
      await window.getByPlaceholder('Buscar arquivos no workspace…').fill('navigation-notes')
      await window.getByRole('option', { name: /navigation-notes/ }).click()
      await expect(window.locator('.wb-tab-name')).toContainText('navigation-notes.md')
      // Closed again: the trigger is back, and back to reporting closed.
      await expect(search).toHaveAttribute('aria-expanded', 'false')
      // Picking a file reveals it in the tree (`openAndReveal`), and revealing
      // is what brings the sidebar back — so a palette reached with the sidebar
      // away ends on the Arquivos tab, with the file on screen.
      await expect(window.getByRole('button', { name: 'Ocultar barra lateral' })).toBeVisible()
      await expect(window.getByRole('tab', { name: 'Arquivos' })).toHaveAttribute(
        'aria-selected',
        'true'
      )
      await expect(window.locator('[id="hds-tree-item-navigation-notes.md"]')).toBeVisible()
      await window.getByRole('button', { name: 'Controle de versão', exact: true }).click()
      await expect(window.locator('.wb-nav-item[data-view="scm"]')).toHaveAttribute(
        'aria-current',
        'true'
      )
      await window.getByRole('button', { name: 'Explorador de arquivos', exact: true }).click()
      await expect(window.locator('.wb-nav-item[data-view="explorer"]')).toHaveAttribute(
        'aria-current',
        'true'
      )

      await window.getByRole('tab', { name: 'Arquivos' }).focus()
      await window.keyboard.press('ArrowLeft')
      await expect(window.getByRole('tab', { name: 'Chat & Cowork', exact: true })).toBeFocused()
      // The chat tools open in the WORK pane, in the transcript's place — and
      // the conversation list they used to evict stays on screen throughout.
      await window.getByRole('button', { name: 'Revisão do agente', exact: true }).click()
      await expect(window.getByText('Sem mudanças para revisar')).toBeVisible()
      await expect(window.locator('.wb-work-layer[data-active]')).toHaveAttribute(
        'data-view',
        'review'
      )
      await expect(window.locator('.wb-chatside')).toBeVisible()
      // The pane names what it holds, and carries its own way out.
      await expect(window.locator('.wb-pane-header-label').first()).toHaveText('Revisão do agente')

      await window.getByRole('button', { name: 'Estúdio de skills', exact: true }).click()
      await expect(window.locator('.wb-studio-dialog')).toBeVisible()
      await window.keyboard.press('Escape')
      await expect(window.locator('.wb-studio-dialog')).toHaveCount(0)

      await window.getByRole('button', { name: 'Bases de conhecimento', exact: true }).click()
      await expect(window.locator('.wb-nav-item[data-view="brain"]')).toHaveAttribute(
        'aria-current',
        'true'
      )
      await expect(window.locator('.wb-work-layer[data-active]')).toHaveAttribute(
        'data-view',
        'brain'
      )
      await window
        .getByRole('button', { name: 'Fechar Bases de conhecimento e voltar à conversa' })
        .click()
      await expect(window.locator('.wb-work-layer[data-active]')).toHaveAttribute(
        'data-view',
        'chat'
      )

      await window.getByRole('button', { name: 'Novo — iniciar uma nova conversa' }).click()
      await expect(window.locator('.wb-chatside')).toBeVisible()

      for (const theme of [
        { name: /^Claro/, value: 'light' },
        { name: /^Hive/, value: 'hive' },
        { name: /^Escuro/, value: 'dark' }
      ]) {
        await navbar.getByRole('button', { name: /^Escolha do tema/ }).click()
        await window.getByRole('menuitemradio', { name: theme.name }).click()
        await expect(window.locator('html')).toHaveAttribute('data-theme', theme.value)
      }

      const user = window.getByRole('button', { name: 'Menu do usuário: E2E' })
      await user.focus()
      await window.keyboard.press('Enter')
      await expect(window.locator('.wb-usermenu-head-name')).toHaveText('E2E')
      await expect(window.locator('.wb-usermenu-head-role')).toContainText('Desenvolvedor')
      await window.keyboard.press('Escape')
      await expect(user).toBeFocused()
      await user.click()
      await window.getByRole('menuitem', { name: /^Configurações/ }).click()
      await expect(window.locator('.wb-usermenu-menu')).toHaveCount(0)
      await window.locator('button.wb-pnav-row[data-scope="mcp"]').click()
      await window.getByRole('button', { name: 'Servidores MCP', exact: true }).click()
      await expect(window.locator('.wb-mcp-dialog')).toBeVisible()
      await expect(window.locator('.wb-profile-sheet')).toHaveCount(0)
      await window.keyboard.press('Escape')
      await expect(window.locator('.wb-mcp-dialog')).toHaveCount(0)
      expect(runtimeErrors).toEqual([])
    } finally {
      await app.close()
    }
  })

  test('@p0 history filters, all three orders, full-text search and persisted row actions', async ({
    seeded
  }) => {
    const files = seedHistory(seeded)
    const app = await launchSeededApp(seeded)
    try {
      const window = await app.firstWindow()
      const sidebar = window.locator('.wb-chatside')
      await expect(sidebar).toBeVisible({ timeout: 45_000 })
      await expect(sidebar.locator('[data-history-open]')).toHaveCount(12)
      await expect(sidebar.locator('.wb-history-row-name').first()).toHaveText('Zulu retomada')
      for (const [filter, count] of [
        ['1 dia', 1],
        ['3 dias', 2],
        ['7 dias', 3],
        ['30 dias', 4],
        ['Todos', 12]
      ] as const) {
        await chooseFilter(window, sidebar, filter)
        await expect(sidebar.locator('[data-history-open]')).toHaveCount(count)
      }
      await chooseSort(window, sidebar, 'Nome')
      await expect(sidebar.locator('.wb-history-row-name').first()).toHaveText('Alpha planejamento')
      await chooseSort(window, sidebar, 'Recém-criadas')
      await expect(sidebar.locator('.wb-history-row-name').first()).toHaveText('Beta recente')
      await chooseSort(window, sidebar, 'Última atividade')
      await expect(sidebar.locator('.wb-history-row-name').first()).toHaveText('Zulu retomada')

      await chooseFilter(window, sidebar, '7 dias')
      await chooseSort(window, sidebar, 'Nome')
      await window.getByRole('button', { name: /Ver todas as conversas/ }).click()
      const archive = window.locator('.wb-allconv')
      await expect(archive.locator('[data-history-open]')).toHaveCount(3)
      await expect(archive.getByRole('button', { name: 'Ordenar conversas: Nome' })).toBeVisible()
      await chooseFilter(window, archive, 'Todos')
      await expect(archive.locator('[data-history-open]')).toHaveCount(13)
      const search = archive.getByPlaceholder('Buscar conversas…')
      await search.fill('orquidea')
      await expect(archive.locator('[data-history-open]')).toHaveCount(13)
      await search.fill('sem-correspondencia')
      await expect(archive.getByText('Nada encontrado para "sem-correspondencia".')).toBeVisible()
      await search.fill('Alpha')
      await expect(archive.locator('[data-history-open]')).toHaveCount(1)
      await archive.getByRole('button', { name: 'Renomear Alpha planejamento' }).click()
      await archive.getByRole('textbox', { name: 'Título da conversa' }).fill('Alpha revisada')
      await window.keyboard.press('Enter')
      await expect
        .poll(() => JSON.parse(fs.readFileSync(files.get('Alpha planejamento')!, 'utf-8')).title)
        .toBe('Alpha revisada')
      await archive.getByRole('button', { name: 'Abrir conversa: Alpha revisada' }).click()
      await expect(archive).toHaveCount(0)
      await expect(
        window.getByText('Registro Alpha planejamento: orquídea', { exact: true })
      ).toBeVisible()
      await expect(
        sidebar.getByRole('button', { name: 'Filtrar por última atividade: Todos' })
      ).toBeVisible()
      await window.getByRole('button', { name: 'Novo — iniciar uma nova conversa' }).click()
      await expect(
        window.getByText('Registro Alpha planejamento: orquídea', { exact: true })
      ).toHaveCount(0)

      await window.getByRole('button', { name: /Ver todas as conversas/ }).click()
      await archive.getByPlaceholder('Buscar conversas…').fill('Gamma')
      await archive.getByRole('button', { name: 'Excluir Gamma pesquisa' }).click()
      await archive.getByRole('button', { name: 'Cancelar', exact: true }).click()
      expect(fs.existsSync(files.get('Gamma pesquisa')!)).toBe(true)
      await archive.getByRole('button', { name: 'Excluir Gamma pesquisa' }).click()
      await archive.getByRole('button', { name: 'Excluir', exact: true }).click()
      await expect.poll(() => fs.existsSync(files.get('Gamma pesquisa')!)).toBe(false)
      await window.keyboard.press('Escape')
      await expect(search).toHaveValue('')
      await window.keyboard.press('Escape')
      await expect(archive).toHaveCount(0)
    } finally {
      await app.close()
    }
  })

  test('@p1 user menu closes the real application without clearing the profile', async ({
    seeded
  }) => {
    const app = await launchSeededApp(seeded)
    const window = await app.firstWindow()
    await expect(window.locator('.wb-navbar')).toBeVisible({ timeout: 45_000 })
    await window.getByRole('button', { name: 'Menu do usuário: E2E' }).click()
    const closed = app.waitForEvent('close')
    await window.getByRole('menuitem', { name: 'Sair do Hive', exact: true }).click()
    await closed
    expect(
      JSON.parse(fs.readFileSync(path.join(seeded.userData, 'config.json'), 'utf-8')).userName
    ).toBe('E2E')
  })
})
