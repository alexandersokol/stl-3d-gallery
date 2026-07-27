import './app.css'
import { useUiStore } from './state/store'
import EmptyState from './components/EmptyState'
import Breadcrumbs from './components/Breadcrumbs'
import GridView from './components/GridView'

export default function App() {
  const cwd = useUiStore((s) => s.cwd)

  if (!cwd) {
    return (
      <div className="app">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="app">
      <div className="top-bar">
        <Breadcrumbs />
      </div>
      <GridView />
    </div>
  )
}
