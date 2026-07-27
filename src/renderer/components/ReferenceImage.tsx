// Linked reference image for the selected model (Task 6.1). Unlike
// tags/notes, this has no debounce -- every attach/detach is a single
// discrete action (drop a file, paste from clipboard, click Detach) so each
// one is written to disk immediately.
//
// One linked image per model, stored by the main process as
// `.linked/<name>.stl.<ext>` with the filename cached in the model's
// `metadata.json` (`linkedImage`). This component only deals in bytes +
// object URLs; the main process owns the actual file placement.

import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { api } from '../ipc/api'
import { useUiStore } from '../state/store'

// Accepted drop MIME types -> the extension `writeLinkedImage` should store
// them under. Clipboard paste always writes 'png' regardless of this table
// (see handlePaste) since clipboard image data has no reliable filename/ext
// of its own.
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

// The stored filename is `<model>.stl.<ext>` (see linked-image-store.ts) --
// this pulls the last extension off it to pick a Blob MIME type for the
// preview <img>.
function extFromStoredName(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : 'png'
}

// Best-effort cache sync so the filter bar / anything else reading
// `metaByPath` sees the new `linkedImage` without waiting on a re-read from
// disk. Not required for correctness (readLinkedImage is the source of
// truth), so a missing cache entry is silently skipped rather than
// synthesizing one.
function syncLinkedImageInStore(path: string, linkedImage: string | undefined) {
  const { metaByPath, setMeta } = useUiStore.getState()
  const current = metaByPath[path]
  if (current) setMeta(path, { ...current, linkedImage })
}

export interface ReferenceImageProps {
  modelPath: string
}

export default function ReferenceImage({ modelPath }: ReferenceImageProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [enlarged, setEnlarged] = useState(false)

  // The object URL backing `previewUrl`, tracked outside state so it can be
  // revoked without waiting for a re-render (and so a stale value never
  // leaks across attach/detach/path-change transitions).
  const objectUrlRef = useRef<string | null>(null)

  const clearPreview = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setPreviewUrl(null)
  }

  const showPreviewFromBytes = (bytes: ArrayBuffer, type: string) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(new Blob([bytes], { type }))
    objectUrlRef.current = url
    setPreviewUrl(url)
  }

  // Load (or reload) whenever the selected model changes. `cancelled` is the
  // race guard: if `modelPath` changes again before this read resolves, the
  // stale result must never overwrite what's now on screen for the new
  // path -- the cleanup below flips `cancelled` before the next run starts.
  useEffect(() => {
    let cancelled = false
    setError(null)
    setEnlarged(false)

    void api
      .readLinkedImage(modelPath)
      .then((result) => {
        if (cancelled) return
        if (result) {
          const type = MIME_BY_EXT[extFromStoredName(result.name)] ?? 'image/png'
          showPreviewFromBytes(result.bytes, type)
        } else {
          clearPreview()
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.error(`ReferenceImage: failed to read linked image for ${modelPath}`, err)
        setError('Failed to load reference image')
        clearPreview()
      })

    return () => {
      cancelled = true
      // Leaving this path (either a switch or unmount): drop whatever was
      // showing so the next path's effect never renders on top of a stale
      // image while its own read is in flight.
      clearPreview()
    }
  }, [modelPath])

  // Clipboard paste is handled globally (on `window`) while this component
  // is mounted, since focus can be anywhere in the panel -- there's no single
  // element the user is expected to click into first.
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          // Only claim the paste event once an actual image item was found
          // -- an unrelated paste (e.g. into a text field) must behave
          // normally.
          e.preventDefault()
          void attach(file, 'png')
          return
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [modelPath])

  const attach = async (file: File, ext: string) => {
    try {
      const bytes = await file.arrayBuffer()
      const storedName = await api.writeLinkedImage(modelPath, bytes, ext)
      showPreviewFromBytes(bytes, MIME_BY_EXT[ext] ?? file.type)
      setError(null)
      syncLinkedImageInStore(modelPath, storedName)
    } catch (err) {
      console.error(`ReferenceImage: failed to attach image for ${modelPath}`, err)
      setError('Failed to attach reference image')
    }
  }

  const handleDetach = async () => {
    try {
      await api.removeLinkedImage(modelPath)
      clearPreview()
      setError(null)
      syncLinkedImageInStore(modelPath, undefined)
    } catch (err) {
      console.error(`ReferenceImage: failed to remove linked image for ${modelPath}`, err)
      setError('Failed to remove reference image')
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const ext = EXT_BY_MIME[file.type]
    if (!ext) return // Not an accepted image type -- ignore, no write.
    void attach(file, ext)
  }

  return (
    <div className="reference-image">
      {previewUrl ? (
        <div className="reference-image-attached">
          <button
            type="button"
            className="reference-image-preview-button"
            onClick={() => setEnlarged(true)}
            aria-label="Enlarge reference image"
          >
            <img src={previewUrl} alt="Reference" className="reference-image-preview" />
          </button>
          <button type="button" className="reference-image-detach" onClick={() => void handleDetach()}>
            Detach
          </button>
        </div>
      ) : (
        <div
          className={`reference-image-dropzone${dragOver ? ' reference-image-dropzone-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          Drag an image here, or paste (⌘/Ctrl+V)
        </div>
      )}

      {error && <p className="reference-image-error">{error}</p>}

      {enlarged && previewUrl && (
        <div className="reference-image-overlay" onClick={() => setEnlarged(false)}>
          <button
            type="button"
            className="reference-image-overlay-close"
            aria-label="Close enlarged image"
            onClick={() => setEnlarged(false)}
          >
            ×
          </button>
          <img src={previewUrl} alt="Reference (enlarged)" className="reference-image-overlay-img" />
        </div>
      )}
    </div>
  )
}
