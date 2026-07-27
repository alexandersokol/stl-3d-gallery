import { useUiStore } from '../state/store'
import { filterModels } from '../lib/filter'
import FolderTile from './FolderTile'
import ModelTile from './ModelTile'

export default function GridView() {
  const scan = useUiStore((s) => s.scan)
  const search = useUiStore((s) => s.search)
  const activeTags = useUiStore((s) => s.activeTags)
  const metaByPath = useUiStore((s) => s.metaByPath)

  if (!scan) return null

  // Tags come from the store's metaByPath, populated by openFolder's batch
  // metadata read (Task 5.2b) and kept fresh by InfoPanel's setMeta calls.
  const models = filterModels(
    scan.files.map((file) => ({ file, tags: metaByPath[file.path]?.tags ?? [] })),
    search,
    activeTags,
  )

  if (scan.folders.length === 0 && models.length === 0) {
    return <div className="grid-empty">This folder has no subfolders or STL files.</div>
  }

  return (
    <div className="grid-view">
      {scan.folders.map((folder) => (
        <FolderTile key={folder.path} folder={folder} />
      ))}
      {models.map((file) => (
        <ModelTile key={file.path} file={file} />
      ))}
    </div>
  )
}
