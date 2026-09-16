interface WordStageProps {
  word: string
  playing: boolean
  finished: boolean
}

/** ORP (optimal recognition point) highlight for classic RSVP */
function splitOrp(word: string): { before: string; pivot: string; after: string } {
  if (!word) return { before: '', pivot: '', after: '' }
  const clean = word.replace(/[^\p{L}\p{N}]/gu, '')
  if (!clean) return { before: '', pivot: word, after: '' }

  let pivotIdx = 0
  if (clean.length === 1) pivotIdx = 0
  else if (clean.length <= 5) pivotIdx = 1
  else if (clean.length <= 9) pivotIdx = 2
  else if (clean.length <= 13) pivotIdx = 3
  else pivotIdx = 4

  // Map pivot back onto original string (with punctuation)
  let seen = 0
  let originalPivot = 0
  for (let i = 0; i < word.length; i++) {
    if (/[\p{L}\p{N}]/u.test(word[i])) {
      if (seen === pivotIdx) {
        originalPivot = i
        break
      }
      seen++
    }
  }

  return {
    before: word.slice(0, originalPivot),
    pivot: word[originalPivot] ?? '',
    after: word.slice(originalPivot + 1),
  }
}

export function WordStage({ word, playing, finished }: WordStageProps) {
  const { before, pivot, after } = splitOrp(word)

  return (
    <div
      className={`word-stage ${playing ? 'is-playing' : ''} ${finished ? 'is-finished' : ''}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="word-stage__guides" aria-hidden="true">
        <span className="word-stage__tick word-stage__tick--top" />
        <span className="word-stage__tick word-stage__tick--bottom" />
      </div>
      <p className="word-stage__word" key={word + String(playing)}>
        <span className="word-stage__before">{before}</span>
        <span className="word-stage__pivot">{pivot}</span>
        <span className="word-stage__after">{after}</span>
      </p>
      {finished && <p className="word-stage__done">End of book</p>}
    </div>
  )
}
