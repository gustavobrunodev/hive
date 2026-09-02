import type { AsrDownload } from './asr/asrTypes'

/**
 * The only user-facing copy in `src/main` — and a deliberate exception, kept
 * in one named file so it stays that way.
 *
 * The project's rule is that copy lives in `renderer/i18n/pt-BR.ts` and reaches
 * main only as codes (`shellCatalog`'s caveats are the pattern). An **operating
 * system** notification cannot follow it: it is raised by `electron.Notification`
 * from the main process, and the renderer's own `Notification` web API is
 * denied by `setPermissionRequestHandler` — deliberately, since that handler is
 * a security floor and not something to widen for a toast.
 *
 * So the strings live here, next to nothing else, rather than being scattered
 * through `index.ts` where the next one would join them unnoticed.
 */
export function asrDownloadNotification(download: AsrDownload): {
  title: string
  body: string
} {
  // The model id no longer appears in the copy. It used to name which of ten
  // models had finished, which was the useful half of the sentence; with one
  // model it would only be `parakeet-tdt-0.6b-v3-int8` shown to someone who
  // never chose it.
  if (download.status === 'done') {
    return {
      title: 'Modelo de voz pronto',
      body: 'O download terminou. Já dá para ditar.'
    }
  }
  return {
    title: 'O download do modelo parou',
    body: 'Abra Voz e transcrição para continuar de onde parou.'
  }
}
