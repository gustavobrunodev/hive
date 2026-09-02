import { forwardRef } from 'react'
import { HighlightedTextarea } from '@hive/design-system'
import { t } from '../../i18n'
import { transcriptRuns } from './transcriptBackdrop'

export interface TranscriptDocumentProps {
  value: string
  onChange: (next: string) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  /** `[start, end)` of the run a segment just landed in (SB-R5.6). */
  freshRange: readonly [number, number] | null
  /** True while dictation owns the field — drives the accent ring. */
  live: boolean
  /** Which source is filling it, so the label and the empty line can be honest. */
  source: 'text' | 'audio' | 'live'
}

/** The label and the sentence under it, per source. */
function captions(source: TranscriptDocumentProps['source']): {
  label: string
  hint: string | null
  empty: string | null
} {
  if (source === 'text') {
    return { label: t('secondBrain.documentLabelText'), hint: null, empty: null }
  }
  if (source === 'audio') {
    return {
      label: t('secondBrain.documentLabel'),
      hint: t('secondBrain.documentHintAudio'),
      empty: t('secondBrain.documentEmptyAudio')
    }
  }
  return {
    label: t('secondBrain.documentLabel'),
    hint: t('secondBrain.documentHintLive'),
    empty: t('secondBrain.documentEmptyLive')
  }
}

/**
 * The one thing all three sources produce: an editable document, always on
 * screen, always the thing that gets ingested (SB-R4.7/R5.6).
 *
 * Making it permanent rather than conditional is the change that ties the sheet
 * together. Before, the field appeared only once an audio pass had finished, so
 * the three modes read as three different tools; now every mode is visibly
 * writing into the same place, which is also the honest picture of what
 * "Ingerir" will send. It is a plain textarea underneath — the user's caret,
 * selection, undo and spellcheck are the platform's — with a transparent mirror
 * behind it that tints the run a segment just wrote.
 *
 * The empty state teaches rather than apologising: an audio pass says the
 * transcript will appear here, a live take says roughly *when* the first words
 * will, because a few seconds of silence at the start of dictation is the
 * moment a user decides the feature is broken.
 */
export const TranscriptDocument = forwardRef<HTMLTextAreaElement, TranscriptDocumentProps>(
  function TranscriptDocument({ value, onChange, onKeyDown, freshRange, live, source }, ref) {
    const { label, hint, empty } = captions(source)
    const chars = value.trim().length

    return (
      <section className="wb-transcript" data-live={live || undefined}>
        <header className="wb-transcript-head">
          <label className="wb-transcript-label" htmlFor="wb-ingest-transcript">
            {label}
          </label>
          {chars > 0 && (
            <span className="wb-transcript-count">{t('secondBrain.ingestCharCount', chars)}</span>
          )}
        </header>

        <HighlightedTextarea
          id="wb-ingest-transcript"
          ref={ref}
          className="wb-transcript-field"
          value={value}
          active={live}
          fill
          minRows={source === 'text' ? 8 : 6}
          maxRows={16}
          placeholder={
            source === 'text' ? t('secondBrain.ingestTextPlaceholder') : (empty ?? undefined)
          }
          aria-label={label}
          // Enter must insert a newline here: this is a document being written,
          // not a message being sent.
          submitOnEnter={false}
          onKeyDown={onKeyDown}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
          highlight={(current: string) =>
            transcriptRuns(current, freshRange).map((run, index) => (
              <span key={index} className={run.fresh ? 'wb-transcript-fresh' : undefined}>
                {run.text}
              </span>
            ))
          }
        />

        {hint !== null && <p className="wb-transcript-hint">{hint}</p>}
      </section>
    )
  }
)
