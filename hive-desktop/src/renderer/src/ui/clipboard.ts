/**
 * The one way this app puts text on the system clipboard.
 *
 * `navigator.clipboard.writeText()` is not it. In this window that call
 * rejects outright — the session's permission handler (main/index.ts) grants
 * only what the app needs, and every "Copiar caminho" in the Explorer used to
 * surface "Não foi possível concluir a ação" for exactly that reason. Even
 * with the permission granted (it now is, for third-party/design-system code
 * that reaches for the web API directly) the async Clipboard API additionally
 * requires the document to be focused, which a copy fired from a menu that is
 * already closing cannot promise.
 *
 * `window.hive.clipboard.writeText` goes to Electron's own clipboard in main,
 * which has neither constraint. The web API stays as a fallback purely so
 * component tests and the browser-served visual harness — where there is no
 * `window.hive` bridge — still exercise the same code path.
 */
export async function copyText(text: string): Promise<void> {
  const bridge = window.hive?.clipboard
  if (bridge) {
    await bridge.writeText(text)
    return
  }
  await navigator.clipboard?.writeText(text)
}
