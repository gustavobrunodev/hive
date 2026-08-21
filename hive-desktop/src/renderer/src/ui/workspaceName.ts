/**
 * Renderer-side mirror of `main/workspaceService.ts`'s `folderName`
 * (multi-workspace): the last segment of an absolute path, with both
 * separators handled so a Windows path renders its folder name too.
 *
 * Duplicated across the process boundary on purpose — the renderer may only
 * reach main through the `window.hive` bridge (see AGENTS.md, "Processos não
 * se importam"), and a two-line pure function is not worth an IPC round trip
 * for a placeholder.
 */
export function folderNameOf(path: string): string {
  const segments = path.split(/[/\\]/).filter(Boolean)
  return segments[segments.length - 1] ?? path
}
