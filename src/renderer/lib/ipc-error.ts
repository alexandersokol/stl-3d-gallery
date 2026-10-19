// Errors thrown by a main-process ipcMain.handle() reach the renderer
// re-wrapped by Electron as "Error invoking remote method '<channel>': Error:
// <original message>". The original message is the user-facing one, so strip
// the wrapper before showing it in a dialog or toast.
const IPC_WRAPPER = /^Error invoking remote method '[^']*': (?:\w*Error: )?/

export function ipcErrorMessage(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : ''
  return message.replace(IPC_WRAPPER, '') || fallback
}
