// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { MeshAnalysis } from '../../shared/types'

const readFileBytes = vi.fn()
const writeStlFile = vi.fn()
const analyzeModel = vi.fn()
const repairModel = vi.fn()

vi.mock('../ipc/api', () => ({
  api: {
    readFileBytes: (...a: unknown[]) => readFileBytes(...a),
    writeStlFile: (...a: unknown[]) => writeStlFile(...a),
  },
}))
vi.mock('../lib/mesh-ops', () => ({
  analyzeModel: (...a: unknown[]) => analyzeModel(...a),
  repairModel: (...a: unknown[]) => repairModel(...a),
}))

const { useUiStore } = await import('../state/store')
const { default: MeshRepairPanel } = await import('./MeshRepairPanel')

const CLEAN: MeshAnalysis = {
  triCount: 100,
  vertCount: 52,
  duplicateVertices: 248,
  boundaryEdges: 0,
  nonManifoldEdges: 0,
  degenerateTriangles: 0,
  watertight: true,
}
const DIRTY: MeshAnalysis = {
  triCount: 98,
  vertCount: 50,
  duplicateVertices: 244,
  boundaryEdges: 6,
  nonManifoldEdges: 2,
  degenerateTriangles: 1,
  watertight: false,
}

let openRepairedFile: ReturnType<typeof vi.fn>

beforeEach(() => {
  readFileBytes.mockReset().mockResolvedValue(new ArrayBuffer(8))
  writeStlFile.mockReset().mockResolvedValue({ path: '/root/a-fixed.stl' })
  analyzeModel.mockReset().mockResolvedValue(CLEAN)
  repairModel.mockReset().mockResolvedValue(new ArrayBuffer(8))
  openRepairedFile = vi.fn().mockResolvedValue(undefined)
  useUiStore.setState({ openRepairedFile: openRepairedFile as unknown as (p: string) => Promise<void> })
})

describe('<MeshRepairPanel/>', () => {
  it('runs analysis on Analyze and shows a watertight report', async () => {
    render(<MeshRepairPanel modelPath="/root/a.stl" />)
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))

    await waitFor(() => expect(screen.getByText('✓ Watertight')).toBeInTheDocument())
    expect(analyzeModel).toHaveBeenCalledTimes(1)
    expect(readFileBytes).toHaveBeenCalledWith('/root/a.stl')
  })

  it('lists issue counts for a non-watertight mesh', async () => {
    analyzeModel.mockResolvedValue(DIRTY)
    render(<MeshRepairPanel modelPath="/root/a.stl" />)
    fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))

    await waitFor(() => expect(screen.getByText('⚠ Not watertight')).toBeInTheDocument())
    expect(screen.getByText(/Holes \(boundary edges\): 6/)).toBeInTheDocument()
    expect(screen.getByText(/Non-manifold edges: 2/)).toBeInTheDocument()
    expect(screen.getByText(/Degenerate triangles: 1/)).toBeInTheDocument()
  })

  it('disables Fix when no repair option is selected', () => {
    render(<MeshRepairPanel modelPath="/root/a.stl" />)
    const fix = screen.getByRole('button', { name: 'Fix Manifold' })
    expect(fix).toBeEnabled() // weld + clean on by default

    fireEvent.click(screen.getByLabelText('Weld'))
    fireEvent.click(screen.getByLabelText('Clean'))
    expect(fix).toBeDisabled()
  })

  it('repairs, writes a new file, and opens it', async () => {
    render(<MeshRepairPanel modelPath="/root/a.stl" />)
    fireEvent.click(screen.getByRole('button', { name: 'Fix Manifold' }))

    await waitFor(() => expect(openRepairedFile).toHaveBeenCalledWith('/root/a-fixed.stl'))
    expect(repairModel).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
      weld: true,
      clean: true,
      fillHoles: false,
      fullManifold: false,
    })
    expect(writeStlFile).toHaveBeenCalledWith('/root/a.stl', expect.any(ArrayBuffer))
  })
})
