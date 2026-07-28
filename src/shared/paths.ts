import path from 'path'

export const HIDDEN_DIRS = ['.meta', '.thumb', '.linked'] as const

const sib = (modelPath: string, dir: string, suffix: string) => {
  const d = path.dirname(modelPath)
  const base = path.basename(modelPath)
  return path.join(d, dir, base + suffix)
}

export const metaPath = (m: string) => sib(m, '.meta', '.json')
export const linkedPath = (m: string, ext: string) => sib(m, '.linked', '.' + ext)
