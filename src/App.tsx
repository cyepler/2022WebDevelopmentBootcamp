import { useCallback, useEffect, useState } from 'react'
import { Controls } from './components/Controls'
import { FileDrop } from './components/FileDrop'
import { ImagePanel } from './components/ImagePanel'
import { WordStage } from './components/WordStage'
import { useRsvp } from './hooks/useRsvp'
import type { ParsedBook } from './lib/types'
import { parseBook, sampleBook } from './parsers'

const WPM_KEY = 'pace-wpm'

function loadWpm(): number {
  const raw = localStorage.getItem(WPM_KEY)
  const n = raw ? Number(raw) : 300
  return Number.isFinite(n) ? Math.min(800, Math.max(100, n)) : 300
}

export default function App() {
  const [book, setBook] = useState<ParsedBook>(() => sampleBook())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [wpm, setWpm] = useState(loadWpm)

  const { index, seek, reset, finished } = useRsvp(book.words.length, wpm, playing)

  useEffect(() => {
    if (finished) setPlaying(false)
  }, [finished])

  useEffect(() => {
    localStorage.setItem(WPM_KEY, String(wpm))
  }, [wpm])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (!playing && finished) {
          reset()
          setPlaying(true)
          return
        }
        setPlaying((p) => !p)
      } else if (e.code === 'ArrowRight') {
        seek(index + 1)
      } else if (e.code === 'ArrowLeft') {
        seek(index - 1)
      } else if (e.key === '+' || e.key === '=') {
        setWpm((v) => Math.min(800, v + 20))
      } else if (e.key === '-' || e.key === '_') {
        setWpm((v) => Math.max(100, v - 20))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, seek, finished, reset, playing])

  const applyBook = useCallback(
    (parsed: ParsedBook) => {
      if (parsed.words.length === 0) {
        throw new Error('No readable text found in this file.')
      }
      setBook(parsed)
      reset()
      setPlaying(false)
    },
    [reset],
  )

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true)
      setError(null)
      setPlaying(false)
      try {
        const parsed = await parseBook(file)
        applyBook(parsed)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to open file')
      } finally {
        setBusy(false)
      }
    },
    [applyBook],
  )

  const loadSampleEpub = useCallback(async () => {
    setBusy(true)
    setError(null)
    setPlaying(false)
    try {
      const res = await fetch('/sample-river-notes.epub')
      if (!res.ok) throw new Error('Sample book missing')
      const blob = await res.blob()
      const file = new File([blob], 'sample-river-notes.epub', {
        type: 'application/epub+zip',
      })
      applyBook(await parseBook(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample')
    } finally {
      setBusy(false)
    }
  }, [applyBook])

  const word = book.words[index] ?? ''

  return (
    <div className="app">
      <div className="app__atmosphere" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <h1 className="brand__name">PACE</h1>
        </div>
        <div className="topbar__actions">
          <button
            type="button"
            className="topbar__sample"
            disabled={busy}
            onClick={loadSampleEpub}
          >
            Try sample EPUB
          </button>
          <FileDrop onFile={handleFile} busy={busy} />
        </div>
      </header>

      <ImagePanel
        images={book.images}
        wordIndex={index}
        title={book.title}
        onSeek={(i) => {
          setPlaying(false)
          seek(i)
        }}
      />

      <main className="reader">
        <div className="reader__meta">
          <p className="reader__title">{book.title}</p>
          <p className="reader__format">{book.format.toUpperCase()}</p>
        </div>

        <WordStage word={word} playing={playing} finished={finished} />

        {error && <p className="reader__error" role="alert">{error}</p>}

        <Controls
          playing={playing}
          wpm={wpm}
          index={index}
          total={book.words.length}
          disabled={busy}
          onToggle={() => {
            if (finished) {
              reset()
              setPlaying(true)
              return
            }
            setPlaying((p) => !p)
          }}
          onWpm={setWpm}
          onSeek={(i) => {
            seek(i)
          }}
          onReset={() => {
            setPlaying(false)
            reset()
          }}
        />

        <p className="reader__keys">Space play/pause · ← → step · + − speed</p>
      </main>
    </div>
  )
}
