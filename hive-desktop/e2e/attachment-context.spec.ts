import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { test, expect, launchSeededApp, waitForWorkUI } from './fixtures/workspace'
import { armScriptedAgent } from './fixtures/scriptedAgent'

/**
 * The reported defect, end to end in the real app.
 *
 * A user attached a photo — `WhatsApp Image 2026-09-11 at 00.16.18.jpe` — and
 * asked the agent to read the data off it. The agent answered that it had
 * received no image. The path *was* in the turn's `<attached-files>` block, so
 * nothing looked broken from the app's side. What defeated it was the
 * extension: agent file-reading tools decide "is this an image?" by name, not
 * by bytes, and `.jpe` — a real, registered JPEG extension that WhatsApp and
 * some Windows exports emit — is in nobody's list. The agent opened a picture
 * as UTF-8, got mojibake, and honestly said no image had come.
 *
 * What is real here: the main process (`attachmentContext.ts`), the IPC
 * handler that upgrades a path into described context, the adapter's prompt
 * composer, and the prompt the CLI was actually invoked with — read back off
 * disk from the stand-in binary. Only the agent binary is replaced.
 *
 * The turn is sent through `window.hive.agent.send` rather than through the
 * attach button because the button opens a NATIVE file dialog, which no
 * browser automation can drive. Everything downstream of that dialog — which
 * is where the whole defect lived — is exercised exactly as it ships.
 */

/** A real PNG, written by hand so the test needs no image library. */
function writePng(filePath: string, width = 120, height = 60): void {
  const rows: Buffer[] = []
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3)
    for (let x = 0; x < width; x += 1) {
      const edge = x < 3 || y < 3 || x >= width - 3 || y >= height - 3
      row[1 + x * 3] = edge ? 204 : 250
      row[2 + x * 3] = edge ? 121 : 248
      row[3 + x * 3] = edge ? 88 : 245
    }
    rows.push(row)
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const head = Buffer.alloc(4)
    head.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(zlib.crc32(body) >>> 0)
    return Buffer.concat([head, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  fs.writeFileSync(
    filePath,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
      chunk('IEND', Buffer.alloc(0))
    ])
  )
}

test.describe('attachments reach the agent as what they are', () => {
  test('@p1 uma imagem com extensão que o leitor não conhece chega renomeada e tipada', async ({
    seeded
  }) => {
    // Outside the workspace, like a photo in Downloads — the case the picker
    // produces and the one where an absolute path is all the agent gets.
    const photo = path.join(seeded.root, 'WhatsApp Image 2026-09-11 at 00.16.18.jpe')
    writePng(photo)

    const agent = armScriptedAgent(seeded, { chunks: ['Li a imagem.'] })
    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await window.evaluate(
      (file) => window.hive.agent.send('Extraia os dados dessa foto', { attachments: [file] }),
      photo
    )

    await expect
      .poll(() => agent.invocations().filter((entry) => entry.kind === 'turn').length, {
        timeout: 30_000
      })
      .toBe(1)

    const prompt = agent.invocations().find((entry) => entry.kind === 'turn')?.prompt ?? ''

    // The path the agent is told to read is NOT the `.jpe`: it is a staged
    // copy whose name an image reader recognises.
    const listed = prompt.match(/^- (.+?) — /m)?.[1] ?? ''
    expect(listed.endsWith('.png')).toBe(true)
    expect(listed).not.toBe(photo)
    // …and that copy is really on disk, byte-for-byte the user's file.
    expect(fs.existsSync(listed)).toBe(true)
    expect(fs.readFileSync(listed).equals(fs.readFileSync(photo))).toBe(true)
    // The original is untouched — it is the user's file, in the user's folder.
    expect(fs.existsSync(photo)).toBe(true)

    // The block says what the file is, names the original so a reply can quote
    // the name the user knows, and tells the agent to open images rather than
    // report them missing.
    expect(prompt).toContain('image/png')
    expect(prompt).toContain('WhatsApp Image 2026-09-11 at 00.16.18.jpe')
    expect(prompt).toMatch(/never answer that no image was provided/i)
    expect(prompt.startsWith('Extraia os dados dessa foto\n\n<attached-files>')).toBe(true)

    await app.close()
  })

  test('@p1 um arquivo do workspace continua chegando pelo caminho relativo', async ({
    seeded
  }) => {
    // `@` references resolve against the session's cwd, so main must not stat
    // them: a relative path described from the main process would describe the
    // wrong file entirely.
    fs.mkdirSync(path.join(seeded.workspace, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(seeded.workspace, 'docs', 'prd.md'), '# PRD\n')

    const agent = armScriptedAgent(seeded, { chunks: ['Li o PRD.'] })
    const app = await launchSeededApp(seeded, { env: agent.env })
    const window = await app.firstWindow()
    await waitForWorkUI(window)

    await window.evaluate(() =>
      window.hive.agent.send('resume isso', { attachments: ['docs/prd.md'] })
    )

    await expect
      .poll(() => agent.invocations().filter((entry) => entry.kind === 'turn').length, {
        timeout: 30_000
      })
      .toBe(1)

    const prompt = agent.invocations().find((entry) => entry.kind === 'turn')?.prompt ?? ''
    expect(prompt).toContain('\n- docs/prd.md\n')

    await app.close()
  })
})
