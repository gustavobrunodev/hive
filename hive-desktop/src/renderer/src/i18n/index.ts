import {
  ptBR,
  intentLabel,
  roleMeta,
  roleActionLabel,
  relativeTimeLabel,
  shortcutLabel,
  agentMeta,
  shellName,
  shellSigil,
  shellSupportNote,
  toolParamLabel,
  installStepLabelPtBR,
  provisionMessagesPtBR
} from './pt-BR'

export {
  intentLabel,
  roleMeta,
  roleActionLabel,
  relativeTimeLabel,
  shortcutLabel,
  agentMeta,
  shellName,
  shellSigil,
  shellSupportNote,
  toolParamLabel
}
export type { RoleMeta, ProvisionStage } from './pt-BR'

/** One raw install step, said in the product's own words (unknown steps pass through). */
export const installStepLabel = installStepLabelPtBR

/** Rotating reassurance for the provisioning gate, keyed by stage. */
export const provisionMessages = provisionMessagesPtBR

/** The (only, for MVP) locale's strings. Exposed for tests/tooling; components should use `t()`. */
export const strings = ptBR

type Strings = typeof ptBR
type AnyStringFn = (...args: never[]) => string

/** Dot-delimited paths to every leaf (string, or string-producing function) in `Strings`. */
type PathsOf<T> = T extends string
  ? never
  : T extends AnyStringFn
    ? never
    : {
        [K in Extract<keyof T, string>]: T[K] extends string
          ? K
          : T[K] extends AnyStringFn
            ? K
            : `${K}.${PathsOf<T[K]>}`
      }[Extract<keyof T, string>]

/** Resolves the value type at a dot-delimited path into `Strings`. */
type ValueAt<T, P extends string> = P extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? ValueAt<T[Head], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never

type ArgsFor<V> = V extends (...args: infer A) => string ? A : []
type ReturnFor<V> = V extends AnyStringFn ? string : V

/**
 * Typed accessor into the pt-BR strings module.
 *
 *   t('app.title')                    // -> 'Hive'
 *   t('theme.pickerLabelWithCurrent', t('theme.dark')) // -> 'Aparência (atual: Escuro)'
 *
 * There is only one locale in MVP scope, so this is a thin typed lookup over
 * `pt-BR.ts` — not a runtime i18n library. Adding a locale later means adding
 * a sibling strings module and a locale switch here; components never change.
 */
export function t<P extends PathsOf<Strings>>(
  path: P,
  ...args: ArgsFor<ValueAt<Strings, P>>
): ReturnFor<ValueAt<Strings, P>> {
  const value = path
    .split('.')
    .reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], ptBR)

  if (typeof value === 'function') {
    return (value as (...a: unknown[]) => string)(...args) as ReturnFor<ValueAt<Strings, P>>
  }

  return value as ReturnFor<ValueAt<Strings, P>>
}
