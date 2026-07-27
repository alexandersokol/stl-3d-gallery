export interface PathSegment {
  /** Display label for this segment (e.g. "models", or "/" / "C:\\" for the root). */
  label: string
  /** Absolute path to navigate to when this segment is activated. */
  path: string
}

const WINDOWS_ROOT = /^[a-zA-Z]:\\/

/**
 * Splits an absolute OS path into breadcrumb segments, each carrying the
 * cumulative path up to (and including) that segment. Handles POSIX paths
 * (leading "/") and Windows drive-letter paths (e.g. "C:\\Users\\me").
 */
export function splitPath(p: string): PathSegment[] {
  if (WINDOWS_ROOT.test(p)) {
    const root = p.slice(0, 3) // e.g. "C:\\"
    const rest = p.slice(3).split('\\').filter(Boolean)
    const segments: PathSegment[] = [{ label: root, path: root }]
    let acc = root
    for (const part of rest) {
      acc = acc.endsWith('\\') ? acc + part : `${acc}\\${part}`
      segments.push({ label: part, path: acc })
    }
    return segments
  }

  const parts = p.split('/').filter(Boolean)
  const segments: PathSegment[] = [{ label: '/', path: '/' }]
  let acc = ''
  for (const part of parts) {
    acc += `/${part}`
    segments.push({ label: part, path: acc })
  }
  return segments
}

/**
 * Returns the parent directory of an absolute OS path. Handles both POSIX
 * paths ("/root/a.stl" -> "/root") and Windows drive-letter paths
 * ("C:\\models\\a.stl" -> "C:\\models"), since the renderer has no access to
 * Node's `path` module and needs this to resolve the folder to open when the
 * OS hands us a single file (Task 7.1's "open with" flow).
 */
export function dirname(p: string): string {
  if (WINDOWS_ROOT.test(p)) {
    const root = p.slice(0, 3) // e.g. "C:\\"
    const rest = p.slice(3).split('\\').filter(Boolean)
    if (rest.length <= 1) return root
    return `${root}${rest.slice(0, -1).join('\\')}`
  }

  const parts = p.split('/').filter(Boolean)
  if (parts.length <= 1) return '/'
  return `/${parts.slice(0, -1).join('/')}`
}
