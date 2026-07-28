// Viewer right-pane "Mesh Repair" tools: analyze the selected model for
// 3D-printability issues, and write a repaired copy. Both run off the UI
// thread (mesh-ops worker); this component only orchestrates and renders.
//
// Analysis is read-only. Repair never touches the original: it writes a new
// `<name>-fixed.stl` sibling and switches the viewer to it (openRepairedFile),
// then auto-analyzes that copy so the result is immediately visible.
//
// Like ReferenceImage, InfoPanel keeps this component mounted across model
// switches (only the modelPath prop changes), so every async path guards its
// result against a switch that happened while it was in flight.

import { useEffect, useRef, useState } from 'react'
import type { MeshAnalysis, RepairOptions } from '../../shared/types'
import { api } from '../ipc/api'
import { analyzeModel, repairModel } from '../lib/mesh-ops'
import { useUiStore } from '../state/store'

const REPAIR_LABELS: { key: keyof RepairOptions; label: string; title: string }[] = [
  { key: 'weld', label: 'Weld', title: 'Merge coincident vertices (merge by distance)' },
  { key: 'clean', label: 'Clean', title: 'Remove degenerate and duplicate triangles' },
  { key: 'fillHoles', label: 'Fill holes', title: 'Triangulate open boundary loops shut' },
  {
    key: 'fullManifold',
    label: 'Full manifold',
    title: 'Best-effort: remove non-manifold geometry, then re-fill (may delete geometry)',
  },
]

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

export interface MeshRepairPanelProps {
  modelPath: string
}

export default function MeshRepairPanel({ modelPath }: MeshRepairPanelProps) {
  const openRepairedFile = useUiStore((s) => s.openRepairedFile)

  const [analysis, setAnalysis] = useState<MeshAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  // Repair options persist across model switches (a sticky user preference).
  const [options, setOptions] = useState<RepairOptions>({
    weld: true,
    clean: true,
    fillHoles: false,
    fullManifold: false,
  })
  const [fixing, setFixing] = useState(false)
  const [fixError, setFixError] = useState<string | null>(null)
  const [repairedBanner, setRepairedBanner] = useState<string | null>(null)

  // Always the current modelPath, for the in-flight staleness guard below.
  const currentPathRef = useRef(modelPath)
  // Set just before openRepairedFile switches us to the new file, so the
  // reset effect can recognize the arrival and auto-analyze it.
  const justRepairedRef = useRef<{ path: string; fromName: string } | null>(null)

  const analyzePath = async (targetPath: string) => {
    const isStale = () => currentPathRef.current !== targetPath
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const bytes = await api.readFileBytes(targetPath)
      if (isStale()) return
      const result = await analyzeModel(bytes)
      if (isStale()) return
      setAnalysis(result)
    } catch (err) {
      if (isStale()) return
      console.error(`MeshRepairPanel: failed to analyze ${targetPath}`, err)
      setAnalyzeError('Failed to analyze mesh')
    } finally {
      if (currentPathRef.current === targetPath) setAnalyzing(false)
    }
  }

  // Reset on model switch. If we just landed on a freshly-repaired file, show a
  // banner and auto-analyze it so the user sees the fix took effect.
  useEffect(() => {
    currentPathRef.current = modelPath
    setFixing(false)
    setFixError(null)
    const jr = justRepairedRef.current
    if (jr && jr.path === modelPath) {
      justRepairedRef.current = null
      setRepairedBanner(`Repaired copy of ${jr.fromName}`)
      void analyzePath(modelPath)
    } else {
      setRepairedBanner(null)
      setAnalysis(null)
      setAnalyzeError(null)
    }
    // analyzePath is recreated each render but only ever called with the
    // current modelPath, so it needs no dep tracking here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelPath])

  const canFix = options.weld || options.clean || options.fillHoles || options.fullManifold

  const runFix = async () => {
    const capturedPath = modelPath
    const fromName = basename(capturedPath)
    setFixing(true)
    setFixError(null)
    try {
      const bytes = await api.readFileBytes(capturedPath)
      const repaired = await repairModel(bytes, options)
      const { path: newPath } = await api.writeStlFile(capturedPath, repaired)
      justRepairedRef.current = { path: newPath, fromName }
      await openRepairedFile(newPath) // switches modelPath → reset effect auto-analyzes
    } catch (err) {
      console.error(`MeshRepairPanel: failed to repair ${capturedPath}`, err)
      setFixError('Failed to repair mesh')
      setFixing(false)
    }
  }

  const toggle = (key: keyof RepairOptions) =>
    setOptions((o) => ({ ...o, [key]: !o[key] }))

  return (
    <div className="mesh-repair">
      {repairedBanner && <p className="mesh-repair-banner">{repairedBanner}</p>}

      <button
        type="button"
        className="btn mesh-repair-analyze"
        onClick={() => void analyzePath(modelPath)}
        disabled={analyzing}
      >
        {analyzing ? 'Analyzing…' : 'Analyze'}
      </button>

      {analyzeError && <p className="mesh-repair-error">{analyzeError}</p>}

      {analysis && !analyzeError && (
        <div className="mesh-repair-report">
          <p className={analysis.watertight ? 'mesh-repair-ok' : 'mesh-repair-warn'}>
            {analysis.watertight ? '✓ Watertight' : '⚠ Not watertight'}
          </p>
          {(analysis.boundaryEdges > 0 ||
            analysis.nonManifoldEdges > 0 ||
            analysis.degenerateTriangles > 0) && (
            <ul className="mesh-repair-issues">
              {analysis.boundaryEdges > 0 && (
                <li>Holes (boundary edges): {analysis.boundaryEdges.toLocaleString()}</li>
              )}
              {analysis.nonManifoldEdges > 0 && (
                <li>Non-manifold edges: {analysis.nonManifoldEdges.toLocaleString()}</li>
              )}
              {analysis.degenerateTriangles > 0 && (
                <li>Degenerate triangles: {analysis.degenerateTriangles.toLocaleString()}</li>
              )}
            </ul>
          )}
          <p className="mesh-repair-info">
            {analysis.triCount.toLocaleString()} triangles · {analysis.vertCount.toLocaleString()} vertices
          </p>
        </div>
      )}

      <div className="mesh-repair-options" role="group" aria-label="Repair options">
        {REPAIR_LABELS.map(({ key, label, title }) => (
          <label key={key} className="mesh-repair-option" title={title}>
            <input type="checkbox" checked={options[key]} onChange={() => toggle(key)} />
            {label}
          </label>
        ))}
      </div>

      <button
        type="button"
        className="btn mesh-repair-fix"
        onClick={() => void runFix()}
        disabled={fixing || !canFix}
        title={canFix ? 'Write a repaired copy and open it' : 'Select at least one repair option'}
      >
        {fixing ? 'Fixing…' : 'Fix Manifold'}
      </button>

      {fixError && <p className="mesh-repair-error">{fixError}</p>}
    </div>
  )
}
