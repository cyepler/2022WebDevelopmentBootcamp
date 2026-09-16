import { useMemo } from 'react'
import type { BookImage } from '../lib/types'

interface ImagePanelProps {
  images: BookImage[]
  wordIndex: number
  title: string
  onSeek?: (wordIndex: number) => void
}

export function ImagePanel({ images, wordIndex, title, onSeek }: ImagePanelProps) {
  const sorted = useMemo(
    () => [...images].sort((a, b) => a.wordIndex - b.wordIndex),
    [images],
  )

  const active = useMemo(() => {
    if (sorted.length === 0) return null
    let best = sorted[0]
    for (const img of sorted) {
      if (img.wordIndex <= wordIndex) best = img
      else break
    }
    return best
  }, [sorted, wordIndex])

  return (
    <section className="image-panel" aria-label="Illustrations">
      <div className="image-panel__frame">
        {active ? (
          <img
            key={active.id}
            className="image-panel__img"
            src={active.src}
            alt={active.alt || `Illustration from ${title}`}
          />
        ) : (
          <div className="image-panel__empty">
            <p className="image-panel__empty-label">Illustration gallery</p>
            <p className="image-panel__empty-hint">
              Pictures and figures from your book will appear here
            </p>
          </div>
        )}
        <div className="image-panel__veil" aria-hidden="true" />
      </div>
      {sorted.length > 1 && (
        <div className="image-panel__thumbs" role="list" aria-label="All illustrations">
          {sorted.map((img) => (
            <button
              key={img.id}
              type="button"
              role="listitem"
              className={
                active?.id === img.id
                  ? 'image-panel__thumb is-active'
                  : 'image-panel__thumb'
              }
              title={img.alt}
              aria-label={`Show: ${img.alt}`}
              aria-current={active?.id === img.id}
              onClick={() => onSeek?.(img.wordIndex)}
            >
              <img src={img.src} alt="" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
