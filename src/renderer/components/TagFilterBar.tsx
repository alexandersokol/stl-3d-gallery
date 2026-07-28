import { useUiStore } from '../state/store'
import { allTags } from '../lib/filter'
import { SellIcon } from '../assets/icons'

// Chip row over the current folder's tag universe (derived from
// metaByPath, populated by openFolder's batch metadata read). Clicking a
// chip toggles it in activeTags; filterModels in GridView applies AND
// semantics across every active tag. Renders nothing when the folder has
// no tagged files yet.
export default function TagFilterBar() {
  const scan = useUiStore((s) => s.scan)
  const metaByPath = useUiStore((s) => s.metaByPath)
  const activeTags = useUiStore((s) => s.activeTags)
  const toggleTag = useUiStore((s) => s.toggleTag)

  if (!scan) return null

  const tags = allTags(scan.files.map((file) => ({ file, tags: metaByPath[file.path]?.tags ?? [] })))

  if (tags.length === 0) return null

  return (
    <div className="tag-filter-bar" role="group" aria-label="Filter by tag">
      {tags.map((tag) => {
        const active = activeTags.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            className={`filter-tag-chip${active ? ' filter-tag-chip-active' : ''}`}
            aria-pressed={active}
            onClick={() => toggleTag(tag)}
          >
            <SellIcon size={13} />
            {tag}
          </button>
        )
      })}
    </div>
  )
}
