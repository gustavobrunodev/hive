import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Guard for PRODUCT.md's accessibility floor: "`prefers-reduced-motion`
 * alternatives for every animation" (P2-016, risk R-05).
 *
 * `workbench.css` has no blanket `* { animation: none }` reset — every
 * animated rule carries its own opt-out, which is deliberate (a global reset
 * would also kill the *substitutions* below) but means a newly added
 * animation is silently uncovered unless something checks. This is that
 * something: it fails on the rule that was added without an alternative,
 * naming the selector.
 *
 * Four alternative shapes are recognised, because the stylesheet uses all
 * four and all four honour the preference:
 *
 *   1. `transition: none` / `animation: none` inside
 *      `@media (prefers-reduced-motion: reduce)` — the common case.
 *   2. `animation-name:` substitution inside that media block — swapping a
 *      travelling keyframe for a fade (`.wb-brain-nudge`).
 *   3. `animation-duration:` substitution inside that block — slowing a
 *      continuous spinner rather than freezing it, which would strand the
 *      only "still working" signal (`.wb-mcp-status-spin`).
 *   4. A `[data-reduced-motion]` variant selector outside any media block —
 *      the JS-driven attribute `UpdateNotice.tsx` sets from
 *      `usePrefersReducedMotion`, chosen there precisely so the reduced path
 *      is unit-testable by mocking `matchMedia`.
 *
 * Coverage is matched on the *exact* normalised selector (with
 * `[data-reduced-motion]` stripped for shape 4). Matching loosely — say, by
 * shared class name — would credit `.wb-bar { transition: none }` for
 * `.wb-foo .wb-bar`, which CSS specificity means it does not actually
 * override. A false pass here is worse than a false failure: it is the
 * silence this guard exists to break.
 */

export interface MotionViolation {
  selector: string
  properties: string[]
}

/**
 * Properties whose animation forces layout on every frame. Animating them
 * hands the main thread a reflow 60 times a second, and in a composer that is
 * also running an audio graph and a transcription queue that is the difference
 * between a mode change and a stutter (VP-R6.1).
 */
const LAYOUT_PROPERTIES = [
  'width',
  'height',
  'top',
  'right',
  'bottom',
  'left',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'inset',
  'font-size',
  'line-height',
  'gap'
]

/**
 * Every `transition` that names a layout-affecting property, as
 * `selector (property)`. `transition: all` counts: it animates whatever
 * changes, which is the same promise with the evidence removed.
 */
export function findLayoutTransitions(cssText: string): string[] {
  const source = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
  const found: string[] = []
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = normalise(match[1])
      .replace(/^.*[{;]/, '')
      .trim()
    for (const declaration of match[2].split(';')) {
      const [rawProperty, rawValue] = declaration.split(':')
      if (rawProperty === undefined || rawValue === undefined) continue
      if (normalise(rawProperty) !== 'transition') continue
      const value = normalise(rawValue)
      if (value === 'none') continue
      for (const property of value.split(',')) {
        const name = normalise(property).split(' ')[0]
        if (name === 'all' || LAYOUT_PROPERTIES.includes(name)) {
          found.push(`${selector} (${name})`)
        }
      }
    }
  }
  return found
}

interface Frame {
  head: string
  isReducedMedia: boolean
  isAtRule: boolean
}

const normalise = (value: string): string => value.replace(/\s+/g, ' ').trim()

const REDUCED_MOTION_MEDIA = /@media[^{]*prefers-reduced-motion\s*:\s*reduce/
const REDUCED_MOTION_ATTR = '[data-reduced-motion]'

/**
 * Returns every rule that starts motion without a reduced-motion
 * alternative. Hand-rolled rather than PostCSS-based: the whole contract is
 * "selector declares motion" / "selector is named in an opt-out", which needs
 * brace depth and nothing else — and adding a CSS parser to the renderer's
 * devDependencies to answer that would cost more than it explains.
 */
export function findMotionViolations(cssText: string): MotionViolation[] {
  const source = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
  const animated: MotionViolation[] = []
  const reduced = new Set<string>()
  const dataReduced = new Set<string>()
  const stack: Frame[] = []
  let buffer = ''

  for (const character of source) {
    if (character === '{') {
      const head = normalise(buffer)
      buffer = ''
      stack.push({
        head,
        isReducedMedia: REDUCED_MOTION_MEDIA.test(head),
        isAtRule: head.startsWith('@')
      })
      continue
    }

    if (character === '}') {
      const frame = stack.pop()
      const body = buffer
      buffer = ''
      if (!frame || frame.isAtRule) continue

      const insideReducedMedia = stack.some((entry) => entry.isReducedMedia)
      const declaresMotion = /(^|[\s;])(animation|transition)(-[\w-]+)?\s*:/.test(body)
      const animationOff = /animation\s*:\s*none/.test(body)
      const transitionOff = /transition\s*:\s*none/.test(body)
      const startsAnimation = /(^|[\s;])animation\s*:/.test(body) && !animationOff
      const startsTransition = /(^|[\s;])transition\s*:/.test(body) && !transitionOff

      for (const selector of frame.head.split(',').map(normalise).filter(Boolean)) {
        if (insideReducedMedia) {
          if (declaresMotion) reduced.add(selector)
          continue
        }
        if (selector.includes(REDUCED_MOTION_ATTR)) {
          if (declaresMotion) {
            dataReduced.add(normalise(selector.replace(REDUCED_MOTION_ATTR, '')))
          }
          continue
        }
        const properties: string[] = []
        if (startsAnimation) properties.push('animation')
        if (startsTransition) properties.push('transition')
        if (properties.length > 0) animated.push({ selector, properties })
      }
      continue
    }

    buffer += character
  }

  return animated.filter(({ selector }) => !reduced.has(selector) && !dataReduced.has(selector))
}

describe('prefers-reduced-motion alternatives (P2-016, PRODUCT.md a11y floor)', () => {
  it('flags an animated rule with no alternative, naming the selector', () => {
    const violations = findMotionViolations(`
      .wb-thing { transition: background-color 0.15s ease; }
    `)
    expect(violations).toEqual([{ selector: '.wb-thing', properties: ['transition'] }])
  })

  it('accepts an opt-out inside a reduced-motion media block', () => {
    const violations = findMotionViolations(`
      .wb-thing { transition: background-color 0.15s ease; }
      @media (prefers-reduced-motion: reduce) {
        .wb-thing { transition: none; }
      }
    `)
    expect(violations).toEqual([])
  })

  it('accepts an animation-name substitution, not just a freeze', () => {
    const violations = findMotionViolations(`
      .wb-nudge { animation: wb-nudge-in 220ms ease; }
      @media (prefers-reduced-motion: reduce) {
        .wb-nudge { animation-name: wb-nudge-fade; }
      }
    `)
    expect(violations).toEqual([])
  })

  it('accepts an animation-duration substitution (a slowed, not stopped, spinner)', () => {
    const violations = findMotionViolations(`
      .wb-spin { animation: wb-spin 0.7s linear infinite; }
      @media (prefers-reduced-motion: reduce) {
        .wb-spin { animation-duration: 1.6s; }
      }
    `)
    expect(violations).toEqual([])
  })

  it('accepts a [data-reduced-motion] variant outside any media block', () => {
    const violations = findMotionViolations(`
      .wb-toast[data-state='open'] { animation: wb-toast-in 200ms ease; }
      .wb-toast[data-reduced-motion][data-state='open'] { animation: wb-toast-fade 120ms linear; }
    `)
    expect(violations).toEqual([])
  })

  it('does not credit a shared class name across differing selectors', () => {
    const violations = findMotionViolations(`
      .wb-foo .wb-bar { transition: transform 0.2s ease; }
      @media (prefers-reduced-motion: reduce) {
        .wb-bar { transition: none; }
      }
    `)
    expect(violations).toEqual([{ selector: '.wb-foo .wb-bar', properties: ['transition'] }])
  })

  it('ignores a rule that only turns motion off', () => {
    expect(findMotionViolations(`.wb-thing { transition: none; }`)).toEqual([])
  })

  it('flags a transition on a layout-affecting property, and on `all`', () => {
    expect(
      findLayoutTransitions(`
        .wb-a { transition: height 0.2s ease; }
        .wb-b { transition: all 0.2s ease; }
        .wb-c { transition: opacity 0.2s ease, transform 0.2s ease; }
        .wb-d { transition: none; }
      `)
    ).toEqual(['.wb-a (height)', '.wb-b (all)'])
  })

  // VP-R6.1: the dictation surface animates opacity and transform only. The
  // whole point of the in-place mode change is that nothing moves that the
  // user was already looking at.
  it('the dictation block animates no layout property', () => {
    const stylesheet = readFileSync(join(__dirname, 'workbench.css'), 'utf-8')
    const dictationRules = findLayoutTransitions(stylesheet).filter(
      (entry) => entry.includes('wb-dictation') || entry.includes('wb-composer-fresh')
    )
    expect(dictationRules).toEqual([])
  })

  it('every animated rule in workbench.css has a reduced-motion alternative', () => {
    const stylesheet = readFileSync(join(__dirname, 'workbench.css'), 'utf-8')
    const violations = findMotionViolations(stylesheet)

    expect(violations.map((v) => `${v.selector} (${v.properties.join(', ')})`)).toEqual([])
  })
})
