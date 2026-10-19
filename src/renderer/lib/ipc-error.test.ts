import { describe, it, expect } from 'vitest'
import { ipcErrorMessage } from './ipc-error'

describe('ipcErrorMessage', () => {
  it("strips Electron's 'Error invoking remote method' wrapper", () => {
    const err = new Error("Error invoking remote method 'openInBlender': Error: Blender was not found.")
    expect(ipcErrorMessage(err, 'fallback')).toBe('Blender was not found.')
  })

  it('leaves a plain message untouched', () => {
    expect(ipcErrorMessage(new Error('Name cannot be empty.'), 'fallback')).toBe('Name cannot be empty.')
  })

  it('uses the fallback when there is no message', () => {
    expect(ipcErrorMessage(undefined, 'Move failed.')).toBe('Move failed.')
    expect(ipcErrorMessage(new Error(''), 'Move failed.')).toBe('Move failed.')
  })
})
