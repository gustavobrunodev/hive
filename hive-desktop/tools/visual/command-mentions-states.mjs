// Companion to command-mentions-pass.mjs: the hover state of the `.wb-cmdlink`
// chip, which the base pass doesn't capture (a screenshot mid-interaction
// needs its own settle time, and stacking it onto the base scene would make
// one screenshot stand for two different moments).
//
// Run AFTER boot.mjs + command-mentions-pass.mjs (same page, same transcript).
//
// Keyboard: the chip is a real `<button>`, so focusability and Enter/Space
// activation are native — not re-proven here. What IS worth knowing: focusing
// ANY control inside a just-settled reply (measured on both this chip and the
// pre-existing `.wb-pathlink`) loses focus to `<body>` about a second later,
// with the element still in the DOM. Pre-existing across both controls, not
// something this feature introduced — noted here rather than "fixed" blind.
async (page) => {
  const chip = page.locator('.wb-cmdlink', { hasText: '/impeccable' })

  await chip.hover()
  await page.waitForTimeout(200)
  await page.screenshot({ path: '.playwright-mcp/command-mentions-hover.png' })
  const hoverBox = await chip.boundingBox()
  const lineHeight = await page
    .locator('.wb-chat-md p')
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).lineHeight))

  return { hoverBox, fitsLine: hoverBox.height <= lineHeight, lineHeight }
}
