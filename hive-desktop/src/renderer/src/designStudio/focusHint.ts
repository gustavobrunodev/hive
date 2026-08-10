/**
 * Design Studio (M18) — T4.8. The Focus Mode hint, offered once (design.md
 * §3.8).
 *
 * A hint that returns every time the tab is narrow is not a hint, it is a
 * nag — the user who ignored it once has decided. Module scope rather than
 * component state on purpose: "once" means once for the app session, across
 * every Studio tab, not once per mount.
 */

let offered = false

/** `true` exactly the first time it is asked in this app session. */
export function takeFocusHint(): boolean {
  if (offered) return false
  offered = true
  return true
}

/** Test seam — the module-level flag would otherwise leak between cases. */
export function resetFocusHint(): void {
  offered = false
}
