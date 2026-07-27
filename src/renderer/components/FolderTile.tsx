import type { FolderEntry } from '../../shared/types'
import { useUiStore } from '../state/store'

export default function FolderTile({ folder }: { folder: FolderEntry }) {
  const openFolder = useUiStore((s) => s.openFolder)

  return (
    <button
      type="button"
      className="tile folder-tile"
      onClick={() => openFolder(folder.path)}
      title={folder.name}
    >
      <span className="tile-glyph" aria-hidden="true">
        📁
      </span>
      <span className="tile-name">{folder.name}</span>
    </button>
  )
}
