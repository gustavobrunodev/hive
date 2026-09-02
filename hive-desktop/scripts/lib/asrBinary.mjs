import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { extract } from 'tar'

/**
 * Puts the **target platform's** `sherpa-onnx` binary on disk before packing.
 *
 * This file exists because of a bug that reached a user (2026-09-02): a Windows
 * installer built on Linux transcribed nothing, and said
 * `Could not find sherpa-onnx-node. Tried ../sherpa-onnx-win-x64/sherpa-onnx.node`.
 *
 * The cause is npm doing exactly what it is told. `sherpa-onnx-node` ships its
 * native binary in six per-platform packages, each declared
 * `"os": ["win32"], "cpu": ["x64"]` and friends, and npm installs **only the
 * one matching the host**. So a Linux dev box has `sherpa-onnx-linux-x64` and
 * nothing else — and `electron-builder --win` happily packaged an app whose
 * only native binary was a Linux `.so`. Nothing in the build had an opinion
 * about that, which is why it shipped.
 *
 * The cross-platform install flags do not help: `npm install --os=win32` still
 * refuses a direct dependency with `EBADPLATFORM` (measured). `npm pack` has no
 * such gate — it just fetches the tarball — so that is what this uses.
 */

/**
 * The platform package that carries the binary.
 *
 * The `win32` → `win` rename is the addon author's own (the fuller name
 * attracted spam), and it is mirrored in `src/main/asr/asrAddon.ts` — the
 * runtime resolver and this build step have to agree on the name or the app
 * looks for something the installer never put there.
 */
export function sherpaPackageFor(platformName, archName) {
  return `sherpa-onnx-${platformName === 'win32' ? 'win' : platformName}-${archName}`
}

/** electron-builder's `Arch` enum, which crosses the hook boundary as a number. */
const ARCH_NAMES = ['ia32', 'x64', 'armv7l', 'arm64', 'universal']

/**
 * Every package a target needs. `universal` is two real binaries, not one:
 * a macOS universal build is an x64 slice and an arm64 slice merged, and each
 * carries its own copy of the addon.
 */
export function packagesForTarget(platformName, arch) {
  const archName = ARCH_NAMES[arch] ?? String(arch)
  if (platformName === 'darwin' && archName === 'universal') {
    return [sherpaPackageFor(platformName, 'x64'), sherpaPackageFor(platformName, 'arm64')]
  }
  return [sherpaPackageFor(platformName, archName)]
}

const root = resolve(import.meta.dirname, '..', '..')

/** The version to fetch: whatever `sherpa-onnx-node` itself resolved to. */
function wrapperVersion() {
  const manifest = join(root, 'node_modules', 'sherpa-onnx-node', 'package.json')
  if (!existsSync(manifest)) {
    throw new Error('sherpa-onnx-node is not installed — run `npm install` before building.')
  }
  return JSON.parse(readFileSync(manifest, 'utf8')).version
}

/** The file whose absence is the whole bug. */
function binaryPath(pkg) {
  return join(root, 'node_modules', pkg, 'sherpa-onnx.node')
}

/**
 * Fetches one platform package into `node_modules`.
 *
 * Deliberately **not** `npm install`: this must not touch `package-lock.json`
 * or the dependency tree. The package is already declared — it is an
 * `optionalDependency` of `sherpa-onnx-node`, which is what lets
 * electron-builder include it once it exists — so the only thing missing is
 * the bytes, and the only thing this does is put them there.
 */
function fetchPackage(pkg, version) {
  const staging = mkdtempSync(join(tmpdir(), 'hive-asr-'))
  try {
    try {
      execFileSync('npm', ['pack', `${pkg}@${version}`, '--pack-destination', staging], {
        stdio: ['ignore', 'ignore', 'inherit']
      })
    } catch (cause) {
      // Almost always the network. Said plainly, because the alternative is a
      // raw `spawnSync npm ENOENT` two hours into a release.
      throw new Error(
        `Could not fetch ${pkg}@${version} from npm — the ASR binary for this ` +
          'target is not on disk and cannot be downloaded. Check the network ' +
          'and try again; the build cannot produce a working app without it.',
        { cause }
      )
    }
    const tarball = readdirSync(staging).find((name) => name.endsWith('.tgz'))
    if (tarball === undefined) throw new Error(`npm pack produced no tarball for ${pkg}`)
    const destination = join(root, 'node_modules', pkg)
    rmSync(destination, { recursive: true, force: true })
    mkdirSync(destination, { recursive: true })
    // `strip: 1` drops the `package/` prefix every npm tarball carries.
    extract({ file: join(staging, tarball), cwd: destination, strip: 1, sync: true })
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

/** `beforePack` — makes sure the target's binary exists. Throws if it cannot. */
export function ensureAsrBinary(context) {
  const version = wrapperVersion()
  for (const pkg of packagesForTarget(context.electronPlatformName, context.arch)) {
    if (existsSync(binaryPath(pkg))) continue
    console.log(`  • fetching ${pkg}@${version} (native ASR binary for this target)`)
    fetchPackage(pkg, version)
    if (!existsSync(binaryPath(pkg))) {
      throw new Error(`${pkg} was fetched but has no sherpa-onnx.node — refusing to package.`)
    }
  }
}

/**
 * `afterPack` — asserts the binary is in the packaged tree.
 *
 * The build that shipped broken was not missing a check that failed; it was
 * missing a check. `beforePack` can put the file in `node_modules` and still
 * leave the app broken if the `files`/`asarUnpack` rules drop it again, and the
 * only place that is observable is the output directory. So this reads the
 * actual packaged app, not the intent.
 */
export function verifyAsrBinary(context) {
  const resourcesDir =
    context.electronPlatformName === 'darwin'
      ? join(
          context.appOutDir,
          `${context.packager.appInfo.productFilename}.app`,
          'Contents',
          'Resources'
        )
      : join(context.appOutDir, 'resources')
  const unpacked = join(resourcesDir, 'app.asar.unpacked', 'node_modules')

  for (const pkg of packagesForTarget(context.electronPlatformName, context.arch)) {
    const binary = join(unpacked, pkg, 'sherpa-onnx.node')
    if (!existsSync(binary)) {
      throw new Error(
        `Packaged app has no ASR binary at ${binary}.\n` +
          'Transcription would fail at runtime with "Could not find sherpa-onnx-node".'
      )
    }
  }

  // The wrapper resolves its binary by walking from its own directory, so it
  // has to be unpacked too — inside the asar that walk lands on a path Node
  // cannot `dlopen`.
  const wrapper = join(unpacked, 'sherpa-onnx-node', 'sherpa-onnx.js')
  if (!existsSync(wrapper)) {
    throw new Error(`Packaged app has no unpacked sherpa-onnx-node wrapper at ${wrapper}.`)
  }

  // A binary for the wrong **platform** is not a smaller problem than none: it
  // is ~32 MB of dead weight, and it is the exact shape of the bug that
  // shipped — a Windows installer whose only native binary was a Linux `.so`.
  //
  // Scoped to the platform, not the arch, on purpose. The `files` rules that
  // do this exclusion are static YAML and cannot vary per architecture, so a
  // macOS host building the other slice legitimately has both `darwin-*`
  // packages on disk. Failing there would break a build over ~34 MB that the
  // wrong-OS check — the one with teeth — has no opinion about.
  const platformPrefix = sherpaPackageFor(context.electronPlatformName, '')
  const foreign = readdirSync(unpacked)
    .filter((name) => name.startsWith('sherpa-onnx-') && name !== 'sherpa-onnx-node')
    .filter((name) => !name.startsWith(platformPrefix))
  if (foreign.length > 0) {
    throw new Error(`Packaged app carries ASR binaries for other platforms: ${foreign.join(', ')}`)
  }

  console.log(`  • ASR binary verified in the packaged app`)
}
