import { useState } from 'react'

/**
 * Which layers have ever been shown — lazy on the way in, kept forever after.
 *
 * Both of the app's layer stacks want this rule. The sidebar swaps the
 * conversation list, the file tree and the diff list; the work pane swaps the
 * transcript and the two chat tools. In each, leaving a layer has to cost
 * nothing: unmounting the Explorer is what used to close every folder and
 * scroll the tree back to the top, and unmounting `Chat` would drop a turn
 * that is still streaming.
 *
 * The update happens during render (React's own "adjusting state during
 * render" pattern) rather than in an effect. An effect would paint one empty
 * frame on the first visit to a layer, which is a flash on every first switch.
 *
 * @param active the layer on screen now — mounted if it never has been
 * @param initial layers to mount from the very first frame, whatever is active
 */
export function useMountedLayers<T extends string>(
  active: T,
  initial: readonly T[] = []
): readonly T[] {
  const [mounted, setMounted] = useState<readonly T[]>(() =>
    initial.includes(active) ? initial : [...initial, active]
  )
  if (!mounted.includes(active)) setMounted([...mounted, active])
  return mounted
}
