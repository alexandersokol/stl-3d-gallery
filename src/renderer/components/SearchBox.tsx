import { useUiStore } from '../state/store'
import { SearchIcon } from '../assets/icons'

// Controlled search input over scan.files' filenames, filtered case-
// insensitively (substring) by filterModels in GridView. Filtering is
// cheap (folder-sized arrays), so no debounce -- every keystroke updates
// the store directly.
export default function SearchBox() {
  const search = useUiStore((s) => s.search)
  const setSearch = useUiStore((s) => s.setSearch)

  return (
    <div className="search-box-wrapper">
      <SearchIcon className="search-box-icon" />
      <input
        type="search"
        className="search-box"
        aria-label="Search models"
        placeholder="Search by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
  )
}
