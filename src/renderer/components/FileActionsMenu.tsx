// The ⋮ (more_vert) dropdown shown on a grid tile's top-right corner. Opens a
// small menu of file operations (icon + text) for the model at `path`. All
// clicks stop propagation so interacting with the menu never opens the model
// (the tile itself is a separate button beneath it).

import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '../state/store'
import {
  MoreVertIcon,
  EditIcon,
  ContentCopyIcon,
  DriveFileMoveIcon,
  DeleteIcon,
} from '../assets/icons'

export default function FileActionsMenu({ path }: { path: string }) {
  const beginFileAction = useUiStore((s) => s.beginFileAction)
  const moveFile = useUiStore((s) => s.moveFile)

  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click or Escape while open.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const run = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen(false)
    fn()
  }

  return (
    <div className="tile-menu" ref={wrapperRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="tile-menu-button"
        aria-label="File actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <MoreVertIcon size={18} />
      </button>

      {open && (
        <div className="file-menu" role="menu">
          <button type="button" role="menuitem" className="file-menu-item" onClick={run(() => beginFileAction('rename', path))}>
            <EditIcon size={16} />
            Rename
          </button>
          <button type="button" role="menuitem" className="file-menu-item" onClick={run(() => beginFileAction('copy', path))}>
            <ContentCopyIcon size={16} />
            Copy
          </button>
          <button type="button" role="menuitem" className="file-menu-item" onClick={run(() => void moveFile(path))}>
            <DriveFileMoveIcon size={16} />
            Move
          </button>
          <button type="button" role="menuitem" className="file-menu-item file-menu-item-danger" onClick={run(() => beginFileAction('delete', path))}>
            <DeleteIcon size={16} />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
