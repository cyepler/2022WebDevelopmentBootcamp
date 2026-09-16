import { useCallback, useRef, useState } from 'react'

interface FileDropProps {
  onFile: (file: File) => void
  busy: boolean
}

const ACCEPT = '.pdf,.epub,.mobi,.azw,.azw3,.prc,.txt,application/pdf,application/epub+zip'

export function FileDrop({ onFile, busy }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <div
      className={`file-drop ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''}`}
      onDragEnter={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        className="file-drop__btn"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Opening…' : 'Open book'}
      </button>
      <p className="file-drop__hint">PDF · EPUB · Kindle (.mobi / .azw)</p>
    </div>
  )
}
