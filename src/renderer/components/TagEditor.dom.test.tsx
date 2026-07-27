// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TagEditor from './TagEditor'

describe('<TagEditor/>', () => {
  it('renders a chip per tag', () => {
    render(<TagEditor tags={['mechanical', 'vase']} onChange={vi.fn()} />)

    expect(screen.getByText('mechanical')).toBeInTheDocument()
    expect(screen.getByText('vase')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('adding a tag via the Add button calls onChange with it appended', () => {
    const onChange = vi.fn()
    render(<TagEditor tags={['a']} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Add tag'), { target: { value: 'b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(onChange).toHaveBeenCalledWith(['a', 'b'])
  })

  it('adding a tag via Enter calls onChange with it appended and clears the input', () => {
    const onChange = vi.fn()
    render(<TagEditor tags={['a']} onChange={onChange} />)

    const input = screen.getByLabelText('Add tag') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'b' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['a', 'b'])
    expect(input.value).toBe('')
  })

  it('rejects a blank tag (whitespace-only)', () => {
    const onChange = vi.fn()
    render(<TagEditor tags={['a']} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Add tag'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('trims whitespace and rejects a duplicate tag', () => {
    const onChange = vi.fn()
    render(<TagEditor tags={['a']} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Add tag'), { target: { value: '  a  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('removing a tag calls onChange without it', () => {
    const onChange = vi.fn()
    render(<TagEditor tags={['a', 'b', 'c']} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove tag b' }))

    expect(onChange).toHaveBeenCalledWith(['a', 'c'])
  })
})
