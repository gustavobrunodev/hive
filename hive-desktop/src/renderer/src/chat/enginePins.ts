import { useCallback, useSyncExternalStore } from 'react'
import { effortsFor, pickInitial, type EngineCapabilities } from './engineOptions'

/**
 * engine-pins — the model (and rung) an agent **starts on**.
 *
 * Until this existed, the engine choice survived only as long as the chat pane
 * did: a ref keyed by agent id, thrown away on reload. Someone whose work is
 * always on one model re-picked it every session, on every surface, forever.
 * A pin is that choice made once and kept — per agent, because model ids are
 * not portable between them.
 *
 * ## Why a module-level store
 *
 * The pin is app-global, and four surfaces show an engine control at the same
 * time (the composer, the ingestion sheet, "Perguntar à base", the studio).
 * A hook that each of them loaded on its own would give four copies of the
 * truth, and pinning in one would leave the others claiming otherwise until
 * they happened to remount. So the cache lives here, once, and every hook
 * subscribes to it — `useSyncExternalStore`, which is what React offers for
 * exactly this shape.
 */

/** Structural mirror of `main/configStore.ts`'s `EnginePin`. */
export interface EnginePin {
  /** The option id, where `''` is the meaningful "let the CLI decide" row. */
  model: string
  /** `null` for an agent with no ladder, or a pin made on the delegated rung. */
  effort: string | null
}

export type EnginePins = Record<string, EnginePin>

const EMPTY: EnginePins = {}

/**
 * The snapshot every subscriber reads. `ready` is part of it because a
 * consumer has to be able to tell "no pins" from "not read yet": the engine
 * controls choose their opening model from the pin, and choosing before the
 * answer arrives would land on the CLI default and stay there.
 */
interface PinState {
  pins: EnginePins
  ready: boolean
}

const INITIAL: PinState = { pins: EMPTY, ready: false }

let state: PinState = INITIAL
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function publish(next: EnginePins): void {
  state = { pins: next, ready: true }
  for (const listener of listeners) listener()
}

/**
 * Reads the persisted set once per window, and hands every later caller the
 * same in-flight promise — four surfaces mounting together must not become
 * four IPC round trips.
 */
function ensureLoaded(): void {
  if (state.ready || loading !== null) return
  // The bridge is checked, not assumed. A pin is an enhancement on top of a
  // control that has to work regardless — and a renderer that threw here
  // because one namespace was missing would take the whole composer down with
  // it, which is exactly the failure mode `docs/visual-validation.md` records
  // for a harness whose mock aged out of the bridge.
  if (typeof window.hive?.agent?.pins !== 'function') {
    publish(EMPTY)
    return
  }
  loading = window.hive.agent
    .pins()
    .then(publish)
    .catch(() => {
      // A failed read is "no pins", never a broken control: the picker still
      // works, it just has no default to offer — and it says so by being
      // `ready` all the same, so nothing waits forever on a read that failed.
      publish(EMPTY)
    })
    .finally(() => {
      loading = null
    })
}

/** Test seam: forget the cache so the next subscriber re-reads it. */
export function resetEnginePins(): void {
  loading = null
  state = INITIAL
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  ensureLoaded()
  return () => {
    listeners.delete(listener)
  }
}

/** The pin under `agentId`, or `null` — including for an agent with no id yet. */
export function pinFor(all: EnginePins, agentId: string | null): EnginePin | null {
  if (agentId === null || agentId === '') return null
  return all[agentId] ?? null
}

/**
 * Where a freshly-loaded engine control should land, in one place so the four
 * surfaces cannot drift apart.
 *
 * The order is a decision each step of the way:
 *  1. what this surface already had (a session's own pick — never overruled
 *     by a pin the user set afterwards for *next* time);
 *  2. the pin, which is the whole point of pinning;
 *  3. `pickInitial`'s own rule — the CLI's default row, then the first row.
 *
 * A pinned id that no longer exists (a provider switch, an account change)
 * falls through to step 3 rather than being sent to a CLI that would reject
 * it — `pickInitial` already checks membership, which is why the pin can be
 * handed to it as just another candidate.
 */
export function initialEngine(
  capabilities: EngineCapabilities,
  pin: EnginePin | null,
  remembered?: { model?: string; effort?: string }
): { model: string | null; effort: string | null } {
  const model = pickInitial(capabilities.models, remembered?.model ?? pin?.model)
  const ladder = effortsFor(capabilities, model)
  const effort = pickInitial(ladder, remembered?.effort ?? pin?.effort ?? undefined)
  return { model, effort }
}

export interface EnginePinStore {
  /** Every agent's pin, as last read or written. */
  all: EnginePins
  /** This agent's pin, or `null`. */
  pin: EnginePin | null
  /**
   * Whether the persisted set has been read. Consumers that pick an opening
   * model wait for this — see `initialEngine`.
   */
  ready: boolean
  /** Pins this agent's engine; `null` unpins. A no-op without an agent id. */
  setPin: (pin: EnginePin | null) => void
}

/**
 * The pin store, scoped to one agent — what every engine control consumes.
 *
 * Writes are optimistic: the mark flips under the pointer and the disk catches
 * up. A rejected write re-reads rather than guessing, so the control can never
 * end up claiming a pin that isn't there.
 */
export function useEnginePins(agentId: string | null): EnginePinStore {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL
  )
  const setPin = useCallback(
    (next: EnginePin | null) => {
      if (agentId === null || agentId === '') return
      if (typeof window.hive?.agent?.pin !== 'function') return
      const optimistic = { ...state.pins }
      if (next === null) delete optimistic[agentId]
      else optimistic[agentId] = next
      publish(optimistic)
      void window.hive.agent
        .pin(agentId, next)
        .then(publish)
        .catch(() => {
          void window.hive.agent.pins().then(publish)
        })
    },
    [agentId]
  )
  return {
    all: snapshot.pins,
    pin: pinFor(snapshot.pins, agentId),
    ready: snapshot.ready,
    setPin
  }
}
