/**
 * Where the native `sherpa-onnx-node` addon is, packaged and unpackaged (M29).
 *
 * This file exists because of one measured trap. The addon package's own
 * `addon.js` locates its `.node` binary by walking **relative paths** from its
 * `__dirname` (`../sherpa-onnx-<platform>-<arch>/sherpa-onnx.node`) and, when
 * those miss, by guessing from `process.env.PWD`. Inside an asar archive both
 * strategies fail: the relative walk lands on a virtual path Node cannot
 * `dlopen`, and `PWD` is wherever the user launched the app from. The package
 * then resolves to `undefined` rather than throwing, so the first symptom is
 * `Cannot read properties of undefined (reading 'OfflineRecognizer')` at the
 * moment someone first tries to speak.
 *
 * The fix has two halves and needs both: `electron-builder.yml` unpacks
 * `node_modules/sherpa-onnx*` so the real files exist on disk, and this
 * resolver points `require` at that unpacked tree so the package's own relative
 * walk starts somewhere true.
 */

/** The directory name electron-builder unpacks alongside the archive. */
const UNPACKED = 'app.asar.unpacked'

export interface AddonPathDeps {
  /** `app.getAppPath()` — ends in `app.asar` when packaged. */
  appPath: string
  /** `app.isPackaged`. */
  packaged: boolean
}

/**
 * The specifier to hand `require`.
 *
 * Unpackaged (dev, and the E2E's unpacked build) the plain package name is
 * correct and Node's own resolution finds the sibling platform package. Only a
 * packaged app needs the redirect.
 */
export function sherpaModuleSpecifier(deps: AddonPathDeps): string {
  if (!deps.packaged) return 'sherpa-onnx-node'
  const root = deps.appPath.endsWith('.asar')
    ? deps.appPath.replace(/\.asar$/, '.asar' + UNPACKED.slice('app.asar'.length))
    : deps.appPath
  return `${root}/node_modules/sherpa-onnx-node`
}

/**
 * The platform package that carries the binary, for the `asarUnpack` glob and
 * for an error message that can name what is missing.
 *
 * The `win32` → `win` rename is the addon package's own: the author renamed it
 * away from `sherpa-onnx-win32-x64` because that name attracted spam.
 */
export function sherpaBinaryPackage(platform: string, arch: string): string {
  return `sherpa-onnx-${platform === 'win32' ? 'win' : platform}-${arch}`
}
