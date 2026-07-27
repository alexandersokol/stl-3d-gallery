import { useUiStore } from '../state/store'

// Controlled search input over scan.files' filenames, filtered case-
// insensitively (substring) by filterModels in GridView. Filtering is
// cheap (folder-sized arrays), so no debounce -- every keystroke updates
// the store directly.
export default function SearchBox() {
  const search = useUiStore((s) => s.search)
  const setSearch = useUiStore((s) => s.setSearch)

  return (
    <input
      type="search"
      className="search-box"
      aria-label="Search models"
      placeholder="Search by name…"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  )
}
