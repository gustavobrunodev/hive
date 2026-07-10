import { describe, expect, it } from 'vitest'
import {
  createFakeProcessRunner,
  createProcessRunner,
  type ProcessStreamChunk
} from './processRunner'

async function collect(output: AsyncIterable<ProcessStreamChunk>): Promise<ProcessStreamChunk[]> {
  const chunks: ProcessStreamChunk[] = []
  for await (const chunk of output) {
    chunks.push(chunk)
  }
  return chunks
}

describe('ProcessRunner — fake runner', () => {
  it('streams exactly the scripted stdout chunks in order and reports the scripted exit code', async () => {
    const runner = createFakeProcessRunner()
    runner.script({
      chunks: [
        { stream: 'stdout', data: 'Step 1/3: installing bmm module\n' },
        { stream: 'stdout', data: 'Step 2/3: configuring\n' },
        { stream: 'stdout', data: 'Step 3/3: done\n' }
      ],
      code: 0
    })

    const handle = runner.run('bmad-method', ['install', '--yes'])

    const chunks = await collect(handle.output)
    expect(chunks).toEqual([
      { stream: 'stdout', data: 'Step 1/3: installing bmm module\n' },
      { stream: 'stdout', data: 'Step 2/3: configuring\n' },
      { stream: 'stdout', data: 'Step 3/3: done\n' }
    ])
    await expect(handle.exitCode).resolves.toEqual({ code: 0, signal: null })
  })

  it('interleaves stdout and stderr chunks in the scripted order, tagged by stream', async () => {
    const runner = createFakeProcessRunner()
    runner.script({
      chunks: [
        { stream: 'stdout', data: 'starting\n' },
        { stream: 'stderr', data: 'warning: deprecated flag\n' },
        { stream: 'stdout', data: 'finished\n' }
      ],
      code: 1
    })

    const handle = runner.run('some-cli', [])
    const chunks = await collect(handle.output)

    expect(chunks.map((c) => c.stream)).toEqual(['stdout', 'stderr', 'stdout'])
    await expect(handle.exitCode).resolves.toEqual({ code: 1, signal: null })
  })

  it('defaults to an immediately-successful empty process when nothing is scripted', async () => {
    const runner = createFakeProcessRunner()
    const handle = runner.run('noop', [])

    const chunks = await collect(handle.output)
    expect(chunks).toEqual([])
    await expect(handle.exitCode).resolves.toEqual({ code: 0, signal: null })
  })

  it('records each run() invocation (command/args/opts) for assertions', () => {
    const runner = createFakeProcessRunner()
    runner.script({ code: 0 })
    runner.script({ code: 1 })

    runner.run('npx', ['bmad-method', 'install'], { cwd: '/workspace' })
    runner.run('claude', ['--print'], { env: { FOO: 'bar' } })

    expect(runner.calls).toEqual([
      { command: 'npx', args: ['bmad-method', 'install'], opts: { cwd: '/workspace' } },
      { command: 'claude', args: ['--print'], opts: { env: { FOO: 'bar' } } }
    ])
  })

  it('consumes scripts FIFO across multiple run() calls on the same runner', async () => {
    const runner = createFakeProcessRunner()
    runner.script({ chunks: [{ stream: 'stdout', data: 'first\n' }], code: 0 })
    runner.script({ chunks: [{ stream: 'stdout', data: 'second\n' }], code: 2 })

    const first = runner.run('cmd', ['1'])
    const second = runner.run('cmd', ['2'])

    expect(await collect(first.output)).toEqual([{ stream: 'stdout', data: 'first\n' }])
    expect(await collect(second.output)).toEqual([{ stream: 'stdout', data: 'second\n' }])
    await expect(first.exitCode).resolves.toEqual({ code: 0, signal: null })
    await expect(second.exitCode).resolves.toEqual({ code: 2, signal: null })
  })

  it('kill() on a fake handle resolves exit early with a null code and the given signal', async () => {
    const runner = createFakeProcessRunner()
    runner.script({
      chunks: [{ stream: 'stdout', data: 'never seen\n' }],
      code: 0,
      delayMs: 50
    })

    const handle = runner.run('long-running', [])
    handle.kill('SIGKILL')

    await expect(handle.exitCode).resolves.toEqual({ code: null, signal: 'SIGKILL' })
    expect(await collect(handle.output)).toEqual([])
  })
})

describe('ProcessRunner — real child_process-backed runner', () => {
  it('streams real stdout from a real child process and reports a real exit code', async () => {
    const runner = createProcessRunner()
    const handle = runner.run(process.execPath, ['-e', "console.log('hi from child')"])

    const chunks = await collect(handle.output)
    const stdout = chunks
      .filter((c) => c.stream === 'stdout')
      .map((c) => c.data)
      .join('')

    expect(stdout).toContain('hi from child')
    await expect(handle.exitCode).resolves.toEqual({ code: 0, signal: null })
  })

  it('captures real stderr separately from stdout', async () => {
    const runner = createProcessRunner()
    const handle = runner.run(process.execPath, [
      '-e',
      "console.error('oops'); process.exitCode = 3"
    ])

    const chunks = await collect(handle.output)
    const stderr = chunks
      .filter((c) => c.stream === 'stderr')
      .map((c) => c.data)
      .join('')

    expect(stderr).toContain('oops')
    await expect(handle.exitCode).resolves.toEqual({ code: 3, signal: null })
  })

  it('kill() terminates a long-running real process early instead of waiting it out', async () => {
    const runner = createProcessRunner()
    // A process that would otherwise run far longer than this test's patience.
    const handle = runner.run(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'])

    const start = Date.now()
    setTimeout(() => handle.kill(), 100)

    const result = await handle.exitCode
    const elapsedMs = Date.now() - start

    // Killed well before the 5s the child would otherwise have waited.
    expect(elapsedMs).toBeLessThan(4000)
    // Killed via SIGTERM: no normal exit code, signal reflects the kill.
    expect(result.code).toBeNull()
    expect(result.signal).toBe('SIGTERM')
  }, 10000)

  it('respects a custom cwd', async () => {
    const runner = createProcessRunner()
    const handle = runner.run(process.execPath, ['-e', 'console.log(process.cwd())'], {
      cwd: '/tmp'
    })

    const chunks = await collect(handle.output)
    const stdout = chunks.map((c) => c.data).join('')
    await handle.exitCode

    // macOS resolves /tmp to /private/tmp; just assert the leaf segment.
    expect(stdout.trim().endsWith('tmp')).toBe(true)
  })
})
