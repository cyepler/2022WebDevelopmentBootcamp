import JSZip from 'jszip'
import type { BookImage, ParsedBook } from '../lib/types'
import { stripHtml, tokenize } from '../lib/text'

function resolvePath(base: string, relative: string): string {
  if (/^(https?:|data:|blob:)/i.test(relative)) return relative
  const baseParts = base.split('/').filter(Boolean)
  if (base.endsWith('/') || !base.includes('.')) {
    // keep as dir
  } else {
    baseParts.pop()
  }
  for (const part of relative.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') baseParts.pop()
    else baseParts.push(part)
  }
  return baseParts.join('/')
}

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(u8.byteLength)
  copy.set(u8)
  return copy.buffer
}

async function blobUrlFromZip(
  zip: JSZip,
  path: string,
): Promise<string | null> {
  const names = Object.keys(zip.files)
  const match =
    zip.file(path) ||
    zip.file(decodeURIComponent(path)) ||
    (() => {
      const found = names.find((n) => n.toLowerCase() === path.toLowerCase())
      return found ? zip.file(found) : null
    })()

  if (!match) return null
  const data = await match.async('uint8array')
  const blob = new Blob([toArrayBuffer(data)], { type: mimeFromPath(path) })
  return URL.createObjectURL(blob)
}

export async function parseEpub(file: File): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())

  const containerXml = await zip.file('META-INF/container.xml')?.async('text')
  if (!containerXml) throw new Error('Invalid EPUB: missing container.xml')

  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml')
  const rootfile = containerDoc.querySelector('rootfile')?.getAttribute('full-path')
  if (!rootfile) throw new Error('Invalid EPUB: missing rootfile')

  const opfText = await zip.file(rootfile)?.async('text')
  if (!opfText) throw new Error('Invalid EPUB: missing OPF package')

  const opf = new DOMParser().parseFromString(opfText, 'application/xml')
  const title =
    opf.querySelector('metadata > title, title')?.textContent?.trim() ||
    file.name.replace(/\.epub$/i, '')

  const manifest = new Map<string, { href: string; mediaType: string }>()
  opf.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    const mediaType = item.getAttribute('media-type') || ''
    if (id && href) manifest.set(id, { href, mediaType })
  })

  const spineIds: string[] = []
  opf.querySelectorAll('spine > itemref').forEach((ref) => {
    const idref = ref.getAttribute('idref')
    if (idref) spineIds.push(idref)
  })

  const words: string[] = []
  const images: BookImage[] = []
  const seenImages = new Set<string>()
  const opfDir = rootfile.includes('/')
    ? rootfile.slice(0, rootfile.lastIndexOf('/') + 1)
    : ''

  for (const id of spineIds) {
    const item = manifest.get(id)
    if (!item) continue
    const href = resolvePath(opfDir, item.href)
    const html = await zip.file(href)?.async('text')
    if (!html) continue

    const doc = new DOMParser().parseFromString(html, 'text/html')
    const startIndex = words.length

    // Collect images in document order, interleaving approximate word positions
    const root = doc.body || doc.documentElement
    const process = async (el: Element) => {
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const t = (child.textContent || '').replace(/\s+/g, ' ').trim()
          if (t) words.push(...tokenize(t))
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const elem = child as Element
          const tag = elem.tagName.toLowerCase()
          if (tag === 'img' || tag === 'image') {
            const src =
              elem.getAttribute('src') ||
              elem.getAttribute('xlink:href') ||
              elem.getAttribute('href')
            if (src && !src.startsWith('#')) {
              const imgPath = resolvePath(href, src.split('#')[0])
              if (!seenImages.has(imgPath)) {
                seenImages.add(imgPath)
                const blobUrl = await blobUrlFromZip(zip, imgPath)
                if (blobUrl) {
                  images.push({
                    id: `epub-${images.length}-${imgPath}`,
                    src: blobUrl,
                    alt: elem.getAttribute('alt') || 'Illustration',
                    wordIndex: words.length,
                  })
                }
              }
            }
          } else if (tag !== 'script' && tag !== 'style') {
            await process(elem)
          }
        }
      }
    }

    await process(root)

    // Fallback if tree walk yielded nothing
    if (words.length === startIndex) {
      words.push(...tokenize(stripHtml(html)))
    }
  }

  // Cover image from metadata
  const coverId =
    opf.querySelector('meta[name="cover"]')?.getAttribute('content') ||
    opf.querySelector('item[properties~="cover-image"]')?.getAttribute('id')
  if (coverId) {
    const cover = manifest.get(coverId)
    if (cover) {
      const path = resolvePath(opfDir, cover.href)
      if (!seenImages.has(path)) {
        const blobUrl = await blobUrlFromZip(zip, path)
        if (blobUrl) {
          images.unshift({
            id: 'epub-cover',
            src: blobUrl,
            alt: 'Cover',
            wordIndex: 0,
          })
        }
      }
    }
  }

  return {
    title,
    format: 'epub',
    words,
    images,
  }
}
