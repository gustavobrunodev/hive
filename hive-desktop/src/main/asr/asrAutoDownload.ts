/**
 * Should the app fetch the transcription model by itself, at startup?
 *
 * The feature asked for is one sentence — *"na inicialização a aplicação
 * identifique se já tem o modelo baixado ou não, e inicie o download
 * automaticamente se não tiver"* — and the reason it is a module rather than an
 * `if` in `index.ts` is the one condition that sentence does not mention.
 *
 * The voice panel has a **Remover** button whose only purpose is giving 671 MB
 * back. An unconditional auto-download undoes that on the next launch, which
 * does not merely annoy: it makes the button a lie. So a removal is recorded as
 * an intent (`autoDownload: false` in the config) and honoured until the user
 * asks for the model again, which any explicit download does.
 *
 * Everything else this must not do is about *not blocking the app*: it is
 * called after the window exists, it starts a transfer that already owns its
 * own lifetime (`asrDownloads.ts`), and it never awaits.
 */

/** Why startup did or did not begin a download. Returned so it can be asserted and logged. */
export type AutoDownloadOutcome =
  /** A transfer was started. */
  | 'started'
  /** The model is already on disk. */
  | 'installed'
  /** A download for it is already running — a resumed session, or a fast relaunch. */
  | 'downloading'
  /** The user removed the model on purpose; refilling the disk is not ours to decide. */
  | 'declined'

export interface AutoDownloadDeps {
  /** Are the model's files complete on disk? */
  installed: () => boolean
  /** Is a transfer for it already in flight? */
  downloading: () => boolean
  /** False once the user has removed the model by hand. */
  allowed: () => boolean
  /** Begins the transfer. Fire-and-forget: it reports itself through the manager. */
  start: () => void
}

export function autoDownloadOnStartup(deps: AutoDownloadDeps): AutoDownloadOutcome {
  if (deps.installed()) return 'installed'
  if (deps.downloading()) return 'downloading'
  if (!deps.allowed()) return 'declined'
  deps.start()
  return 'started'
}
