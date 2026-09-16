/**
 * Kindle / Mobipocket (.mobi, .azw, .azw3) parser.
 * Supports uncompressed and PalmDOC-compressed books.
 * DRM-protected Kindle files cannot be opened.
 */
import type { BookImage, ParsedBook } from '../lib/types'
import { stripHtml, tokenize } from '../lib/text'

const TEXT_ENCODINGS = ['windows-1252', 'utf-8', 'utf-16be'] as const

function readU16(view: DataView, offset: number): number {
  return view.getUint16(offset, false)
}

function readU32(view: DataView, offset: number): number {
  return view.getUint32(offset, false)
}

function readString(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

/** PalmDOC LZ77-style decompression */
function palmdocDecompress(data: Uint8Array): Uint8Array {
  const out: number[] = []
  let i = 0
  while (i < data.length) {
    const b = data[i++]
    if (b === 0x00) {
      out.push(0)
    } else if (b >= 0x01 && b <= 0x08) {
      for (let j = 0; j < b && i < data.length; j++) out.push(data[i++])
    } else if (b >= 0x09 && b <= 0x7f) {
      out.push(b)
    } else if (b >= 0x80 && b <= 0xbf) {
      if (i >= data.length) break
      const b2 = data[i++]
      const distance = (((b << 8) | b2) >> 3) & 0x7ff
      const length = (b2 & 0x07) + 3
      for (let j = 0; j < length; j++) {
        const idx = out.length - distance
        out.push(idx >= 0 ? out[idx] : 0)
      }
    } else {
      // 0xc0–0xff: space + ASCII
      out.push(0x20)
      out.push(b ^ 0x80)
    }
  }
  return Uint8Array.from(out)
}

function decodeText(bytes: Uint8Array, encoding: number): string {
  // MOBI encoding: 1252 = windows-1252, 65001 = utf-8
  let label: string = 'windows-1252'
  if (encoding === 65001) label = 'utf-8'
  else if (encoding === 65002) label = 'utf-16be'
  else if (encoding === 1252) label = 'windows-1252'

  try {
    return new TextDecoder(label).decode(bytes)
  } catch {
    for (const enc of TEXT_ENCODINGS) {
      try {
        return new TextDecoder(enc).decode(bytes)
      } catch {
        /* try next */
      }
    }
    return new TextDecoder('latin1').decode(bytes)
  }
}

function isJpeg(data: Uint8Array): boolean {
  return data.length > 3 && data[0] === 0xff && data[1] === 0xd8
}

function isPng(data: Uint8Array): boolean {
  return (
    data.length > 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47
  )
}

function isGif(data: Uint8Array): boolean {
  return (
    data.length > 6 &&
    data[0] === 0x47 &&
    data[1] === 0x49 &&
    data[2] === 0x46
  )
}

function imageMime(data: Uint8Array): string | null {
  if (isJpeg(data)) return 'image/jpeg'
  if (isPng(data)) return 'image/png'
  if (isGif(data)) return 'image/gif'
  return null
}

export async function parseKindle(file: File): Promise<ParsedBook> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)

  if (bytes.length < 78) {
    throw new Error('File too small to be a Kindle/MOBI book')
  }

  const type = readString(bytes, 60, 8)
  // PalmDB type/creator typically BOOKMOBI or TEXtREAd
  if (!type.includes('BOOK') && !type.includes('TEXT') && !type.includes('MOBI')) {
    // still try — some AZW variants differ
  }

  const numRecords = readU16(view, 76)
  if (numRecords < 1 || numRecords > 50000) {
    throw new Error('Invalid Kindle database header')
  }

  const recordOffsets: number[] = []
  for (let i = 0; i < numRecords; i++) {
    const off = 78 + i * 8
    recordOffsets.push(readU32(view, off))
  }

  const recordData = (index: number): Uint8Array => {
    const start = recordOffsets[index]
    const end = index + 1 < recordOffsets.length ? recordOffsets[index + 1] : bytes.length
    return bytes.subarray(start, end)
  }

  const header = recordData(0)
  if (header.length < 16) throw new Error('Missing MOBI header record')

  const compression = readU16(new DataView(header.buffer, header.byteOffset, header.byteLength), 0)
  // 1 = no compression, 2 = PalmDOC, 17480 = HUFF/CDIC
  const headerView = new DataView(header.buffer, header.byteOffset, header.byteLength)

  let textLength = readU32(headerView, 4)
  let recordCount = readU16(headerView, 8)
  let encoding = 1252
  let fullName = file.name.replace(/\.(mobi|azw3?|prc)$/i, '')
  let firstImageIndex = -1
  let mobiType = 2
  let drmFlags = 0

  // MOBI header starts at offset 16 if magic is MOBI
  const magic = readString(header, 16, 4)
  if (magic === 'MOBI') {
    const mobiLength = readU32(headerView, 20)
    mobiType = readU32(headerView, 24)
    encoding = readU32(headerView, 28)
    // full name
    if (header.length >= 92) {
      const fullNameOffset = readU32(headerView, 84)
      const fullNameLength = readU32(headerView, 88)
      if (
        fullNameOffset > 0 &&
        fullNameLength > 0 &&
        fullNameOffset + fullNameLength <= header.length
      ) {
        fullName = decodeText(
          header.subarray(fullNameOffset, fullNameOffset + fullNameLength),
          encoding,
        ).replace(/\0/g, '').trim() || fullName
      }
    }
    if (header.length >= 84) {
      firstImageIndex = readU32(headerView, 108) // first image index in some layouts
    }
    // EXTH flag at 0x80
    if (header.length >= 132) {
      const exthFlags = readU32(headerView, 128)
      if (exthFlags & 0x40) {
        // EXTH header present
        const exthOffset = 16 + mobiLength
        if (exthOffset + 12 <= header.length && readString(header, exthOffset, 4) === 'EXTH') {
          const exthLength = readU32(headerView, exthOffset + 4)
          const exthCount = readU32(headerView, exthOffset + 8)
          let p = exthOffset + 12
          for (let i = 0; i < exthCount && p + 8 <= exthOffset + exthLength; i++) {
            const recordType = readU32(headerView, p)
            const recordLength = readU32(headerView, p + 4)
            if (recordLength < 8 || p + recordLength > header.length) break
            const data = header.subarray(p + 8, p + recordLength)
            if (recordType === 503 || recordType === 201) {
              // updated title / cover offset variants
            }
            if (recordType === 503 || recordType === 99) {
              const t = decodeText(data, encoding).replace(/\0/g, '').trim()
              if (t) fullName = t
            }
            // DRM-ish
            if (recordType === 404 || recordType === 405) drmFlags = 1
            p += recordLength
          }
        }
      }
    }

    // Better first image index (offset 0x6c = 108)
    if (header.length >= 112) {
      const imgIdx = readU32(headerView, 108)
      if (imgIdx > 0 && imgIdx < numRecords) firstImageIndex = imgIdx
    }

    // text record count may be more accurate from MOBI
    if (header.length >= 196) {
      const fc = readU32(headerView, 192) // first content record? varies
      void fc
    }
  }

  // Detect DRM: encrypted books often have non-standard compression or trailing encryption
  if (compression !== 1 && compression !== 2) {
    if (compression === 17480) {
      throw new Error(
        'This Kindle file uses HUFF/CDIC compression, which is not yet supported. Try EPUB or PDF, or re-export without that encoding.',
      )
    }
    throw new Error(
      'This Kindle file appears DRM-protected or uses an unsupported compression. Only DRM-free MOBI/AZW files can be opened.',
    )
  }

  if (drmFlags) {
    // soft warning — still try
  }

  // Limit text records
  if (recordCount <= 0 || recordCount > numRecords - 1) {
    recordCount = Math.min(numRecords - 1, 10000)
    if (firstImageIndex > 1) recordCount = Math.min(recordCount, firstImageIndex - 1)
  }

  const textChunks: Uint8Array[] = []
  let total = 0
  for (let i = 1; i <= recordCount && i < numRecords; i++) {
    if (firstImageIndex > 0 && i >= firstImageIndex) break
    let chunk = recordData(i)
    // Strip trailing overlapping multibyte markers (2-byte length at end sometimes)
    if (compression === 2) {
      try {
        chunk = palmdocDecompress(chunk)
      } catch {
        // keep raw
      }
    }
    textChunks.push(chunk)
    total += chunk.length
    if (textLength > 0 && total >= textLength) break
  }

  const combined = new Uint8Array(total)
  let offset = 0
  for (const c of textChunks) {
    combined.set(c, offset)
    offset += c.length
  }
  const clipped =
    textLength > 0 && textLength < combined.length
      ? combined.subarray(0, textLength)
      : combined

  let rawText = decodeText(clipped, encoding)
  // MOBI often contains HTML-like markup
  if (/<html|<p|<body|<mbp:|<div/i.test(rawText)) {
    rawText = stripHtml(rawText)
  } else {
    rawText = rawText.replace(/\0/g, ' ')
  }

  const words = tokenize(rawText)
  if (words.length === 0) {
    throw new Error(
      'Could not extract text from this Kindle file. It may be DRM-protected or KF8-only (try converting to EPUB).',
    )
  }

  // Extract images from records
  const images: BookImage[] = []
  const start = firstImageIndex > 0 ? firstImageIndex : Math.max(1, recordCount + 1)
  for (let i = start; i < numRecords; i++) {
    const data = recordData(i)
    // Some records have a 1-byte type header before image data
    let img = data
    const mime = imageMime(img) || imageMime(data.subarray(1))
    if (!mime) continue
    if (!imageMime(img)) img = data.subarray(1)
    // Skip tiny images (likely icons)
    if (img.length < 2000) continue

    const copy = new Uint8Array(img.byteLength)
    copy.set(img)
    const blob = new Blob([copy.buffer], { type: mime })
    const src = URL.createObjectURL(blob)
    const wordIndex =
      images.length === 0
        ? 0
        : Math.min(
            words.length - 1,
            Math.floor((images.length / Math.max(1, numRecords - start)) * words.length),
          )
    images.push({
      id: `kindle-img-${i}`,
      src,
      alt: `Illustration ${images.length + 1}`,
      wordIndex,
    })
    if (images.length >= 40) break
  }

  void mobiType

  return {
    title: fullName || file.name,
    format: 'kindle',
    words,
    images,
  }
}
