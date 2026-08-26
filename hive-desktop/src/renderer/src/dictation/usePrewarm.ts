import { useEffect } from 'react'

/**
 * Warms the transcription engine the moment a voice surface becomes reachable.
 *
 * D-VP-6 said "pre-warm on intent", and intent was read as `pointerenter` on
 * the microphone. That covers a mouse and nothing else: a keyboard user, the
 * `Ctrl+Shift+D` toggle, and the model gate's remembered intent after a
 * download all arrived at a **cold** engine, so their first phrase waited out
 * the whole session build with nothing on screen explaining why. Opening the
 * dictation tab, or the ask dialog, is intent too — it is a surface whose only
 * purpose is speaking — so that is where warming starts now, and the hover
 * remains as the earlier of the two.
 *
 * Warming is idempotent and process-wide (`whisperClient`), so being called
 * from several surfaces costs one build for the whole session.
 *
 * `ready` is what keeps this honest about M26: with no model installed there is
 * nothing to warm, and warming would mean starting a download nobody agreed to.
 */
export function usePrewarm(ready: boolean, prewarm: () => void): void {
  useEffect(() => {
    if (!ready) return
    // Named-and-invoked (the repo's `load()` pattern): the warm is a reaction
    // to the surface opening, not a bare call in an effect body.
    function warm(): void {
      prewarm()
    }
    warm()
  }, [ready, prewarm])
}
