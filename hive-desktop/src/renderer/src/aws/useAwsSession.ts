import { useCallback, useEffect, useRef, useState } from 'react'
import type { AwsLoginView } from './AwsLoginFlow'

/** Main's answer, read through the bridge (renderer never imports `src/main/*`). */
export type AwsStatus = Awaited<ReturnType<Window['hive']['aws']['status']>>

export interface AwsSessionState {
  /** `null` until main answers — not "no session"; see `useAsrReadiness` for the same rule. */
  status: AwsStatus | null
  /** The live login, or the idle state. Always present: main keeps one. */
  login: AwsLoginView
  /** Re-reads the machine (after a login, after switching profile). */
  refresh: () => void
  /** Starts a login on `profile` (or the detected one), then re-reads. */
  connect: (profile?: string | null) => void
  cancel: () => void
  /** Pins a profile in Hive (or `null` to go back to detection) and re-reads. */
  chooseProfile: (name: string | null) => void
}

const IDLE_LOGIN: AwsLoginView = {
  phase: 'idle',
  profile: null,
  url: null,
  code: null,
  message: null,
  startedAt: null,
  expiresAt: null
}

/**
 * How often a *visible* status re-reads itself.
 *
 * The expiry is a countdown, so the panel would go stale without this — but the
 * read is files-only and the number it drives changes at minute granularity, so
 * a minute is exactly right. The subscription to the login stream is what
 * carries everything that happens faster than that.
 */
const REFRESH_MS = 60_000

/**
 * The AWS session, as any surface in the app sees it.
 *
 * Two sources, deliberately different in kind:
 *
 *  - **`status`** is polled, because it is a fact about disk that changes on
 *    its own (a token expires; someone runs `aws sso login` in a terminal).
 *  - **`login`** is subscribed, because it is an event stream about something
 *    happening right now, and the whole point of the live surface is that it
 *    moves the instant main learns something.
 *
 * A login that lands re-reads the status, which is what makes the panel's
 * countdown correct the moment the browser comes back — without that, the
 * surface that just said "connected" would keep showing "expired" for up to a
 * minute.
 */
export function useAwsSession(active = true, workspace?: string): AwsSessionState {
  const [status, setStatus] = useState<AwsStatus | null>(null)
  const [login, setLogin] = useState<AwsLoginView>(IDLE_LOGIN)
  // Guards a `setState` after unmount on every async path below.
  const alive = useRef(true)
  // Whether the live stream has spoken yet.
  //
  // The initial `loginState()` read and the subscription race, and the read can
  // land second: a login that starts in the same tick as mount would then be
  // overwritten by the "idle" snapshot taken before it began, and the beacon
  // would vanish mid-login. The stream is always the newer truth, so once it
  // has spoken the initial read is dropped.
  const streamed = useRef(false)

  const refresh = useCallback(() => {
    void window.hive.aws.status(workspace).then((next) => {
      if (alive.current) setStatus(next)
    })
  }, [workspace])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (!active) return undefined
    refresh()
    void window.hive.aws.loginState().then((state) => {
      if (alive.current && !streamed.current) setLogin(state)
    })
    const timer = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timer)
  }, [active, refresh])

  useEffect(() => {
    if (!active) return undefined
    return window.hive.aws.onState((next) => {
      if (!alive.current) return
      streamed.current = true
      setLogin(next)
      // Any *ended* attempt changes the fact the panel is drawing — and not
      // only a successful one. A login that failed leaves the panel claiming
      // whatever it last read, which may be an hour old; and a cancelled one
      // may still have landed a session in a terminal meanwhile. Re-reading is
      // one file read.
      if (next.phase === 'success' || next.phase === 'failed' || next.phase === 'canceled') {
        refresh()
      }
    })
  }, [active, refresh])

  const connect = useCallback(
    (profile?: string | null) => {
      void window.hive.aws.login(profile ?? null, workspace).then(() => {
        if (alive.current) refresh()
      })
    },
    [refresh, workspace]
  )

  const chooseProfile = useCallback(
    (name: string | null) => {
      void window.hive.aws.setProfile(name).then(() => {
        if (alive.current) refresh()
      })
    },
    [refresh]
  )

  return {
    status,
    login,
    refresh,
    connect,
    cancel: () => void window.hive.aws.cancel(),
    chooseProfile
  }
}
