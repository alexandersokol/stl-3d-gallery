// Renders the active file-operation dialog (driven by the store's
// `fileAction`) plus a dismissible error toast for operations that have no
// dialog to show their error (Move). Mounted once, at App level, so the same
// dialog serves both entry points (viewer info-pane buttons and grid tile
// menus) and the F2 / Delete shortcuts.

import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '../state/store'
import { validateStlFilename } from '../../shared/filename'
import { CloseIcon } from '../assets/icons'

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

// Suggested default for Copy: "girl.stl" -> "girl copy.stl".
function suggestCopyName(name: string): string {
  return /\.stl$/i.test(name) ? `${name.slice(0, -4)} copy.stl` : `${name} copy.stl`
}

function NameDialog({
  kind,
  path,
}: {
  kind: 'rename' | 'copy'
  path: string
}) {
  const closeFileAction = useUiStore((s) => s.closeFileAction)
  const confirmRename = useUiStore((s) => s.confirmRename)
  const confirmCopy = useUiStore((s) => s.confirmCopy)

  const original = baseName(path)
  const [value, setValue] = useState(kind === 'copy' ? suggestCopyName(original) : original)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Focus and pre-select the name (excluding the .stl extension) so the user
  // can start typing a new name immediately.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    const dot = el.value.toLowerCase().lastIndexOf('.stl')
    el.setSelectionRange(0, dot > 0 ? dot : el.value.length)
  }, [])

  const validation = validateStlFilename(value)
  const canSubmit = validation.ok && !busy

  const submit = async () => {
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (kind === 'rename') await confirmRename(value.trim())
      else await confirmCopy(value.trim())
      // On success the store clears `fileAction`, unmounting this dialog.
    } catch (err: any) {
      setBusy(false)
      setError(err?.message ?? 'Operation failed.')
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void submit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeFileAction()
    }
  }

  return (
    <div className="settings-overlay" onClick={closeFileAction}>
      <div
        className="settings-modal file-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={kind === 'rename' ? 'Rename model' : 'Copy model'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>{kind === 'rename' ? 'Rename model' : 'Copy model'}</h2>
          <button type="button" className="settings-close" aria-label="Close" onClick={closeFileAction}>
            <CloseIcon />
          </button>
        </div>

        <div className="settings-body">
          <label className="settings-field-label" htmlFor="file-dialog-name">
            {kind === 'rename' ? 'New name' : 'Copy name'}
          </label>
          <input
            id="file-dialog-name"
            ref={inputRef}
            className="file-dialog-input"
            type="text"
            value={value}
            aria-invalid={!validation.ok}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
            }}
            onKeyDown={onKeyDown}
          />
          {error && <p className="file-dialog-error">{error}</p>}
        </div>

        <div className="file-dialog-actions">
          <button type="button" className="toolbar-button" onClick={closeFileAction}>
            Cancel
          </button>
          <button type="button" className="toolbar-button file-dialog-primary" disabled={!canSubmit} onClick={() => void submit()}>
            {kind === 'rename' ? 'Rename' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteDialog({ path }: { path: string }) {
  const closeFileAction = useUiStore((s) => s.closeFileAction)
  const confirmDelete = useUiStore((s) => s.confirmDelete)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await confirmDelete()
    } catch (err: any) {
      setBusy(false)
      setError(err?.message ?? 'Delete failed.')
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFileAction()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeFileAction])

  return (
    <div className="settings-overlay" onClick={closeFileAction}>
      <div
        className="settings-modal file-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Delete model"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>Move to Trash?</h2>
          <button type="button" className="settings-close" aria-label="Close" onClick={closeFileAction}>
            <CloseIcon />
          </button>
        </div>

        <div className="settings-body">
          <p className="file-dialog-text">
            Move <strong>{baseName(path)}</strong> and its thumbnail, metadata, and linked image to the
            Trash? You can restore them from the Trash.
          </p>
          {error && <p className="file-dialog-error">{error}</p>}
        </div>

        <div className="file-dialog-actions">
          <button type="button" className="toolbar-button" onClick={closeFileAction}>
            Cancel
          </button>
          <button type="button" className="toolbar-button file-dialog-danger" disabled={busy} onClick={() => void submit()}>
            Move to Trash
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FileActionDialogs() {
  const fileAction = useUiStore((s) => s.fileAction)
  const fileActionError = useUiStore((s) => s.fileActionError)
  const dismissFileActionError = useUiStore((s) => s.dismissFileActionError)

  return (
    <>
      {fileAction?.kind === 'rename' && <NameDialog kind="rename" path={fileAction.path} />}
      {fileAction?.kind === 'copy' && <NameDialog kind="copy" path={fileAction.path} />}
      {fileAction?.kind === 'delete' && <DeleteDialog path={fileAction.path} />}

      {fileActionError && (
        <div className="file-action-toast" role="alert">
          <span>{fileActionError}</span>
          <button type="button" className="file-action-toast-close" aria-label="Dismiss" onClick={dismissFileActionError}>
            <CloseIcon size={16} />
          </button>
        </div>
      )}
    </>
  )
}
