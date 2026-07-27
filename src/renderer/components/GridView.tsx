import { useUiStore } from '../state/store'
import { filterModels } from '../lib/filter'
import FolderTile from './FolderTile'
import ModelTile from './ModelTile'

export default function GridView() {
  const scan = useUiStore((s) => s.scan)
  const search = useUiStore((s) => s.search)
  const activeTags = useUiStore((s) => s.activeTags)

  if (!scan) return null

  // Tags aren't wired up yet (metadata comes in Phase 5), so every model is
  // indexed with an empty tag list for now. Routing through filterModels
  // here means search/tag filtering (5.2) will "just work" once activeTags
  // and per-model tags are populated.
  const models = filterModels(
    scan.files.map((file) => ({ file, tags: [] as string[] })),
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
