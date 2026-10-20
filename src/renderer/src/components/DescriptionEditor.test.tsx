// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { DescriptionEditor } from './DescriptionEditor'

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial)
  return <DescriptionEditor id="description" value={value} onChange={setValue} />
}

afterEach(cleanup)

describe('DescriptionEditor', () => {
  it('inserts the code at the cursor and leaves the cursor right after it', () => {
    render(<Harness initial="Hello world" />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.setSelectionRange(6, 6)

    fireEvent.click(screen.getByRole('button', { name: 'Colour: Gold' }))

    expect(textarea.value).toBe('Hello §6world')
    expect(textarea.selectionStart).toBe(8)
    expect(document.activeElement).toBe(textarea)
  })

  it('replaces a selection with the code', () => {
    render(<Harness initial="Hello world" />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    textarea.setSelectionRange(0, 5)

    fireEvent.click(screen.getByRole('button', { name: 'Style: Bold' }))

    expect(textarea.value).toBe('§l world')
  })

  it('does not take focus away from the text when a button is pressed', () => {
    render(<Harness initial="" />)
    const button = screen.getByRole('button', { name: 'Colour: Red' })
    expect(fireEvent.mouseDown(button)).toBe(false) // default prevented
  })
})
