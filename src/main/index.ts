import { app, BrowserWindow } from 'electron'
import { createWindow } from './window'
import { registerIpc } from './ipc'
import { findStlArg } from './startup-args'

let mainWindow: BrowserWindow | null = null
let rendererReady = false
let pendingFile: string | null = null

function sendOpenFile(filePath: string): void {
  if (mainWindow && rendererReady) {
    mainWindow.webContents.send('open-file', filePath)
  } else {
    // Window/renderer isn't up yet (cold start) — queue it and flush once
    // did-finish-load fires below.
    pendingFile = filePath
  }
}

function attachWindow(win: BrowserWindow): void {
  mainWindow = win
  rendererReady = false
  win.webContents.once('did-finish-load', () => {
    rendererReady = true
    if (pendingFile) {
      win.webContents.send('open-file', pendingFile)
      pendingFile = null
    }
  })
}

// macOS: the OS asks the app to open a .stl file (double-click, "Open
// With", drag onto dock icon). This can fire before `app.whenReady()`
// resolves, so the listener must be registered at module load, not inside
// the whenReady callback.
app.on('open-file', (e, filePath) => {
  e.preventDefault()
  sendOpenFile(filePath)
})

// One app instance at a time. Without this, opening another .stl from
// Explorer while the app runs (Windows/Linux file association) launches a
// second, separate app. Instead the second launch quits immediately and its
// argv is forwarded here, so the running window opens that file.
const isPrimaryInstance = app.requestSingleInstanceLock()
if (!isPrimaryInstance) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    const stl = findStlArg(argv)
    if (stl) sendOpenFile(stl)
  })
}

app.whenReady().then(() => {
  if (!isPrimaryInstance) return // quitting; don't flash a window
  registerIpc()
  attachWindow(createWindow())

  // Windows/Linux: launched via file association, the path arrives as a CLI
  // argument rather than an 'open-file' event.
  const argPath = process.platform !== 'darwin' ? findStlArg(process.argv) : null
  if (argPath) sendOpenFile(argPath)

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) attachWindow(createWindow()) })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
