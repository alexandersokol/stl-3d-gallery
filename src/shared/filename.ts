// Validation for a user-entered STL filename (rename / copy dialogs). Lives in
// `shared` so the renderer dialog can give live feedback with EXACTLY the same
// rules the main process enforces authoritatively before touching disk. This
// only validates the name in isolation; whether a file with that name already
// exists is a filesystem question answered in the main process (see file-ops).

export type FilenameValidation = { ok: true } | { ok: false; error: string }

// Punctuation illegal in a filename on at least one target platform (Windows
// is the strict one). Path separators (/ and \) are handled separately below
// for a clearer message. Spaces and dashes are intentionally allowed. Kept
// conservative so a name valid here is valid on both macOS and Windows.
const ILLEGAL_PUNCTUATION = ['<', '>', ':', '"', '|', '?', '*']

function hasIllegalChar(name: string): boolean {
  for (const ch of name) {
    if (ILLEGAL_PUNCTUATION.includes(ch)) return true
    if (ch.charCodeAt(0) < 0x20) return true // ASCII control character
  }
  return false
}

export function validateStlFilename(name: string): FilenameValidation {
  const trimmed = name.trim()

  if (trimmed.length === 0) {
    return { ok: false, error: 'Name cannot be empty.' }
  }
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return { ok: false, error: 'Name cannot contain a path separator.' }
  }
  if (hasIllegalChar(trimmed)) {
    return { ok: false, error: 'Name contains an invalid character ( < > : " | ? * ).' }
  }
  if (!/\.stl$/i.test(trimmed)) {
    return { ok: false, error: 'Name must end with .stl' }
  }
  // The part before ".stl" must not be empty (e.g. reject a bare ".stl").
  if (trimmed.slice(0, -4).trim().length === 0) {
    return { ok: false, error: 'Name must have something before .stl' }
  }
  return { ok: true }
}
