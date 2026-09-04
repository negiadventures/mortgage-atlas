import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { GLOSSARY } from './glossary.js'

/** Breathing room kept between the panel and the edge of the screen. */
const MARGIN = 12

/**
 * A small "i" next to a label that opens a definition.
 *
 * Click rather than hover, because a hover tooltip is unreachable on a phone
 * and this page is mostly read on one.
 *
 * Closing is the fiddly part. The listener that closes on an outside click has
 * to ignore clicks inside this component, or the second press on the button
 * counts as an outside click and cancels the open that the same press just
 * caused.
 */
export function Info({ term }) {
  const entry = GLOSSARY[term]
  const [open, setOpen] = useState(false)
  const [shift, setShift] = useState(0)
  const wrapRef = useRef(null)
  const buttonRef = useRef(null)
  const popRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event) => {
      // The press that opened this lands here too. Anything inside is ours.
      if (wrapRef.current && wrapRef.current.contains(event.target)) return
      setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      if (buttonRef.current) buttonRef.current.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  /*
   * Slide the panel sideways so it fits on the screen.
   *
   * Picking a side and hanging it there is not enough. A 280px panel beside a
   * button in the middle of a 375px phone runs off the left edge if it hangs
   * left and off the right edge if it hangs right, so the only answer that
   * works at every width is to clamp it to the viewport.
   *
   * Measured from the wrapper rather than from the panel, because the panel has
   * already been moved by the last run of this and reading it back would make
   * the shift compound. The wrapper does not move, so this settles in one pass.
   */
  useLayoutEffect(() => {
    if (!open || !wrapRef.current || !popRef.current) return
    const anchorLeft = wrapRef.current.getBoundingClientRect().left
    const width = popRef.current.offsetWidth
    const furthestRight = window.innerWidth - MARGIN - width
    const target = Math.max(MARGIN, Math.min(anchorLeft, furthestRight))
    setShift(target - anchorLeft)
  }, [open])

  if (!entry) return null

  return (
    <span className="info" ref={wrapRef}>
      <button
        type="button"
        ref={buttonRef}
        className="info-dot"
        aria-expanded={open}
        aria-label={`What is ${entry.term}?`}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {open && (
        <span
          className="info-pop"
          role="tooltip"
          ref={popRef}
          style={{ transform: `translateX(${shift}px)` }}
        >
          <strong>{entry.term}</strong>
          <span>{entry.what}</span>
          {entry.note && <em>{entry.note}</em>}
        </span>
      )}
    </span>
  )
}
