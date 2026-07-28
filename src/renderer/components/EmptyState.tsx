import { useEffect, useState } from 'react'
import { useUiStore } from '../state/store'
import { api } from '../ipc/api'
import { basename } from '../lib/paths'

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
      <p className="empty-state-message">No folder open yet.</p>
      <button type="button" className="empty-state-open-button" onClick={handleOpen}>
        Open folder
      </button>
      {lastFolder && (
        <button type="button" className="empty-state-reopen-button" onClick={handleReopen}>
          Reopen {basename(lastFolder)}
        </button>
      )}
    </div>
  )
}
