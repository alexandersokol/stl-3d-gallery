// Controlled tag chip editor. Owns only the transient "text being typed"
// state; the actual tag list lives in the parent (InfoPanel) and is passed
// down as `tags` / mutated via `onChange` -- this component never mutates
// its own copy of the list.

import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AddIcon, CloseIcon } from '../assets/icons'

export interface TagEditorProps {
  tags: string[]
  onChange: (next: string[]) => void
}

export default function TagEditor({ tags, onChange }: TagEditorProps) {
  const [draft, setDraft] = useState('')

  const addTag = () => {
    const trimmed = draft.trim()
    setDraft('')
    if (!trimmed) return
    if (tags.includes(trimmed)) return
    onChange([...tags, trimmed])
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  return (
    <div className="tag-editor">
      <ul className="tag-list" aria-label="Tags">
        {tags.map((tag) => (
          <li key={tag} className="tag-chip">
            <span className="tag-chip-label">{tag}</span>
            <button type="button" className="tag-chip-remove" aria-label={`Remove tag ${tag}`} onClick={() => removeTag(tag)}>
              <CloseIcon size={12} />
            </button>
          </li>
        ))}
      </ul>
      <div className="tag-input-row">
        <input
          type="text"
          className="tag-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag"
          aria-label="Add tag"
        />
        <button type="button" className="btn tag-add-button" onClick={addTag}>
          <AddIcon size={14} />
          Add
        </button>
      </div>
    </div>
  )
}
