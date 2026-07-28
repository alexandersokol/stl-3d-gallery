import { useEffect, useRef, useState } from 'react'
import type { FileEntry } from '../../shared/types'
import { useUiStore } from '../state/store'
import { api } from '../ipc/api'
import { loadModel } from '../lib/load-model'
import { renderThumbnail } from '../viewer/thumbnailer'
import { thumbnailLimiter } from '../lib/concurrency'
import FileActionsMenu from './FileActionsMenu'

export default function ModelTile({ file }: { file: FileEntry }) {
  const select = useUiStore((s) => s.select)
  const scan = useUiStore((s) => s.scan)
  const thumbnailPreset = useUiStore((s) => s.thumbnailPreset)

  const tileRef = useRef<HTMLButtonElement | null>(null)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  // Read via a ref (rather than closing over `thumbnailPreset` directly) so
  // that `load()` -- which may run long after mount, once the tile actually
  // scrolls into view -- always uses the CURRENT store value at that
  // moment, not whatever it was when the effect below was created.
  const thumbnailPresetRef = useRef(thumbnailPreset)
  thumbnailPresetRef.current = thumbnailPreset

  const handleClick = () => {
    // Selection must be indexed against the FULL scan.files array (not the
    // filtered/rendered list), so that Prev/Next in the viewer (Phase 4)
    // walk the complete, unfiltered set of models in this folder.
    const idx = scan?.files.findIndex((f) => f.path === file.path) ?? -1
    if (idx >= 0) select(idx)
  }

  // Lazily loads (and generates + persists, on a cache miss) this tile's
  // thumbnail once it scrolls near the viewport. `GridView` keys `ModelTile`
  // by `file.path`, so React fully remounts this component on path changes
  // rather than reusing it in place — a fresh effect run per mount is
  // therefore always "once per path" without extra bookkeeping for that.
  useEffect(() => {
    const el = tileRef.current
    if (!el) return

    let mounted = true
    let started = false
    let objectUrl: string | null = null

    const load = async () => {
      if (started) return
      started = true
      try {
        const preset = thumbnailPresetRef.current
        const cached = await api.readThumbnail(file.path, preset)
        const blob = cached
          ? new Blob([cached], { type: 'image/png' })
          : await thumbnailLimiter(async () => {
              const bytes = await api.readFileBytes(file.path)
              const { positions } = await loadModel(bytes)
              const rendered = await renderThumbnail(positions, preset)
              await api.writeThumbnail(file.path, preset, await rendered.arrayBuffer())
              return rendered
            })

        if (!mounted) return
        const url = URL.createObjectURL(blob)
        objectUrl = url
        setThumbUrl(url)
      } catch (err) {
        // Leave `thumbUrl` unset so the placeholder glyph keeps showing —
        // a failed thumbnail must never crash the grid.
        console.error(`ModelTile: failed to load thumbnail for ${file.path}`, err)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) load()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)

    return () => {
      mounted = false
      observer.disconnect()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file.path])

  return (
    // A wrapper (not a button) hosts both the click-to-open tile button and
    // the file-actions menu button, since a <button> can't nest inside another
    // <button>. The menu positions itself in the top-right corner.
    <div className="model-tile-wrapper">
      <button type="button" ref={tileRef} className="tile model-tile" onClick={handleClick} title={file.name}>
        {thumbUrl ? (
          <img src={thumbUrl} alt={file.name} className="tile-thumb" />
        ) : (
          <span className="tile-thumb-placeholder" aria-hidden="true">
            🧊
          </span>
        )}
        <span className="tile-name">{file.name}</span>
      </button>
      <FileActionsMenu path={file.path} />
    </div>
  )
}
