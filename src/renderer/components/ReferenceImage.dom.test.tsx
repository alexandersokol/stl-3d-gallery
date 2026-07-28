// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const readLinkedImage = vi.fn()
const writeLinkedImage = vi.fn()
const removeLinkedImage = vi.fn()

vi.mock('../ipc/api', () => ({
  api: {
    readLinkedImage: (...args: unknown[]) => readLinkedImage(...args),
    writeLinkedImage: (...args: unknown[]) => writeLinkedImage(...args),
    removeLinkedImage: (...args: unknown[]) => removeLinkedImage(...args),
  },
}))

const { useUiStore } = await import('../state/store')
const { default: ReferenceImage } = await import('./ReferenceImage')

// jsdom's File/Blob may not implement `arrayBuffer()` (it depends on the
// jsdom/undici version wired in). The component relies on it to turn a
// dropped/pasted File into the bytes it hands to the IPC layer, so polyfill
// it defensively -- harmless if the real implementation is already present.
if (typeof File.prototype.arrayBuffer !== 'function') {
  File.prototype.arrayBuffer = function (this: Blob) {
    return Promise.resolve(new ArrayBuffer(0))
  }
}

function makeFile(name: string, type: string, contents = 'x'): File {
  const file = new File([contents], name, { type })
  // Force a deterministic, non-empty arrayBuffer result regardless of which
  // arrayBuffer implementation ends up on the prototype chain. Built via the
  // test module's own `ArrayBuffer` global (not e.g. TextEncoder's output)
  // so it's `instanceof` the same realm's ArrayBuffer that assertions below
  // check against -- jsdom's window and Node's global are separate realms.
  Object.defineProperty(file, 'arrayBuffer', {
    value: () => Promise.resolve(new ArrayBuffer(contents.length)),
  })
  return file
}

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState())
  readLinkedImage.mockReset()
  writeLinkedImage.mockReset()
  removeLinkedImage.mockReset()
  readLinkedImage.mockResolvedValue(null)
  writeLinkedImage.mockResolvedValue('a.stl.png')
  removeLinkedImage.mockResolvedValue(undefined)

  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})

describe('<ReferenceImage/>', () => {
  it('shows the preview image when readLinkedImage resolves with bytes', async () => {
    readLinkedImage.mockResolvedValue({ bytes: new ArrayBuffer(4), name: 'a.stl.png' })

    render(<ReferenceImage modelPath="/root/a.stl" />)

    await waitFor(() => expect(readLinkedImage).toHaveBeenCalledWith('/root/a.stl'))
    const img = await screen.findByRole('img', { name: 'Reference' })
    expect(img).toHaveAttribute('src', 'blob:mock-url')
    expect(screen.queryByText(/Drag an image here/)).not.toBeInTheDocument()
  })

  it('shows the empty drop zone when readLinkedImage resolves null', async () => {
    readLinkedImage.mockResolvedValue(null)

    render(<ReferenceImage modelPath="/root/a.stl" />)

    await waitFor(() => expect(readLinkedImage).toHaveBeenCalledWith('/root/a.stl'))
    expect(await screen.findByText(/Drag an image here, or paste/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('dropping an accepted image file writes it with the correct ext and shows the preview', async () => {
    render(<ReferenceImage modelPath="/root/a.stl" />)
    await waitFor(() => expect(readLinkedImage).toHaveBeenCalled())
    const dropzone = await screen.findByText(/Drag an image here/)

    const file = makeFile('photo.jpg', 'image/jpeg')
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(writeLinkedImage).toHaveBeenCalledTimes(1))
    const [path, bytes, ext] = writeLinkedImage.mock.calls[0]
    expect(path).toBe('/root/a.stl')
    expect(bytes).toBeInstanceOf(ArrayBuffer)
    expect(ext).toBe('jpg')

    await screen.findByRole('img', { name: 'Reference' })
  })

  it('dropping a non-image file does not call writeLinkedImage', async () => {
    render(<ReferenceImage modelPath="/root/a.stl" />)
    await waitFor(() => expect(readLinkedImage).toHaveBeenCalled())
    const dropzone = await screen.findByText(/Drag an image here/)

    const file = makeFile('notes.txt', 'text/plain')
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    // Give any (incorrect) async write a chance to fire before asserting.
    await Promise.resolve()
    await Promise.resolve()

    expect(writeLinkedImage).not.toHaveBeenCalled()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('pasting an image from the clipboard writes it as png and shows the preview', async () => {
    render(<ReferenceImage modelPath="/root/a.stl" />)
    await waitFor(() => expect(readLinkedImage).toHaveBeenCalled())
    await screen.findByText(/Drag an image here/)

    const file = makeFile('clipboard.png', 'image/png')
    const clipboardData = {
      items: [{ type: 'image/png', getAsFile: () => file }],
    }
    fireEvent.paste(window, { clipboardData })

    await waitFor(() => expect(writeLinkedImage).toHaveBeenCalledTimes(1))
    expect(writeLinkedImage).toHaveBeenCalledWith('/root/a.stl', expect.any(ArrayBuffer), 'png')
    await screen.findByRole('img', { name: 'Reference' })
  })

  it('detach calls removeLinkedImage and returns to the drop zone', async () => {
    readLinkedImage.mockResolvedValue({ bytes: new ArrayBuffer(4), name: 'a.stl.png' })
    render(<ReferenceImage modelPath="/root/a.stl" />)

    await screen.findByRole('img', { name: 'Reference' })
    fireEvent.click(screen.getByRole('button', { name: 'Detach' }))

    await waitFor(() => expect(removeLinkedImage).toHaveBeenCalledWith('/root/a.stl'))
    await screen.findByText(/Drag an image here/)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not apply a detach() result after modelPath changes before removeLinkedImage resolves', async () => {
    readLinkedImage.mockResolvedValue({ bytes: new ArrayBuffer(4), name: 'a.stl.png' })
    let resolveRemove: (v: undefined) => void = () => {}
    removeLinkedImage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRemove = resolve
        }),
    )

    const { rerender } = render(<ReferenceImage modelPath="/root/a.stl" />)
    await screen.findByRole('img', { name: 'Reference' })

    // Click Detach, but the removal is now pending.
    fireEvent.click(screen.getByRole('button', { name: 'Detach' }))
    await waitFor(() => expect(removeLinkedImage).toHaveBeenCalledWith('/root/a.stl'))

    // Switch to model B before A's removal resolves. B also has a preview.
    readLinkedImage.mockResolvedValueOnce({ bytes: new ArrayBuffer(4), name: 'b.stl.png' })
    rerender(<ReferenceImage modelPath="/root/b.stl" />)
    await waitFor(() => expect(readLinkedImage).toHaveBeenCalledWith('/root/b.stl'))
    await screen.findByRole('img', { name: 'Reference' })

    // Now resolve A's removal. Its clearPreview() must not run, so B's preview
    // stays intact.
    await act(async () => {
      resolveRemove(undefined)
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(screen.queryByRole('img', { name: 'Reference' })).toBeInTheDocument()
  })

  it('drop writes webp with the correct ext', async () => {
    render(<ReferenceImage modelPath="/root/a.stl" />)
    await waitFor(() => expect(readLinkedImage).toHaveBeenCalled())
    const dropzone = await screen.findByText(/Drag an image here/)

    const file = makeFile('photo.webp', 'image/webp')
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(writeLinkedImage).toHaveBeenCalledTimes(1))
    const [path, bytes, ext] = writeLinkedImage.mock.calls[0]
    expect(path).toBe('/root/a.stl')
    expect(bytes).toBeInstanceOf(ArrayBuffer)
    expect(ext).toBe('webp')

    await screen.findByRole('img', { name: 'Reference' })
  })

  it('drop writes gif with the correct ext', async () => {
    render(<ReferenceImage modelPath="/root/a.stl" />)
    await waitFor(() => expect(readLinkedImage).toHaveBeenCalled())
    const dropzone = await screen.findByText(/Drag an image here/)

    const file = makeFile('photo.gif', 'image/gif')
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(writeLinkedImage).toHaveBeenCalledTimes(1))
    const [path, bytes, ext] = writeLinkedImage.mock.calls[0]
    expect(path).toBe('/root/a.stl')
    expect(bytes).toBeInstanceOf(ArrayBuffer)
    expect(ext).toBe('gif')

    await screen.findByRole('img', { name: 'Reference' })
  })

  it('dropping a new image onto an already-attached preview replaces it', async () => {
    readLinkedImage.mockResolvedValue({ bytes: new ArrayBuffer(4), name: 'a.stl.png' })
    const { container } = render(<ReferenceImage modelPath="/root/a.stl" />)
    await screen.findByRole('img', { name: 'Reference' })

    writeLinkedImage.mockResolvedValue('a.stl.jpg')
    const file = makeFile('new.jpg', 'image/jpeg')
    const root = container.querySelector('.reference-image')
    expect(root).not.toBeNull()
    fireEvent.drop(root as Element, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(writeLinkedImage).toHaveBeenCalledTimes(1))
    const [path, , ext] = writeLinkedImage.mock.calls[0]
    expect(path).toBe('/root/a.stl')
    expect(ext).toBe('jpg')
    await screen.findByRole('img', { name: 'Reference' })
  })

  it('does not apply an attach() result (drop) after modelPath changes before the write resolves', async () => {
    readLinkedImage.mockResolvedValue(null)
    let resolveWrite: (v: string) => void = () => {}
    writeLinkedImage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve
        }),
    )

    const { rerender } = render(<ReferenceImage modelPath="/root/a.stl" />)
    await waitFor(() => expect(readLinkedImage).toHaveBeenCalledWith('/root/a.stl'))
    const dropzone = await screen.findByText(/Drag an image here/)

    const file = makeFile('photo.png', 'image/png')
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(writeLinkedImage).toHaveBeenCalledTimes(1))
    expect(writeLinkedImage.mock.calls[0][0]).toBe('/root/a.stl')

    // Switch to model B before A's write resolves.
    rerender(<ReferenceImage modelPath="/root/b.stl" />)
    await waitFor(() => expect(readLinkedImage).toHaveBeenCalledWith('/root/b.stl'))
    expect(await screen.findByText(/Drag an image here/)).toBeInTheDocument()

    // Now resolve A's write -- its result must never apply to B's panel.
    // Flush inside act() so that if the (buggy) state update happens, React
    // actually commits it to the DOM before we assert -- otherwise this
    // assertion would pass vacuously just because React hadn't re-rendered
    // yet, regardless of whether the race-guard exists.
    await act(async () => {
      resolveWrite('a.stl.png')
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(/Drag an image here/)).toBeInTheDocument()
  })

  it('does not apply an attach() result (paste) after modelPath changes before the write resolves', async () => {
    readLinkedImage.mockResolvedValue(null)
    let resolveWrite: (v: string) => void = () => {}
    writeLinkedImage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveWrite = resolve
        }),
    )

    const { rerender } = render(<ReferenceImage modelPath="/root/a.stl" />)
    await waitFor(() => expect(readLinkedImage).toHaveBeenCalledWith('/root/a.stl'))
    await screen.findByText(/Drag an image here/)

    const file = makeFile('clipboard.png', 'image/png')
    const clipboardData = {
      items: [{ type: 'image/png', getAsFile: () => file }],
    }
    fireEvent.paste(window, { clipboardData })

    await waitFor(() => expect(writeLinkedImage).toHaveBeenCalledTimes(1))
    expect(writeLinkedImage.mock.calls[0][0]).toBe('/root/a.stl')

    rerender(<ReferenceImage modelPath="/root/b.stl" />)
    await waitFor(() => expect(readLinkedImage).toHaveBeenCalledWith('/root/b.stl'))
    expect(await screen.findByText(/Drag an image here/)).toBeInTheDocument()

    await act(async () => {
      resolveWrite('a.stl.png')
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText(/Drag an image here/)).toBeInTheDocument()
  })

  it('switching modelPath re-reads and does not show the previous image', async () => {
    let resolveSecond: (v: { bytes: ArrayBuffer; name: string } | null) => void = () => {}
    readLinkedImage.mockImplementationOnce(() =>
      Promise.resolve({ bytes: new ArrayBuffer(4), name: 'a.stl.png' }),
    )

    const { rerender } = render(<ReferenceImage modelPath="/root/a.stl" />)
    await screen.findByRole('img', { name: 'Reference' })

    readLinkedImage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve
        }),
    )

    rerender(<ReferenceImage modelPath="/root/b.stl" />)

    await waitFor(() => expect(readLinkedImage).toHaveBeenCalledWith('/root/b.stl'))
    // The old preview must be gone even before the new read resolves.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(await screen.findByText(/Drag an image here/)).toBeInTheDocument()

    resolveSecond(null)
    await Promise.resolve()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
