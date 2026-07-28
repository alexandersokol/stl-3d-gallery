import { app, BrowserWindow } from 'electron'
import { createWindow } from './window'
import { registerIpc } from './ipc'

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

app.whenReady().then(() => {
  registerIpc()
  attachWindow(createWindow())

  // Windows/Linux: launched via file association, the path arrives as the
  // last CLI argument rather than an 'open-file' event.
  const argPath = process.argv[process.argv.length - 1]
  if (process.platform !== 'darwin' && argPath && argPath.toLowerCase().endsWith('.stl')) {
    sendOpenFile(argPath)
  }

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) attachWindow(createWindow()) })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
