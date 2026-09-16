import type { CSSProperties } from 'react'

interface ControlsProps {
  playing: boolean
  wpm: number
  index: number
  total: number
  onToggle: () => void
  onWpm: (wpm: number) => void
  onSeek: (index: number) => void
  onReset: () => void
  disabled?: boolean
}

export function Controls({
  playing,
  wpm,
  index,
  total,
  onToggle,
  onWpm,
  onSeek,
  onReset,
  disabled,
}: ControlsProps) {
  const progress = total > 1 ? (index / (total - 1)) * 100 : 0
  const remainingWords = Math.max(0, total - index)
  const etaMin = wpm > 0 ? remainingWords / wpm : 0
  const etaLabel =
    etaMin < 1
      ? `${Math.round(etaMin * 60)}s left`
      : `${Math.floor(etaMin)}m ${Math.round((etaMin % 1) * 60)}s left`

  return (
    <div className={`controls ${disabled ? 'is-disabled' : ''}`}>
      <div className="controls__transport">
        <button
          type="button"
          className="controls__btn controls__btn--ghost"
          onClick={onReset}
          disabled={disabled}
          aria-label="Restart"
        >
          ↻
        </button>
        <button
          type="button"
          className="controls__btn controls__btn--primary"
          onClick={onToggle}
          disabled={disabled || total === 0}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <span className="controls__icon-pause" aria-hidden="true" />
          ) : (
            <span className="controls__icon-play" aria-hidden="true" />
          )}
          <span>{playing ? 'Pause' : 'Play'}</span>
        </button>
      </div>

      <div className="controls__speed">
        <span className="controls__speed-label">
          Speed <strong>{wpm}</strong> WPM
        </span>
        <input
          type="range"
          min={100}
          max={800}
          step={10}
          value={wpm}
          disabled={disabled}
          onChange={(e) => onWpm(Number(e.target.value))}
          aria-label="Reading speed"
          aria-valuetext={`${wpm} words per minute`}
        />
        <div className="controls__speed-scale">
          <button
            type="button"
            className="controls__speed-nudge"
            disabled={disabled || wpm <= 100}
            aria-label="Slower"
            onClick={() => onWpm(Math.max(100, wpm - 20))}
          >
            −
          </button>
          <span>100</span>
          <span>800</span>
          <button
            type="button"
            className="controls__speed-nudge"
            disabled={disabled || wpm >= 800}
            aria-label="Faster"
            onClick={() => onWpm(Math.min(800, wpm + 20))}
          >
            +
          </button>
        </div>
      </div>

      <div className="controls__progress">
        <input
          type="range"
          min={0}
          max={Math.max(0, total - 1)}
          value={index}
          disabled={disabled || total === 0}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Reading position"
          style={{ '--progress': `${progress}%` } as CSSProperties}
        />
        <div className="controls__meta">
          <span>
            {total === 0 ? '0 / 0' : `${index + 1} / ${total}`}
          </span>
          <span>{total > 0 ? etaLabel : '—'}</span>
        </div>
      </div>
    </div>
  )
}
