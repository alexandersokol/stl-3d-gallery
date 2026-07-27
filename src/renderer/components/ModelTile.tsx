import type { FileEntry } from '../../shared/types'
import { useUiStore } from '../state/store'

export default function ModelTile({ file }: { file: FileEntry }) {
  const select = useUiStore((s) => s.select)
  const scan = useUiStore((s) => s.scan)

  const handleClick = () => {
    // Selection must be indexed against the FULL scan.files array (not the
    // filtered/rendered list), so that Prev/Next in the viewer (Phase 4)
    // walk the complete, unfiltered set of models in this folder.
    const idx = scan?.files.findIndex((f) => f.path === file.path) ?? -1
    if (idx >= 0) select(idx)
  }

  return (
    <button type="button" className="tile model-tile" onClick={handleClick} title={file.name}>
      <span className="tile-thumb-placeholder" aria-hidden="true">
        🧊
      </span>
      <span className="tile-name">{file.name}</span>
    </button>
  )
}
