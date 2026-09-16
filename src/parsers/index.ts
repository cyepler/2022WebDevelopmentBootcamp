import type { ParsedBook } from '../lib/types'
import { detectFormat, tokenize } from '../lib/text'

export async function parseBook(file: File): Promise<ParsedBook> {
  const format = detectFormat(file)
  if (!format) {
    throw new Error(
      'Unsupported file type. Please upload a PDF, EPUB, or Kindle (.mobi / .azw / .azw3) file.',
    )
  }

  if (format === 'pdf') {
    const { parsePdf } = await import('./pdf')
    return parsePdf(file)
  }
  if (format === 'epub') {
    const { parseEpub } = await import('./epub')
    return parseEpub(file)
  }
  if (format === 'kindle') {
    const { parseKindle } = await import('./kindle')
    return parseKindle(file)
  }

  const text = await file.text()
  return {
    title: file.name.replace(/\.txt$/i, ''),
    format: 'text',
    words: tokenize(text),
    images: [],
  }
}

/** Built-in sample for trying the reader without a file */
export function sampleBook(): ParsedBook {
  const prose = `
    PACE is a speed reading companion for the books you already own.
    Drop a PDF, EPUB, or DRM-free Kindle file to begin.
    Words appear one at a time so your eyes stay still while meaning flows forward.
    Illustrations from your book surface in the gallery above as you move through the text.
    Use the dial to set words per minute, pause when a line deserves a breath, then continue.
    Start slow, find your rhythm, and let the page keep up with you.
  `
  return {
    title: 'Welcome to PACE',
    format: 'text',
    words: tokenize(prose),
    images: [
      {
        id: 'sample-1',
        src:
          'data:image/svg+xml,' +
          encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="420" viewBox="0 0 960 420">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#0d3b3e"/>
                <stop offset="55%" stop-color="#1a5c52"/>
                <stop offset="100%" stop-color="#c4f542"/>
              </linearGradient>
            </defs>
            <rect width="960" height="420" fill="url(#g)"/>
            <circle cx="720" cy="120" r="90" fill="#f2f7f4" opacity="0.18"/>
            <text x="64" y="200" fill="#f2f7f4" font-family="Georgia, serif" font-size="48">Illustrations live here</text>
            <text x="64" y="250" fill="#d7eadc" font-family="system-ui, sans-serif" font-size="22">Figures from your book appear as you read</text>
          </svg>`),
        alt: 'Sample illustration panel',
        wordIndex: 0,
      },
      {
        id: 'sample-2',
        src:
          'data:image/svg+xml,' +
          encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="420" viewBox="0 0 960 420">
            <rect width="960" height="420" fill="#10261f"/>
            <path d="M0 320 C180 260 300 360 480 300 C660 240 780 340 960 280 L960 420 L0 420 Z" fill="#c4f542" opacity="0.35"/>
            <text x="64" y="180" fill="#f2f7f4" font-family="Georgia, serif" font-size="44">Speed is yours to set</text>
            <text x="64" y="230" fill="#a8c9b4" font-family="system-ui, sans-serif" font-size="20">100–800 WPM with instant pause</text>
          </svg>`),
        alt: 'Sample speed illustration',
        wordIndex: 35,
      },
    ],
  }
}
