# PACE

Speed-read PDF, EPUB, and DRM-free Kindle (`.mobi` / `.azw` / `.azw3`) books in the browser.

## Features

- **Illustration gallery** at the top of the screen — figures and images from the book update as you read
- **RSVP word display** with optimal recognition point (ORP) highlighting
- **Speed control** from 100–800 WPM
- **Play / pause**, scrubbing, restart, and keyboard shortcuts (Space, ← →)

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Formats

| Format | Notes |
|--------|--------|
| PDF | Text + embedded images via PDF.js |
| EPUB | Full spine text + images |
| Kindle | DRM-free MOBI/AZW (PalmDOC). Encrypted Kindle books and HUFF/CDIC compression are not supported — convert to EPUB if needed. |

Books stay on your device; nothing is uploaded.
