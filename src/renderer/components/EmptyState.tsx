import { useEffect, useState } from 'react'
import { useUiStore } from '../state/store'
import { api } from '../ipc/api'
import { basename } from '../lib/paths'
import { FolderOpenIcon, HistoryIcon } from '../assets/icons'

export default function EmptyState() {
  const [lastFolder, setLastFolderState] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .getLastFolder()
      .then((dir) => {
        if (!cancelled) setLastFolderState(dir)
      })
      .catch((err) => {
        console.error('EmptyState: failed to read last folder', err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleOpen = async () => {
    const dir = await api.openFolderDialog()
    if (dir) {
      await useUiStore.getState().openFolder(dir)
      await api.setLastFolder(dir)
    }
  }

  const handleReopen = async () => {
    if (!lastFolder) return
    await useUiStore.getState().openFolder(lastFolder)
    await api.setLastFolder(lastFolder)
  }

  return (
    <div className="empty-state">
      <span className="empty-state-glyph" aria-hidden="true">
        <FolderOpenIcon size={40} />
      </span>
      <p className="empty-state-message">No folder open yet.</p>
      <div className="empty-state-actions">
        <button type="button" className="btn btn-primary empty-state-open-button" onClick={handleOpen}>
          <FolderOpenIcon />
          Open folder
        </button>
        {lastFolder && (
          <button type="button" className="btn empty-state-reopen-button" onClick={handleReopen}>
            <HistoryIcon />
            Reopen {basename(lastFolder)}
          </button>
        )}
      </div>
    </div>
  )
}
