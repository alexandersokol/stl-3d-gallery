// Right-hand info pane shown in viewer mode: identity + stats for the
// selected model, plus editable tags/notes persisted to metadata.json via
// the debounced save below. Stats come straight from the store
// (`currentStats`, populated by Viewer's load effect); tags/notes are
// loaded from disk per-selection and cached into `metaByPath` so the
// filter bar (Task 5.2) can read them without hitting disk again.

import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Metadata } from '../../shared/types'
import { useUiStore } from '../state/store'
import { api } from '../ipc/api'
import TagEditor from './TagEditor'
import ReferenceImage from './ReferenceImage'
import MeshRepairPanel from './MeshRepairPanel'
import {
  SellIcon,
  ImageIcon,
  EditIcon,
  ContentCopyIcon,
  DriveFileMoveIcon,
  DeleteIcon,
} from '../assets/icons'

const SAVE_DEBOUNCE_MS = 500

function defaultMetadata(): Metadata {
  return { schemaVersion: 1, tags: [], notes: '', updatedAt: new Date().toISOString() }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  const decimals = value >= 10 ? 0 : 1
  return `${value.toFixed(decimals)} ${units[unitIndex]}`
}

// Rounds to 2 decimals and trims trailing zeros (e.g. 10 -> "10", 10.5 ->
// "10.5", 10.25 -> "10.25") so whole-number dimensions don't render as
// "10.00".
function formatMm(n: number): string {
  return (Math.round(n * 100) / 100).toString()
}

function formatDims(bbox: { x: number; y: number; z: number }): string {
  return `${formatMm(bbox.x)} × ${formatMm(bbox.y)} × ${formatMm(bbox.z)} mm`
}

interface PendingSave {
  path: string
  tags: string[]
  notes: string
}

export default function InfoPanel() {
  const scan = useUiStore((s) => s.scan)
  const selectedIndex = useUiStore((s) => s.selectedIndex)
  const currentStats = useUiStore((s) => s.currentStats)
  const setMeta = useUiStore((s) => s.setMeta)
  const beginFileAction = useUiStore((s) => s.beginFileAction)
  const moveFile = useUiStore((s) => s.moveFile)

  const file = scan !== null && selectedIndex !== null ? (scan.files[selectedIndex] ?? null) : null

  const [tags, setTags] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  // Debounce bookkeeping lives in refs (not state) since updating it must
  // never itself trigger a re-render. `pendingRef` holds the latest
  // not-yet-written edit (and the path it belongs to); `timerRef` holds the
  // in-flight setTimeout handle.
  const pendingRef = useRef<PendingSave | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const commit = (pending: PendingSave) => {
    void api
      .writeMetadata(pending.path, { tags: pending.tags, notes: pending.notes })
      .then((written) => {
        setMeta(pending.path, written)
      })
      .catch((err) => {
        console.error(`InfoPanel: failed to save metadata for ${pending.path}`, err)
      })
  }

  // Writes the pending edit (if any) immediately and clears the timer.
  // Called on path change and unmount so an edit made just before switching
  // files isn't silently dropped -- but because `pendingRef` always carries
  // the path it was scheduled for, this can only ever write to the file it
  // was scheduled for, never to whatever the new selection is.
  const flushPending = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    if (pending) {
      pendingRef.current = null
      commit(pending)
    }
  }

  const scheduleSave = (path: string, nextTags: string[], nextNotes: string) => {
    pendingRef.current = { path, tags: nextTags, notes: nextNotes }
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      const pending = pendingRef.current
      pendingRef.current = null
      if (pending) commit(pending)
    }, SAVE_DEBOUNCE_MS)
  }

  // Loads metadata for the newly selected file. The cleanup below runs
  // before the next selection's load starts (and on unmount) -- it flushes
  // any pending debounced save for the file we're leaving, and sets
  // `cancelled` so a slow readMetadata for the OLD path can't clobber state
  // after a newer selection has already started loading.
  useEffect(() => {
    if (!file) {
      setTags([])
      setNotes('')
      return
    }

    const path = file.path
    let cancelled = false

    void api
      .readMetadata(path)
      .then((meta) => {
        if (cancelled) return
        const resolved = meta ?? defaultMetadata()
        setTags(resolved.tags)
        setNotes(resolved.notes)
        setMeta(path, resolved)
      })
      .catch((err) => {
        if (cancelled) return
        console.error(`InfoPanel: failed to read metadata for ${path}`, err)
      })

    return () => {
      cancelled = true
      flushPending()
    }
  }, [file?.path])

  const handleTagsChange = (next: string[]) => {
    setTags(next)
    if (file) scheduleSave(file.path, next, notes)
  }

  const handleNotesChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    setNotes(next)
    if (file) scheduleSave(file.path, tags, next)
  }

  return (
    <aside className="info-panel" aria-label="Model info">
      {!file ? (
        <p className="info-panel-placeholder">No model selected</p>
      ) : (
        <>
          <section className="info-section">
            <p className="info-panel-filename">{file.name}</p>
            <p className="info-panel-path" title={file.path}>
              {file.path}
            </p>
            <div className="info-actions" role="group" aria-label="File actions">
              <button
                type="button"
                className="info-action-btn"
                aria-label="Rename"
                title="Rename (F2)"
                onClick={() => beginFileAction('rename', file.path)}
              >
                <EditIcon size={18} />
              </button>
              <button
                type="button"
                className="info-action-btn"
                aria-label="Copy"
                title="Copy"
                onClick={() => beginFileAction('copy', file.path)}
              >
                <ContentCopyIcon size={18} />
              </button>
              <button
                type="button"
                className="info-action-btn"
                aria-label="Move"
                title="Move to folder…"
                onClick={() => void moveFile(file.path)}
              >
                <DriveFileMoveIcon size={18} />
              </button>
              <button
                type="button"
                className="info-action-btn info-action-btn-danger"
                aria-label="Delete"
                title="Delete (Del)"
                onClick={() => beginFileAction('delete', file.path)}
              >
                <DeleteIcon size={18} />
              </button>
            </div>
          </section>

          <section className="info-section">
            <h3>Stats</h3>
            <dl className="info-stats">
              <dt>Size</dt>
              <dd>{formatBytes(file.size)}</dd>
              <dt>Triangles</dt>
              <dd>{currentStats ? currentStats.triCount.toLocaleString() : '—'}</dd>
              <dt>Vertices</dt>
              <dd>{currentStats ? currentStats.vertCount.toLocaleString() : '—'}</dd>
              <dt>Dimensions</dt>
              <dd>{currentStats ? formatDims(currentStats.bbox) : '—'}</dd>
            </dl>
          </section>

          <section className="info-section">
            <h3>
              <SellIcon size={14} />
              Tags
            </h3>
            <TagEditor tags={tags} onChange={handleTagsChange} />
          </section>

          <section className="info-section">
            <h3>Notes</h3>
            <textarea
              className="info-notes"
              aria-label="Notes"
              value={notes}
              onChange={handleNotesChange}
            />
          </section>

          <section className="info-section">
            <h3>
              <ImageIcon size={14} />
              Reference Image
            </h3>
            <ReferenceImage modelPath={file.path} />
          </section>

          <section className="info-section">
            <h3>Mesh Repair</h3>
            <MeshRepairPanel modelPath={file.path} />
          </section>
        </>
      )}
    </aside>
  )
}
