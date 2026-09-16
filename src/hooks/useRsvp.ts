import { useCallback, useEffect, useRef, useState } from 'react'

export function useRsvp(wordCount: number, wpm: number, playing: boolean) {
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)

  useEffect(() => {
    indexRef.current = index
  }, [index])

  // Reset when book changes
  useEffect(() => {
    setIndex(0)
    indexRef.current = 0
  }, [wordCount])

  useEffect(() => {
    if (!playing || wordCount === 0) return
    if (indexRef.current >= wordCount - 1) return

    const delay = Math.max(40, Math.round(60000 / wpm))
    const id = window.setInterval(() => {
      setIndex((prev) => {
        if (prev >= wordCount - 1) return prev
        return prev + 1
      })
    }, delay)

    return () => window.clearInterval(id)
  }, [playing, wpm, wordCount])

  const seek = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(wordCount - 1, next))
    setIndex(clamped)
  }, [wordCount])

  const reset = useCallback(() => {
    setIndex(0)
  }, [])

  const finished = wordCount > 0 && index >= wordCount - 1

  return { index, seek, reset, finished }
}
