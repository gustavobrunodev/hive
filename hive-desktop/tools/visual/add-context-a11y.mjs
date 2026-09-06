// Keyboard + ARIA pass for the composer's add-context menu. Run AFTER
// tools/visual/boot.mjs.
//
// The menu is reached by a custom trigger handed to Radix through `asChild`,
// which is the arrangement this app has already broken once (the engine picker
// cloned a component that dropped every prop it was given, and the control
// simply could not be opened). Screenshots cannot see any of that, and neither
// can a test that renders a stubbed design system.
async (page) => {
  const out = []
  const composer = page.getByPlaceholder('Escreva uma mensagem…')
  const plus = page.getByRole('button', { name: 'Adicionar contexto' })
  const say = (label, ok, detail) => out.push({ label, ok, ...(detail ? { detail } : {}) })

  // 1. The trigger is a real button in the tab order, and announces a menu.
  await composer.click()
  say(
    'gatilho anuncia menu',
    (await plus.getAttribute('aria-haspopup')) === 'menu' &&
      (await plus.getAttribute('aria-expanded')) === 'false'
  )

  // 2. It opens from the keyboard alone, with the first row already active.
  await plus.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('menu').waitFor()
  await page.waitForTimeout(200)
  say('Enter abre o menu', (await plus.getAttribute('aria-expanded')) === 'true')
  const first = await page.evaluate(() => document.activeElement?.textContent ?? '')
  say('foco cai na primeira linha', first.startsWith('Arquivos do workspace'), first)

  // 3. Arrows move between the rows.
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(200)
  const second = await page.evaluate(() => document.activeElement?.textContent ?? '')
  say('seta desce para a segunda', second.startsWith('Arquivos do computador'), second)

  // 4. Escape closes and gives focus back to a control, not to the void.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  say('Esc fecha', (await page.getByRole('menu').count()) === 0)
  say(
    'Esc devolve o foco ao gatilho',
    await page.evaluate(
      () => document.activeElement?.getAttribute('aria-label') === 'Adicionar contexto'
    )
  )

  // 5. Committing a row hands focus to the composer instead — the user picked
  //    context in order to keep writing, and the `+` is the one place with
  //    nothing left to do.
  // Focused explicitly rather than leaning on step 4's restore: whether Escape
  // put focus back is that step's assertion, not this one's precondition.
  await plus.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('menu').waitFor()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(350)
  say(
    'escolher uma linha devolve o foco ao campo',
    await page.evaluate(
      () => document.activeElement?.getAttribute('placeholder') === 'Escreva uma mensagem…'
    )
  )
  say('e o cursor fica depois do @', (await composer.inputValue()) === '@')
  say('e o seletor de arquivos está aberto', await page.locator('.wb-mention-menu').isVisible())

  // 6. The rest of the app is NOT hidden while the menu is open: this menu is
  //    docked to a text field, and a modal one would mark the very composer the
  //    choice is about `aria-hidden` for assistive tech.
  await page.keyboard.press('Escape')
  await composer.fill('')
  await plus.click()
  await page.getByRole('menu').waitFor()
  say(
    'o app não fica aria-hidden com o menu aberto',
    (await composer.count()) === 1 && (await plus.count()) === 1
  )
  await page.keyboard.press('Escape')

  return JSON.stringify(out, null, 2)
}
