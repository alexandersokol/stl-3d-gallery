// Scrollable strip of thumbnails for every model in the current scan,
// shown alongside the viewer when showFilmstrip is on. Reuses ModelTile
// (which already selects by scan.files index on click) so thumbnail
// loading/caching logic isn't duplicated here.

import { useUiStore } from '../state/store'
import ModelTile from './ModelTile'

export default function Filmstrip() {
  const scan = useUiStore((s) => s.scan)
  const selectedIndex = useUiStore((s) => s.selectedIndex)

  if (!scan) return null

  return (
    <div className="filmstrip" role="list" aria-label="Filmstrip">
      {scan.files.map((file, i) => (
        <div
          key={file.path}
          role="listitem"
          className={i === selectedIndex ? 'filmstrip-item filmstrip-item-active' : 'filmstrip-item'}
        >
          <ModelTile file={file} />
        </div>
      ))}
    </div>
  )
}
