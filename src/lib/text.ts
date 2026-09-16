import type { SupportedFormat } from './types'

/** Split text into RSVP-friendly tokens while preserving punctuation. */
export function tokenize(text: string): string[] {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
}

export function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, noscript').forEach((el) => el.remove())
  return doc.body.textContent ?? ''
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function detectFormat(file: File): SupportedFormat | null {
  const ext = extensionOf(file.name)
  const type = file.type.toLowerCase()

  if (ext === 'pdf' || type === 'application/pdf') return 'pdf'
  if (ext === 'epub' || type === 'application/epub+zip') return 'epub'
  if (
    ['mobi', 'azw', 'azw3', 'prc'].includes(ext) ||
    type.includes('mobipocket') ||
    type.includes('kindle')
  ) {
    return 'kindle'
  }
  if (ext === 'txt' || type.startsWith('text/')) return 'text'
  return null
}
