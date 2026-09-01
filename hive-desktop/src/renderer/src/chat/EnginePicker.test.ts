// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { EnginePicker } from './EnginePicker'
import { pickInitial, type EngineCapabilities } from './engineOptions'

/**
 * The composer's engine control. Its job is to *reshape itself* around what
 * the active agent turned out to support, so the tests are mostly about shape:
 * which rows exist, how they are grouped, whether the effort ladder is there
 * at all, and whether the panel is honest about where its list came from.
 *
 * The DS `OptionPicker` is a popover; the stand-in below renders the rows
 * inline (with their descriptions, tags, meta and hints as text) so an
 * assertion can read what a row actually says without driving Radix. What is
 * under test here is the mapping, not the overlay — that has its own suite in
 * the design system.
 */
vi.mock('@hive/design-system', () => ({
  OptionPicker: ({
    options,
    groups,
    value,
    onChange,
    children,
    footer
  }: {
    options?: {
      id: string
      label: string
      description?: string
      hint?: string
      meta?: string
      group?: string
      tags?: { label: string }[]
    }[]
    groups?: { id: string; label?: string }[]
    value?: string
    onChange?: (id: string) => void
    children?: ReactNode
    footer?: ReactNode
  }) =>
    createElement(
      'div',
      null,
      children,
      createElement(
        'div',
        { 'data-testid': 'groups' },
        (groups ?? []).map((group) => group.label ?? `«${group.id}»`).join(' | ')
      ),
      ...(options ?? []).map((option) =>
        createElement(
          'div',
          { key: option.id, 'data-row': option.id, 'data-group': option.group },
          createElement(
            'button',
            { type: 'button', onClick: () => onChange?.(option.id) },
            option.label
          ),
          option.description && createElement('p', null, option.description),
          option.hint && createElement('code', null, option.hint),
          option.meta && createElement('span', { 'data-meta': true }, option.meta),
          ...(option.tags ?? []).map((tag) => createElement('em', { key: tag.label }, tag.label)),
          option.id === value && createElement('span', null, '✓')
        )
      ),
      footer
    ),
  // The ramp's own behaviour (cumulative fill, the delegated rung sitting apart
  // from the scale, the keyboard contract) is the design system's to prove —
  // `RampSelect.test.tsx` does that. What matters here is the *mapping*: which
  // rungs this agent gets, which one is marked, and what the chosen one says.
  RampSelect: ({
    steps,
    autoStep,
    value,
    onChange,
    ariaLabel,
    descriptionFallback
  }: {
    steps?: { id: string; label: string; description?: string }[]
    autoStep?: { id: string; label: string; description?: string }
    value?: string
    onChange?: (id: string) => void
    ariaLabel?: string
    descriptionFallback?: ReactNode
  }) => {
    const all = autoStep ? [autoStep, ...(steps ?? [])] : (steps ?? [])
    const selected = all.find((step) => step.id === value)
    return createElement(
      'div',
      { role: 'radiogroup', 'aria-label': ariaLabel },
      ...all.map((step) =>
        createElement(
          'button',
          {
            key: step.id,
            type: 'button',
            role: 'radio',
            'aria-checked': step.id === value,
            onClick: () => onChange?.(step.id)
          },
          step.label
        )
      ),
      createElement('p', null, selected?.description ?? descriptionFallback ?? '')
    )
  }
}))

const CLAUDE: EngineCapabilities = {
  models: [
    {
      id: '',
      label: 'Automático',
      descriptionKey: 'cliDefault',
      traits: ['cli-default'],
      group: 'default',
      source: 'configured',
      resolvedId: 'opus',
      contextWindow: 200_000
    },
    {
      id: 'sonnet',
      label: 'Sonnet',
      descriptionKey: 'claude.sonnet',
      contextWindow: 200_000,
      traits: ['balanced', 'thinking'],
      group: 'recommended',
      source: 'catalog'
    },
    {
      id: 'sonnet[1m]',
      label: 'Sonnet 1M',
      descriptionKey: 'claude.sonnet1m',
      contextWindow: 1_000_000,
      traits: ['balanced', 'long-context'],
      group: 'more',
      source: 'catalog'
    },
    {
      id: 'opus41',
      label: 'Opus 4.1',
      descriptionKey: 'claude.pinned',
      traits: ['legacy'],
      group: 'legacy',
      source: 'catalog'
    }
  ],
  efforts: [
    { id: '', label: 'Automático', descriptionKey: 'effort.cliDefault', group: 'default' },
    { id: 'low', label: 'Baixo', descriptionKey: 'effort.low' },
    { id: 'high', label: 'Alto', descriptionKey: 'effort.high' }
  ],
  supportsAttachments: true,
  provider: { id: 'anthropic', detail: null },
  modelSource: 'configured',
  defaults: { model: 'opus', effort: 'xhigh' }
}

const COPILOT: EngineCapabilities = {
  models: [
    { id: '', label: 'Automático', descriptionKey: 'cliDefault', group: 'default' },
    { id: 'gpt-5', label: 'GPT-5', vendor: 'OpenAI', group: 'recommended' },
    {
      id: 'claude-sonnet-4.5',
      label: 'Claude Sonnet 4.5',
      vendor: 'Anthropic',
      group: 'recommended'
    }
  ],
  efforts: [],
  supportsAttachments: true,
  provider: { id: 'github', detail: null },
  modelSource: 'catalog',
  note: 'no-listing'
}

function renderPicker(
  capabilities: EngineCapabilities,
  props: Partial<React.ComponentProps<typeof EnginePicker>> = {}
): { onModelChange: ReturnType<typeof vi.fn>; onEffortChange: ReturnType<typeof vi.fn> } {
  const onModelChange = vi.fn()
  const onEffortChange = vi.fn()
  render(
    createElement(EnginePicker, {
      capabilities,
      model: '',
      effort: '',
      onModelChange,
      onEffortChange,
      onRefresh: vi.fn(),
      refreshing: false,
      ...props
    })
  )
  return { onModelChange, onEffortChange }
}

afterEach(cleanup)

describe('EnginePicker', () => {
  it('translates a curated description key into pt-BR copy', () => {
    renderPicker(CLAUDE)
    expect(
      screen.getByText('Eficiente para trabalho de rotina — o equilíbrio recomendado')
    ).toBeTruthy()
  })

  // A description the machine wrote is evidence; translating it would erase
  // where it came from.
  it('passes a machine-written description through verbatim', () => {
    renderPicker({
      ...CLAUDE,
      models: [{ id: 'x', label: 'X', description: 'Fable 5 · Most capable', group: 'recommended' }]
    })
    expect(screen.getByText('Fable 5 · Most capable')).toBeTruthy()
  })

  it('shows what an alias resolves to, and the context window', () => {
    renderPicker(CLAUDE)
    expect(screen.getByText('→ opus')).toBeTruthy()
    expect(screen.getAllByText('200k').length).toBeGreaterThan(0)
    expect(screen.getByText('1M')).toBeTruthy()
  })

  // The tier glyph already says "flagship/balanced/fast", and the meta column
  // already says "1M"; repeating either as a chip would spend the row's most
  // valuable space saying nothing new.
  it('tags only the traits nothing else on the row carries', () => {
    renderPicker(CLAUDE)
    expect(screen.getByText('raciocínio')).toBeTruthy()
    expect(screen.queryByText('equilíbrio')).toBeNull()
    // "1M" is the meta, not a tag — so exactly one element says it.
    expect(screen.getAllByText('1M')).toHaveLength(1)
  })

  it('groups a single-vendor list by tier, and a multi-vendor one by vendor', () => {
    renderPicker(CLAUDE)
    expect(screen.getByTestId('groups').textContent).toBe(
      '«default» | Recomendados | Mais opções | Versões anteriores'
    )
    cleanup()
    renderPicker(COPILOT)
    expect(screen.getByTestId('groups').textContent).toBe('«default» | OpenAI | Anthropic')
  })

  it('reports the model the user picked', () => {
    const { onModelChange } = renderPicker(CLAUDE)
    fireEvent.click(screen.getByText('Sonnet'))
    expect(onModelChange).toHaveBeenCalledWith('sonnet')
  })

  // Copilot has no effort flag at all: showing a ladder would be a control
  // that changes nothing about the turn.
  it('shows the effort ladder only for an agent that has one', () => {
    renderPicker(CLAUDE)
    expect(screen.getByRole('radiogroup', { name: 'Nível de esforço' })).toBeTruthy()
    cleanup()
    renderPicker(COPILOT)
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('explains the selected effort in terms of time and cost', () => {
    renderPicker(CLAUDE, { effort: 'high' })
    expect(screen.getByText('Raciocina mais antes de responder')).toBeTruthy()
  })

  it('shortens the automatic effort to fit the ramp', () => {
    renderPicker(CLAUDE)
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeTruthy()
  })

  it('reports the effort the user picked', () => {
    const { onEffortChange } = renderPicker(CLAUDE)
    fireEvent.click(screen.getByRole('radio', { name: 'Alto' }))
    expect(onEffortChange).toHaveBeenCalledWith('high')
  })

  // The provenance line is what makes the list checkable rather than a claim.
  it('says where the list came from and which backend it applies to', () => {
    renderPicker(CLAUDE)
    expect(screen.getByText('Vem das suas configurações · API da Anthropic')).toBeTruthy()
  })

  it('names the provider detail when there is one', () => {
    renderPicker({
      ...CLAUDE,
      modelSource: 'detected',
      provider: { id: 'bedrock', detail: 'us-east-1' }
    })
    expect(screen.getByText('Lido da CLI nesta máquina · Amazon Bedrock (us-east-1)')).toBeTruthy()
  })

  it('admits when a CLI publishes no list', () => {
    renderPicker(COPILOT)
    expect(
      screen.getByText('Esta CLI não publica a lista de modelos; estes são os conhecidos.')
    ).toBeTruthy()
  })

  it('shows the model a turn actually reported, once one has', () => {
    renderPicker(CLAUDE, { runningModel: 'claude-sonnet-4-5-20250929' })
    expect(screen.getByText('Rodando em claude-sonnet-4-5-20250929')).toBeTruthy()
  })

  it('offers a re-detect that reports its own progress', () => {
    const onRefresh = vi.fn()
    renderPicker(CLAUDE, { onRefresh })
    fireEvent.click(screen.getByText('Redetectar'))
    expect(onRefresh).toHaveBeenCalled()
    cleanup()
    renderPicker(CLAUDE, { refreshing: true })
    expect(screen.getByText('Detectando…')).toBeTruthy()
  })

  // An agent with no model choice at all renders no control, rather than an
  // empty menu that opens onto nothing.
  it('renders nothing when the agent exposes no models', () => {
    const { container } = render(
      createElement(EnginePicker, {
        capabilities: { models: [], efforts: [], supportsAttachments: true },
        model: null,
        effort: null,
        onModelChange: vi.fn(),
        onEffortChange: vi.fn(),
        onRefresh: vi.fn(),
        refreshing: false
      })
    )
    expect(container.textContent).toBe('')
  })
})

describe('pickInitial', () => {
  const options = [
    { id: '', label: 'Automático' },
    { id: 'sonnet', label: 'Sonnet' }
  ]

  it('takes back a remembered choice that still exists', () => {
    expect(pickInitial(options, 'sonnet')).toBe('sonnet')
  })

  // A model can vanish between two detections (provider swap, account change);
  // keeping a dead id would fail on the next turn instead of here.
  it('drops a remembered choice the list no longer has', () => {
    expect(pickInitial(options, 'fantasma')).toBe('')
  })

  // The old behaviour sent whatever was first in the list as `--model` forever
  // after, overriding the model the user configured in their own CLI.
  it('defaults to letting the CLI decide', () => {
    expect(pickInitial(options)).toBe('')
  })

  it('falls back to the first row when there is no automatic one', () => {
    expect(pickInitial([{ id: 'gpt-5', label: 'GPT-5' }])).toBe('gpt-5')
  })

  it('answers null for an empty list', () => {
    expect(pickInitial([])).toBeNull()
  })
})
