import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { BookImage, ParsedBook } from '../lib/types'
import { tokenize } from '../lib/text'

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

function isLikelyIllustration(
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number,
): boolean {
  const area = width * height
  const pageArea = pageWidth * pageHeight
  // Skip tiny icons/glyphs; keep figures that cover a meaningful page area
  if (width < 80 || height < 80) return false
  if (area < pageArea * 0.04) return false
  return true
}

export async function parsePdf(file: File): Promise<ParsedBook> {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise

  const words: string[] = []
  const images: BookImage[] = []
  const meta = await pdf.getMetadata().catch(() => null)
  const info = meta?.info as { Title?: string } | undefined
  const title =
    (typeof info?.Title === 'string' && info.Title.trim()) ||
    file.name.replace(/\.pdf$/i, '')

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    const pageWords = tokenize(pageText)
    const startIndex = words.length
    words.push(...pageWords)

    // Render page to canvas and capture as illustration for image-heavy pages
    // Also extract embedded images via operator list
    try {
      const ops = await page.getOperatorList()
      const { OPS } = pdfjs
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i]
        if (fn !== OPS.paintImageXObject && fn !== OPS.paintInlineImageXObject) {
          continue
        }
        const args = ops.argsArray[i] as unknown[]
        const imgName = args[0]
        if (typeof imgName !== 'string') continue
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const img = await (page as any).objs.get(imgName)
          if (!img || !img.width || !img.height) continue
          if (
            !isLikelyIllustration(
              img.width,
              img.height,
              viewport.width,
              viewport.height,
            )
          ) {
            continue
          }

          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (!ctx) continue

          if (img.data instanceof Uint8ClampedArray || img.data instanceof Uint8Array) {
            const imageData = ctx.createImageData(img.width, img.height)
            // pdf.js raw data may be RGB or RGBA
            const channels = img.data.length / (img.width * img.height)
            if (channels === 4) {
              imageData.data.set(img.data)
            } else if (channels === 3) {
              for (let p = 0, q = 0; p < img.data.length; p += 3, q += 4) {
                imageData.data[q] = img.data[p]
                imageData.data[q + 1] = img.data[p + 1]
                imageData.data[q + 2] = img.data[p + 2]
                imageData.data[q + 3] = 255
              }
            } else {
              continue
            }
            ctx.putImageData(imageData, 0, 0)
          } else if (typeof img.bitmap !== 'undefined') {
            ctx.drawImage(img.bitmap, 0, 0)
          } else {
            continue
          }

          images.push({
            id: `pdf-p${pageNum}-${imgName}`,
            src: canvas.toDataURL('image/jpeg', 0.85),
            alt: `Illustration from page ${pageNum}`,
            wordIndex: startIndex,
            width: img.width,
            height: img.height,
          })
        } catch {
          // skip failed image objects
        }
      }
    } catch {
      // operator list optional
    }

    // If page has little text but we rendered nothing, capture a page preview
    if (pageWords.length < 40 && images.every((im) => im.wordIndex !== startIndex)) {
      try {
        const scale = Math.min(1.2, 900 / viewport.width)
        const renderViewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = renderViewport.width
        canvas.height = renderViewport.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          await page.render({ canvasContext: ctx, viewport: renderViewport, canvas }).promise
          images.push({
            id: `pdf-page-${pageNum}`,
            src: canvas.toDataURL('image/jpeg', 0.8),
            alt: `Page ${pageNum}`,
            wordIndex: startIndex,
            width: canvas.width,
            height: canvas.height,
          })
        }
      } catch {
        // ignore render failures
      }
    }
  }

  return {
    title,
    format: 'pdf',
    words,
    images,
  }
}
