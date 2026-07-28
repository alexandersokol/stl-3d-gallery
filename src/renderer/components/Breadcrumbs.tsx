import { useUiStore } from '../state/store'
import { splitPath } from '../lib/paths'
import { FolderIcon } from '../assets/icons'

export default function Breadcrumbs() {
  const cwd = useUiStore((s) => s.cwd)
  const openFolder = useUiStore((s) => s.openFolder)

  if (!cwd) return null

  const segments = splitPath(cwd)

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <span className="breadcrumb-glyph" aria-hidden="true">
        <FolderIcon size={15} />
      </span>
      {segments.map((seg, i) => (
        <span key={seg.path} className="breadcrumb-item">
          {i > 0 && (
            <span className="breadcrumb-separator" aria-hidden="true">
              /
            </span>
          )}
          <button type="button" className="breadcrumb-segment" onClick={() => openFolder(seg.path)}>
            {seg.label}
          </button>
        </span>
      ))}
    </nav>
  )
}
