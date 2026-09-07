import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClaudeLoginView } from './ClaudeSignInFlow'

/** Main's answer, read through the bridge (renderer never imports `src/main/*`). */
export type ClaudeStatus = Awaited<ReturnType<Window['hive']['claudeAuth']['status']>>

export interface ClaudeAuthSession {
  /** `null` until main answers — not "no account"; the surfaces draw a skeleton. */
  status: ClaudeStatus | null
  /** The live sign-in, or the idle state. Always present: main keeps one. */
  login: ClaudeLoginView
  /** Re-reads the machine. `force` pays for the spawn instead of taking the cache. */
  refresh: (force?: boolean) => void
  /**
   * Starts a sign-in, then re-reads. Resolves `true` only when the CLI came
   * back signed in — the chat waits on that to re-send the turn that failed
   * for want of an account.
   */
  connect: (mode?: 'claudeai' | 'console') => Promise<boolean>
  /** Hands the CLI the code the user copied out of the browser. */
  submitCode: (code: string) => void
  cancel: () => void
}

const IDLE_LOGIN: ClaudeLoginView = {
  phase: 'idle',
  mode: 'claudeai',
  url: null,
  codeError: null,
  message: null,
  startedAt: null,
  account: null
}

/**
 * The Claude account, as any surface in the app sees it.
 *
 * Two sources, and the difference between them is why this is a hook and not a
 * fetch:
 *
 *  - **`status`** costs a process — `claude auth status` measured 0.3 s against
 *    a native build and **5.9 s** against the npm shim under WSL. So it is read
 *    once when a surface opens, served from main's cache after that, and never
 *    polled. Nothing here runs on a timer.
 *  - **`login`** is subscribed, because it is a stream of things happening
 *    right now, and the live card has to move the instant main learns anything.
 *
 * A sign-in that lands re-reads the status with `force`, which is what makes
 * the panel say the right name the moment the browser comes back.
 */
export function useClaudeAuth(active = true, workspace?: string): ClaudeAuthSession {
  const [status, setStatus] = useState<ClaudeStatus | null>(null)
  const [login, setLogin] = useState<ClaudeLoginView>(IDLE_LOGIN)
  // Guards a `setState` after unmount on every async path below.
  const alive = useRef(true)
  // Whether the live stream has spoken yet. The initial `loginState()` read and
  // the subscription race, and the read can land second: a sign-in that starts
  // in the same tick as mount would then be overwritten by the "idle" snapshot
  // taken before it began. Same guard, same reason, as `useAwsSession`.
  const streamed = useRef(false)

  const refresh = useCallback(
    (force = false) => {
      void window.hive.claudeAuth.status(workspace, force).then((next) => {
        if (alive.current) setStatus(next)
      })
    },
    [workspace]
  )

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (!active) return
    refresh()
    void window.hive.claudeAuth.loginState().then((state) => {
      if (alive.current && !streamed.current) setLogin(state)
    })
  }, [active, refresh])

  useEffect(() => {
    if (!active) return undefined
    return window.hive.claudeAuth.onState((next) => {
      if (!alive.current) return
      streamed.current = true
      setLogin(next)
      // Any *ended* attempt changes the fact the panel is drawing — including a
      // cancelled one, since the user may have finished the same login in a
      // terminal meanwhile.
      if (next.phase === 'success' || next.phase === 'failed' || next.phase === 'canceled') {
        refresh(true)
      }
    })
  }, [active, refresh])

  const connect = useCallback(
    async (mode: 'claudeai' | 'console' = 'claudeai'): Promise<boolean> => {
      const result = await window.hive.claudeAuth.login(mode, workspace)
      if (alive.current) refresh(true)
      return result.ok
    },
    [refresh, workspace]
  )

  return {
    status,
    login,
    refresh,
    connect,
    submitCode: (code) => void window.hive.claudeAuth.submitCode(code),
    cancel: () => void window.hive.claudeAuth.cancel()
  }
}
