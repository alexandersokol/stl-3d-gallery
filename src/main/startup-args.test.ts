import { describe, it, expect } from 'vitest'
import { parseStartupFolder } from './startup-args'

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
