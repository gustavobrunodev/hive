import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createConfigStore } from './configStore'
import { createWorkspaceService } from './workspaceService'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC: request/response round trip for window.hive.ping()
  ipcMain.handle('ping', async () => 'pong')

  // WorkspaceService (T5): a single ConfigStore instance backed by the
  // per-user data dir, wrapped for workspace-picker/read operations and
  // exposed to the renderer as window.hive.{chooseWorkspace,getWorkspace,isProvisioned}.
  const configStore = createConfigStore(app.getPath('userData'))
  // Adapter closure (rather than passing `dialog` straight through): Electron's
  // `dialog.showOpenDialog` is overloaded (an optional BrowserWindow first
  // arg), which doesn't structurally match the single-argument `DialogLike`
  // workspaceService.ts declares to stay Electron-import-free. This one-line
  // wrapper calls the options-only overload, satisfying `DialogLike` without
  // loosening its type or importing Electron's types into workspaceService.ts.
  const workspaceService = createWorkspaceService(configStore, {
    showOpenDialog: (options) =>
      dialog.showOpenDialog(options as Parameters<typeof dialog.showOpenDialog>[0])
  })

  ipcMain.handle('workspace:choose', async () => workspaceService.chooseWorkspace())
  ipcMain.handle('workspace:get', async () => workspaceService.getWorkspace())
  ipcMain.handle('workspace:isProvisioned', async () => workspaceService.isProvisioned())

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
