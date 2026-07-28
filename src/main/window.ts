import { BrowserWindow, shell } from 'electron'
import { join } from 'path'

// Content-Security-Policy applied to the packaged app only (see below). Not
// injected as a static <meta> tag because that also blocks Vite's inline
// HMR script in dev; instead it's added via response headers, and only when
// NOT running against the dev server.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self'"

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280, height: 820, show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') shell.openExternal(url)
    } catch {
      // Not a parseable URL -- ignore rather than risk opening it.
    }
    return { action: 'deny' }
  })
  // This app is a single local page; it should never navigate away from it
  // (e.g. via a dropped/typed URL or a compromised renderer).
  win.webContents.on('will-navigate', (e) => e.preventDefault())

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // Production only: the dev server's inline HMR script would be blocked
    // by this CSP, so it's applied solely to the packaged loadFile() path.
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [CSP],
        },
      })
    })
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}
