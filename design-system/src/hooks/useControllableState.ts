import { useCallback, useRef, useState } from "react"

export type UseControllableStateProps<T> = {
  value?: T
  defaultValue: T
  onChange?: (value: T) => void
}

/**
 * Standard "controllable state" pattern: when `value` is supplied the hook
 * is controlled (the prop is the single source of truth and `setValue`
 * merely reports the intended next value via `onChange`); when `value` is
 * `undefined` the hook is uncontrolled (it owns the state via `useState`,
 * seeded once from `defaultValue`, and also calls `onChange` on updates).
 *
 * Switching between controlled/uncontrolled mid-lifecycle is an edge case
 * React itself warns about for native inputs; this hook doesn't attempt to
 * guard against it beyond not letting the uncontrolled internal state leak
 * into a controlled render (the returned value always prefers the `value`
 * prop when present).
 */
export function useControllableState<T>({
  value: controlledValue,
  defaultValue,
  onChange,
}: UseControllableStateProps<T>): [T, (next: T) => void] {
  const isControlled = controlledValue !== undefined
  const [uncontrolledValue, setUncontrolledValue] = useState<T>(defaultValue)

  // Keep the latest onChange without re-creating setValue on every render.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const value = isControlled ? (controlledValue as T) : uncontrolledValue

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) {
        setUncontrolledValue(next)
      }
      onChangeRef.current?.(next)
    },
    [isControlled]
  )

  return [value, setValue]
}
