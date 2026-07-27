import { describe, it, expect } from 'vitest'
import { dirname } from './paths'

describe('dirname', () => {
  it('returns the parent directory of a POSIX path', () => {
    expect(dirname('/root/a.stl')).toBe('/root')
  })

  it('returns the parent directory of a Windows drive-letter path', () => {
    expect(dirname('C:\\models\\a.stl')).toBe('C:\\models')
  })

  it('returns the POSIX root when the file is directly under it', () => {
    expect(dirname('/a.stl')).toBe('/')
  })

  it('returns the Windows drive root when the file is directly under it', () => {
    expect(dirname('C:\\a.stl')).toBe('C:\\')
  })

  it('handles nested POSIX paths', () => {
    expect(dirname('/root/sub/leaf/b.stl')).toBe('/root/sub/leaf')
  })

  it('handles nested Windows paths', () => {
    expect(dirname('C:\\models\\sub\\leaf\\b.stl')).toBe('C:\\models\\sub\\leaf')
  })
})
