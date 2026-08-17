/**
 * Who this app says it is, to the operating system.
 *
 * These two strings are not cosmetic. `APP_NAME` is what Electron derives
 * `userData` from (see `userDataMigration.ts` for what happens when it
 * changes), and `APP_ID` is the AppUserModelID Windows uses to group taskbar
 * buttons and match a pinned shortcut to the running window.
 *
 * They must equal `productName` and `appId` in `electron-builder.yml` — a
 * packaged build reads those, a dev run reads these, and a mismatch is the
 * kind of bug that only shows up on a real install. `appIdentity.test.ts`
 * asserts the two files agree, so the pairing can't quietly drift.
 */

/** The product name. Displayed by the OS, and the `userData` directory name. */
export const APP_NAME = 'Hive'

/** Reverse-DNS application identity: the installer's `appId` and the Windows AppUserModelID. */
export const APP_ID = 'dev.gustavobruno.hive'
