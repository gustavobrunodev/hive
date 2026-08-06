import type { Capture } from './micCapture'
import type { DictationEngine } from './useDictation'
import type { Tick } from './segmenter'

/**
 * The dictation E2E seam (VP-R7.3) — a stand-in microphone and transcriber for
 * a real-Electron run.
 *
 * **Why a seam at all.** The T1 spike measured it: under `xvfb-run` the audio
 * graph's render quantum is driven by an output device, and there is none, so
 * a live `AudioContext` produces **1 tick in 2 s** instead of 63 while
 * cheerfully reporting `state: 'running'`. Real audio cannot flow in the
 * environment the E2E runs in, and a real Whisper pass would add ~4 s and a
 * 278 MB model download to every run. So capture and the engine are replaced;
 * everything above them — the segmenter, the queue, the join, the caret
 * restoration, the transport, the composer, the CSP, the real preload bridge —
 * stays production code inside the test.
 *
 * **Why this one lives in the renderer, unlike `e2eAgentSeam.ts`.** This
 * feature's design promises zero new main-process code and zero new IPC
 * (context.md), and adding a bridge just to tell the renderer "you are under
 * test" would spend that promise on a test. So the seam is armed by a global
 * the embedder sets before app code runs, which in practice only Playwright's
 * `addInitScript` can do: the renderer is a sandboxed `file://` page that loads
 * no remote content.
 *
 * **Why one condition here, where the agent seam insisted on two.** That seam
 * redirects *program execution* — it decides which binary the app spawns — so a
 * stray environment variable there is a real security surface, and it demands
 * both an explicit opt-in and an existing path. This one substitutes a
 * microphone and a transcript inside a sandboxed renderer. The worst a stray
 * global can do is make dictation fake. The blast radius, not the convenience,
 * is the reason for the difference.
 */

/** What the harness injects. Every field is optional; absent means "be real". */
export interface DictationE2EHarness {
  /** Pushed by the test to drive the segmenter, in place of a microphone. */
  ticks?: ((tick: Tick) => void)[]
  /** What the stand-in transcriber returns for every segment. */
  transcript?: string
  /** Set by the seam so the test can assert the microphone was released. */
  stops?: number
}

interface SeamScope {
  __hiveDictationE2E?: DictationE2EHarness
}

/** The harness, or `null` when the app is running for real. */
export function dictationHarness(
  scope: SeamScope | undefined = globalThis as SeamScope
): DictationE2EHarness | null {
  return scope?.__hiveDictationE2E ?? null
}

/**
 * A `startCapture` stand-in that the test drives, or `null` to use the real
 * one. The returned capture holds no device and no `AudioContext`; it counts
 * its stops so the E2E can still assert the release path ran.
 */
export function e2eStartCapture(scope?: SeamScope): (() => Promise<Capture>) | null {
  const harness = dictationHarness(scope)
  if (harness === null) return null
  return async () => {
    const listeners = (harness.ticks ??= [])
    return {
      onTick: (listener) => listeners.push(listener),
      onLevels: () => undefined,
      stop: () => {
        harness.stops = (harness.stops ?? 0) + 1
        listeners.length = 0
      }
    }
  }
}

/** A transcriber stand-in returning the harness's fixed transcript, or `null`. */
export function e2eDictationEngine(scope?: SeamScope): DictationEngine | null {
  const harness = dictationHarness(scope)
  if (harness === null) return null
  return {
    phase: { status: 'idle' },
    transcribe: async () => harness.transcript ?? ''
  }
}
