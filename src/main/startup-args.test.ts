import { describe, it, expect } from 'vitest'
import { parseStartupFolder, findStlArg } from './startup-args'

describe('parseStartupFolder', () => {
  it('returns the path for a space-separated --folder <path> arg', () => {
    expect(parseStartupFolder(['electron', '.', '--folder', '/tmp/x'])).toBe('/tmp/x')
  })

  it('returns the path for a --folder=<path> arg', () => {
    expect(parseStartupFolder(['electron', '.', '--folder=/tmp/y'])).toBe('/tmp/y')
  })

  it('returns null when --folder is absent', () => {
    expect(parseStartupFolder(['electron', '.'])).toBeNull()
  })

  it('returns null when --folder is the last arg with no value', () => {
    expect(parseStartupFolder(['electron', '.', '--folder'])).toBeNull()
  })

  it('returns null for an empty argv', () => {
    expect(parseStartupFolder([])).toBeNull()
  })

  it('picks up --folder among other flags', () => {
    expect(parseStartupFolder(['electron', '.', '--foo', 'bar', '--folder', '/tmp/z', '--baz'])).toBe('/tmp/z')
  })
})

describe('findStlArg', () => {
  it('returns the .stl path a file-association launch appends to argv', () => {
    expect(findStlArg(['C:\\App\\STL Gallery.exe', 'C:\\models\\Girl.STL'])).toBe('C:\\models\\Girl.STL')
  })

  it('finds it among Chromium switches Electron adds to a second-instance argv', () => {
    expect(findStlArg(['app.exe', '--allow-file-access-from-files', 'D:\\a.stl', '--original-process-start-time=1'])).toBe('D:\\a.stl')
  })

  it('returns null when no .stl was passed', () => {
    expect(findStlArg(['app.exe', '--folder', 'C:\\x'])).toBeNull()
  })

  it('ignores a switch whose value happens to end in .stl', () => {
    expect(findStlArg(['app.exe', '--foo=bar.stl'])).toBeNull()
  })
})
