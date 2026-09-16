export type SupportedFormat = 'pdf' | 'epub' | 'kindle' | 'text'

export interface BookImage {
  id: string
  src: string
  alt: string
  /** Word index nearest to where this image appears in the text stream */
  wordIndex: number
  width?: number
  height?: number
}

export interface ParsedBook {
  title: string
  format: SupportedFormat
  words: string[]
  images: BookImage[]
  /** Optional chapter markers as word indices */
  chapters?: { title: string; wordIndex: number }[]
}

export interface ReaderState {
  index: number
  wpm: number
  playing: boolean
}
