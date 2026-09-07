import { describe, expect, it } from 'vitest'
import { connectionSummary } from './connectionSummary'
import { awsReadyFixture, awsStatusFixture } from '../testSupport/hiveAwsMock'
import { claudeSignedOutFixture, claudeStatusFixture } from '../testSupport/hiveClaudeAuthMock'

/**
 * The profile index's one line about credentials.
 *
 * The rule it encodes is the whole reason this row was rewritten: the line
 * belongs to **the lane in use**, not to one of them. Before, the row summarised
 * AWS on every machine — which on the majority of them said "Sem Bedrock", a
 * true sentence about something nobody asked, while the thing that would stop
 * their next message had no surface at all.
 */

describe('connectionSummary', () => {
  it('says nothing until main has answered — the read costs a spawn', () => {
    expect(connectionSummary(null, awsReadyFixture())).toBeNull()
  })

  it('reads the account on a first-party machine', () => {
    expect(connectionSummary(claudeStatusFixture(), awsStatusFixture())).toBe(
      'pessoa@exemplo.dev · Plano Pro'
    )
  })

  it('states the one thing that will stop the next message', () => {
    expect(connectionSummary(claudeSignedOutFixture(), awsStatusFixture())).toBe(
      'Nenhuma conta conectada'
    )
  })

  it('hands the line to the AWS lane when the CLI says it is on Bedrock', () => {
    const onBedrock = claudeStatusFixture({ state: 'third-party' })
    expect(connectionSummary(onBedrock, awsReadyFixture())).toBe('acme-dev · 6 h')
  })

  it('follows Hive’s own AWS reading too, when the CLI has not said either way', () => {
    // `active` comes from the settings chain; a machine mid-configuration can
    // have it before `claude auth status` reflects it.
    expect(connectionSummary(claudeStatusFixture(), awsReadyFixture())).toBe('acme-dev · 6 h')
  })

  it('covers the remaining first-party readings', () => {
    expect(connectionSummary(claudeStatusFixture({ state: 'api-key' }), null)).toBe(
      'Chave de API em uso'
    )
    expect(
      connectionSummary(claudeStatusFixture({ state: 'no-cli', cliAvailable: false }), null)
    ).toBe('Claude CLI não encontrado')
    expect(connectionSummary(claudeStatusFixture({ state: 'unknown', account: null }), null)).toBe(
      'Não deu para ler a conexão'
    )
  })

  it('falls back to the state when a connected account has no name to give', () => {
    const nameless = claudeStatusFixture({
      account: {
        loggedIn: true,
        authMethod: 'claude.ai',
        apiProvider: 'firstParty',
        apiKeySource: null,
        email: null,
        organization: null,
        subscription: null
      }
    })
    expect(connectionSummary(nameless, null)).toBe('Conta conectada')
  })
})
