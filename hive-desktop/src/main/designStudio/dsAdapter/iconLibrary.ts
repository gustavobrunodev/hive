/**
 * Design Studio (M18) — T2.6. The local icon library (R-1, D-DS-8).
 *
 * P-6 (measured): `wa-icon` resolves every icon through a Font Awesome CDN
 * (`ka-f.fontawesome.com`) and the DS package ships **zero** `.svg` files. That
 * is the quiet failure this file exists to prevent: with the network gone —
 * the Preview under `connect-src 'none'`, or an exported Bundle opened offline
 * — every icon would simply not appear, with no error the user could act on.
 *
 * So the Studio registers its own `default` library over an icon set embedded
 * in the bundle at build time. This module is the pure half: which icons ship,
 * how a `(name, family, variant)` triple maps onto them, and how one becomes a
 * URL. `scripts/buildDsBundle.mjs` reads it, inlines the matching SVGs from
 * `@fortawesome/fontawesome-free`, and emits the `registerIconLibrary` call —
 * the same split as `catalogBuild.ts` and `buildDsCatalog.mjs`.
 *
 * Icons are Font Awesome Free (CC BY 4.0); the attribution travels with the
 * bundle as a legal comment.
 */

export const ICON_ATTRIBUTION =
  'Font Awesome Free 7.x by @fontawesome — Icons: CC BY 4.0, Fonts: SIL OFL 1.1, ' +
  'Code: MIT License. Copyright Fonticons, Inc.'

/**
 * The icons that ship. A fixed list rather than "all of them": Font Awesome
 * Free is 1.2 MB of solid SVGs alone, and DS-R14 asks every exported Screen to
 * carry the whole design system inline. This is the general-purpose UI set a
 * generated Screen actually reaches for, kept inside the bundle's size budget.
 *
 * An icon outside the list resolves to nothing rather than to the network —
 * see `createLocalIconResolver`.
 */
export const LOCAL_SOLID_ICONS = [
  'address-book',
  'align-center',
  'align-left',
  'align-right',
  'angle-down',
  'angle-left',
  'angle-right',
  'angle-up',
  'arrow-down',
  'arrow-left',
  'arrow-right',
  'arrow-up',
  'arrow-up-right-from-square',
  'arrows-rotate',
  'ban',
  'bars',
  'bell',
  'bolt',
  'book',
  'bookmark',
  'briefcase',
  'bug',
  'building',
  'calendar-days',
  'camera',
  'cart-shopping',
  'chart-line',
  'chart-pie',
  'check',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'chevron-up',
  'circle',
  'circle-check',
  'circle-exclamation',
  'circle-info',
  'circle-minus',
  'circle-plus',
  'circle-question',
  'circle-xmark',
  'clock',
  'cloud',
  'code',
  'comment',
  'comments',
  'compress',
  'copy',
  'credit-card',
  'database',
  'download',
  'ellipsis',
  'ellipsis-vertical',
  'envelope',
  'expand',
  'eye',
  'eye-slash',
  'face-smile',
  'file',
  'file-lines',
  'filter',
  'fire',
  'folder',
  'folder-open',
  'gear',
  'gift',
  'globe',
  'graduation-cap',
  'heart',
  'house',
  'id-card',
  'image',
  'key',
  'language',
  'lightbulb',
  'link',
  'list',
  'list-check',
  'list-ol',
  'list-ul',
  'location-dot',
  'lock',
  'lock-open',
  'magnifying-glass',
  'map',
  'microphone',
  'minus',
  'moon',
  'newspaper',
  'palette',
  'paperclip',
  'paper-plane',
  'pause',
  'pen',
  'pen-to-square',
  'phone',
  'play',
  'plus',
  'print',
  'right-from-bracket',
  'right-to-bracket',
  'rocket',
  'rotate-right',
  'share-nodes',
  'shield-halved',
  'sliders',
  'spinner',
  'star',
  'sun',
  'table',
  'tag',
  'thumbs-down',
  'thumbs-up',
  'trash-can',
  'triangle-exclamation',
  'truck',
  'upload',
  'user',
  'users',
  'video',
  'wallet',
  'wrench',
  'xmark'
] as const

/** Brand marks a sign-in or a footer plausibly needs. */
export const LOCAL_BRAND_ICONS = [
  'apple',
  'discord',
  'facebook',
  'figma',
  'github',
  'google',
  'instagram',
  'linkedin',
  'microsoft',
  'slack',
  'whatsapp',
  'x-twitter',
  'youtube'
] as const

/** `<folder>/<name>` — the key an embedded icon is stored under. */
export function iconKey(folder: string, name: string): string {
  return `${folder}/${name}`
}

export function localIconKeys(): string[] {
  return [
    ...LOCAL_SOLID_ICONS.map((name) => iconKey('solid', name)),
    ...LOCAL_BRAND_ICONS.map((name) => iconKey('brands', name))
  ]
}

/**
 * The Font Awesome folder a `wa-icon` maps to. Web Awesome's own resolver knows
 * a dozen Pro families; the free tier this bundle embeds has `solid` and
 * `brands`, and anything else falls back to `solid` rather than to a fetch.
 */
export function iconFolder(family: string | undefined, variant: string | undefined): string {
  if (family === 'brands') return 'brands'
  return variant === 'brands' ? 'brands' : 'solid'
}

/** An SVG string as an inline URL — no request leaves the document. */
export function iconDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export type IconResolver = (name: string, family?: string, variant?: string) => string | undefined

/**
 * Builds the resolver `registerIconLibrary('default', …)` is given.
 *
 * An unknown icon resolves to `undefined`, which makes `wa-icon` render nothing
 * and fire its error event. That is deliberate: the alternative — falling back
 * to the vendor resolver — is a silent network request, which is the entire
 * failure R-1 describes.
 */
export function createLocalIconResolver(icons: Record<string, string>): IconResolver {
  const cache = new Map<string, string>()
  return (name, family, variant) => {
    const key = iconKey(iconFolder(family, variant), name)
    const cached = cache.get(key)
    if (cached) return cached
    const svg = icons[key] ?? icons[iconKey('solid', name)]
    if (!svg) return undefined
    const url = iconDataUrl(svg)
    cache.set(key, url)
    return url
  }
}
