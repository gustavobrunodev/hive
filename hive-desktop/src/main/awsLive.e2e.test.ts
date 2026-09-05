import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { createProcessRunner } from './processRunner'
import { resolveExecutable } from './cliEnv'
import { createAwsAuthService } from './awsAuthService'
import { detectBedrockSetup } from './awsBedrock'
import { findProfile, readAwsConfig, ssoCacheKeyOf } from './awsConfig'
import { readSsoToken, tokenState } from './awsSsoCache'

/**
 * aws-bedrock, against **this machine's real `~/.aws`**.
 *
 * Excluded from the default suite (`*.e2e.test.ts`) and run by
 * `npm run test:e2e`, for the same reason the Devin one is: it reads files the
 * app does not own, on a machine we did not configure.
 *
 * It exists because every other test in this feature hands the readers a
 * fixture, and a fixture can only ever prove that the code matches what we
 * *believe* the AWS CLI writes. This one checks the belief. Measured on the
 * machine it was written against (AWS CLI 2.32.23, an Identity Center account
 * with an `sso-session` and two profiles):
 *
 *   profiles: fitame-dev[fitame], fitame-prod[fitame], default, dev, prod
 *   fitame-dev → authKind sso, cache key "fitame",
 *                token 02b39a17…json (= sha1("fitame")), expiresAt 2026-01-06
 *
 * — i.e. the sha1-of-the-session-name naming, the config/credentials merge and
 * the expiry read all hold against files nobody wrote for the test.
 *
 * Skips itself on a machine with no `~/.aws/config`, which is most CI.
 */
const CONFIG = join(homedir(), '.aws', 'config')
const describeWithAws = existsSync(CONFIG) ? describe : describe.skip

describeWithAws('AWS config, live', () => {
  it('reads the real profiles, and resolves each SSO one to a cache key', () => {
    const view = readAwsConfig()
    expect(view.configPath).toBe(CONFIG)
    for (const profile of view.profiles) {
      expect(profile.name).not.toBe('')
      // A profile that names a session must have inherited that session's
      // portal — the join this app depends on for every cache lookup.
      if (profile.ssoSession) {
        expect(profile.ssoStartUrl).toMatch(/^https?:\/\//)
        expect(ssoCacheKeyOf(profile)).toBe(profile.ssoSession)
      }
    }
  })

  it('reads a real cached token, and never hands back a secret', () => {
    const view = readAwsConfig()
    const sso = view.profiles.find((profile) => profile.ssoSession !== null)
    if (!sso) return
    const token = readSsoToken(ssoCacheKeyOf(sso))
    if (!token) return // Never logged in on this machine — a real, valid state.
    expect(token.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(['valid', 'expiring', 'expired']).toContain(tokenState(token))
    expect(JSON.stringify(token)).not.toMatch(/accessToken|refreshToken|clientSecret/)
  })

  it('describes this machine without spawning anything', () => {
    const setup = detectBedrockSetup()
    expect(typeof setup.active).toBe('boolean')
    expect(setup.profile).not.toBe('')
    // The profile it picked either exists in the config or is the AWS default
    // — never something invented.
    const known = findProfile(readAwsConfig(), setup.profile)
    expect(known !== null || setup.profile === 'default').toBe(true)
  })
})

/**
 * The one thing no fixture can prove: that `aws sso login --no-browser` still
 * prints what the parser expects, from the binary on this machine.
 *
 * It starts a real login and **cancels it** the moment the URL arrives — the
 * flow never completes, nothing is written to the token cache, and no browser
 * opens (the `openExternal` here only records). What it establishes is the
 * whole contract between Hive and the AWS CLI: the argv is accepted, the URL is
 * printed, the parser finds it, and cancelling settles the promise instead of
 * hanging.
 */
const AWS = resolveExecutable('aws')
const HAS_SSO =
  existsSync(CONFIG) && AWS !== null && readAwsConfig().profiles.some((p) => p.ssoSession)
const describeWithSso = HAS_SSO ? describe : describe.skip

describeWithSso('aws sso login, live', () => {
  it('prints a verification URL this parser can read, and cancels cleanly', async () => {
    const profile = readAwsConfig().profiles.find((entry) => entry.ssoSession !== null)
    const opened: string[] = []
    const service = createAwsAuthService({
      processRunner: createProcessRunner(),
      openExternal: (url) => {
        opened.push(url)
        // The URL is out, the CLI is now waiting on a browser that will never
        // come — which is exactly the moment to stop.
        service.cancel()
      }
    })
    const result = await service.login(profile?.name ?? null)
    expect(opened).toHaveLength(1)
    expect(opened[0]).toMatch(/^https:\/\//)
    // Either the cancel won the race (the normal outcome) or the CLI exited
    // first; both are terminal, and neither may hang.
    expect(result.ok === false || result.ok === true).toBe(true)
    if (!result.ok) expect(['canceled', 'failed']).toContain(result.reason)
  }, 30_000)
})
