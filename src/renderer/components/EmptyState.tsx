import { useUiStore } from '../state/store'
import { api } from '../ipc/api'

export default function EmptyState() {
  const handleOpen = async () => {
    const dir = await api.openFolderDialog()
    if (dir) {
      await useUiStore.getState().openFolder(dir)
      await api.setLastFolder(dir)
    }
  }

  return (
    <div className="empty-state">
      <p className="empty-state-message">No folder open yet.</p>
      <button type="button" className="empty-state-open-button" onClick={handleOpen}>
        Open folder
      </button>
    </div>
  )
}
