import { test, expect } from './fixtures/workspace'
import { launchSeededApp, waitForWorkUI } from './fixtures/workspace'
import fs from 'node:fs'
import path from 'node:path'

// The crash a user reported on 2026-08-31, in the real built app:
//
//   Uncaught Exception: TypeError: Object has been destroyed
//       at WebContents.send (...)
//       at FSWatcher.handleRawEvent (out/main/index.js)
//
// It only ever showed up *after* closing Hive, which is the whole story: the
// renderer tears its subscriptions down with an explicit `fs:watch:stop`, and a
// window that is closed never sends one. The workspace watcher outlived the
// window it was reporting to, and its next inotify event called `send` on a
// destroyed WebContents — an uncaught exception in the main process, i.e. the
// "A JavaScript error occurred in the main process" dialog.
//
// Reproduced here at the only layer where it exists at all: the real app, with
// a real recursive watcher on a real workspace. `process.getActiveResourcesInfo()`
// counts the watcher's own libuv handles ('FSEventWrap', one per watched
// directory), so "the watcher is gone" is measured rather than inferred.
test('closing the window stops the workspace watcher instead of crashing the main process', async ({
  seeded
}) => {
  const app = await launchSeededApp(seeded)
  const window = await app.firstWindow()
  await waitForWorkUI(window)

  const closing = await app.evaluate(async ({ app: electronApp, BrowserWindow }) => {
    const watcherHandles = (): number =>
      process.getActiveResourcesInfo().filter((resource) => resource === 'FSEventWrap').length

    // Quitting for real would take the process — and this evaluation — with it.
    // Holding the quit back leaves the *exact* condition the crash needs: the
    // renderer destroyed without ever sending its `fs:watch:stop`, and a main
    // process still running to be observed.
    electronApp.on('before-quit', (event) => event.preventDefault())

    const whileOpen = watcherHandles()
    BrowserWindow.getAllWindows()[0].destroy()
    await new Promise((resolve) => setTimeout(resolve, 300))
    return { whileOpen, afterClose: watcherHandles() }
  })

  // The watcher really was running (otherwise the rest proves nothing)…
  expect(closing.whileOpen).toBeGreaterThan(0)
  // …and closing the window released every handle it held.
  expect(closing.afterClose).toBe(0)

  // The reported crash itself: a change on disk arriving after the window is
  // gone. Before the fix this reached `WebContents.send` on a destroyed object.
  fs.writeFileSync(path.join(seeded.workspace, 'after-close.txt'), 'x', 'utf-8')
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Answering at all is the proof. An uncaught exception in main is not a
  // silent event: Electron stops everything and puts the "A JavaScript error
  // occurred in the main process" dialog on screen, so the process stays
  // *blocked* rather than dying. Measured on this spec against the pre-fix
  // build: the evaluation below never returns (nor is main's stderr any use —
  // Playwright owns that pipe), so responsiveness is the signal.
  const answered = await Promise.race([
    app.evaluate(
      () => `alive:${process.getActiveResourcesInfo().filter((r) => r === 'FSEventWrap').length}`
    ),
    new Promise<string>((resolve) => setTimeout(() => resolve('blocked on a crash dialog'), 8_000))
  ])
  expect(answered).toBe('alive:0')

  await app.evaluate(({ app: electronApp }) => {
    electronApp.removeAllListeners('before-quit')
  })
  await app.close()
})

// The user's own gesture, end to end: quit Hive while the workspace is being
// written to, so every event the watcher delivers during shutdown arrives after
// its renderer is gone. A clean exit is the whole assertion — a main process
// that throws here stops on the error dialog and never exits at all.
test('quitting while files are changing exits cleanly', async ({ seeded }) => {
  const app = await launchSeededApp(seeded)
  const window = await app.firstWindow()
  await waitForWorkUI(window)

  const child = app.process()
  let churned = 0
  const churn = setInterval(() => {
    fs.writeFileSync(path.join(seeded.workspace, `churn-${churned++}.txt`), 'x', 'utf-8')
  }, 25)

  try {
    await app.close()
  } finally {
    clearInterval(churn)
  }

  expect(churned).toBeGreaterThan(0)
  expect(child.exitCode).toBe(0)
})
