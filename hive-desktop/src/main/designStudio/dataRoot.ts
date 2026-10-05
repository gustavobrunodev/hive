import { mkdirSync } from 'fs'
import { join } from 'path'
import { isE2ESeamEnabled } from '../bmadService'

/**
 * Design Studio — where the module keeps the person's data (decision 3,
 * Landing 11).
 *
 * `<raiz>` is `Documents/Design Studio`: the PM can find it, open it and back
 * it up like any other folder of theirs, and it is outside every workspace, so
 * nothing the module writes lands in someone's repository or BMAD tree. Each
 * Produto is a folder under it, named the way the screen names it.
 */

/** The module's folder inside Documents — its display name, space included. */
export const DATA_ROOT_DIR = 'Design Studio'

/**
 * The Documents folder the root hangs off.
 *
 * The E2E seam has the same two-key shape as the scripted-agent one: the
 * launcher's `HIVE_E2E=1` **and** `HIVE_E2E_DOCUMENTS`, neither enough alone,
 * so a stray variable in someone's environment can never move their data.
 *
 * Unlike that seam, a redirect is honoured even when the folder is not there
 * yet. Falling back to the real Documents on a missing path — what the agent
 * seam rightly does with a missing binary — would make a mistyped fixture write
 * test conversations into the documents of whoever runs the suite.
 */
export function documentsDir(documents: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!isE2ESeamEnabled(env)) return documents
  return env.HIVE_E2E_DOCUMENTS || documents
}

/**
 * `<raiz>`. The variable replaces the Documents folder rather than the root,
 * so the E2E exercises the production path shape — `Design Studio` segment
 * included — instead of a shortcut around it.
 */
export function resolveDataRoot(documents: string, env: NodeJS.ProcessEnv = process.env): string {
  return join(documentsDir(documents, env), DATA_ROOT_DIR)
}

/** Where the app is running from — the inputs `resolveResourcesDir` needs. */
export interface AppLocation {
  isPackaged: boolean
  /** `process.resourcesPath`: where the installer put `app.asar` and its unpacked tree. */
  resourcesPath: string
  /**
   * The app's root — where `package.json` and `resources/` sit. Packaged, that
   * is `app.getAppPath()` (the asar). Unpackaged it is NOT always
   * `app.getAppPath()`: launched with the built entry file, as the E2E does,
   * Electron answers that file's folder (`out/main`, measured), so the caller
   * passes the folder two levels above the built main instead.
   */
  appPath: string
}

/**
 * The module's embedded resources — the catalog, the sample data and the
 * report skills (Landing 6). Read-only, outside `<raiz>`: the PM's folder holds
 * what the module produced, never what it ships with.
 *
 * Packaged, they live outside the asar (`asarUnpack: resources/**`), because
 * the agent's `node` runs the skill scripts and cannot read inside an archive.
 */
export function resolveResourcesDir(location: AppLocation): string {
  return location.isPackaged
    ? join(location.resourcesPath, 'app.asar.unpacked', 'resources', 'design-studio')
    : join(location.appPath, 'resources', 'design-studio')
}

/**
 * Makes sure every Produto of the catalog has its folder in `<raiz>` — what
 * opening the module does on a machine that never opened it (criterion 10).
 * Folders only: no Relatório exists until the person asks for one. A folder
 * that cannot be created is left for the next opening rather than failing it.
 */
export function ensureProdutoFolders(
  root: string,
  produtos: ReadonlyArray<{ nome: string }>
): void {
  for (const produto of produtos) {
    try {
      mkdirSync(join(root, produto.nome), { recursive: true })
    } catch {
      // Unwritable Documents: the pages still open, showing no Relatório.
    }
  }
}
