import type { ProcessHandle, ProcessRunner, ProcessStreamChunk, RunOptions } from './processRunner'

/**
 * A minimal push/pull queue — the same shape `processRunner` uses internally,
 * reimplemented here rather than exported from there so a test-only helper
 * does not widen a production module's public surface.
 */
function createChunkQueue(): AsyncIterable<ProcessStreamChunk> & {
  push(chunk: ProcessStreamChunk): void
  end(): void
} {
  const buffered: ProcessStreamChunk[] = []
  const waiting: ((result: IteratorResult<ProcessStreamChunk>) => void)[] = []
  let done = false
  return {
    push(chunk) {
      if (done) return
      const next = waiting.shift()
      if (next) next({ value: chunk, done: false })
      else buffered.push(chunk)
    },
    end() {
      done = true
      let next = waiting.shift()
      while (next) {
        next({ value: undefined as never, done: true })
        next = waiting.shift()
      }
    },
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<ProcessStreamChunk>> {
          const buffered_ = buffered.shift()
          if (buffered_) return Promise.resolve({ value: buffered_, done: false })
          if (done) return Promise.resolve({ value: undefined as never, done: true })
          return new Promise((resolve) => waiting.push(resolve))
        }
      }
    }
  }
}

/**
 * A fake `ProcessRunner` that answers ACP over the stdin pipe.
 *
 * The shared `createFakeProcessRunner` scripts a process's *output* ahead of
 * time, which is exactly right for a one-shot CLI and useless for a protocol:
 * an ACP agent's every write is a reply to something the client just sent, and
 * canned chunks cannot correlate a response id with a request that hasn't
 * happened yet. So this fake is driven the other way round — a handler reads
 * each inbound JSON-RPC message and decides what to emit.
 *
 * Not in `processRunner.ts` because nothing outside the ACP tests wants it,
 * and that module's fake is already the general one.
 */
export interface AcpTestServer extends ProcessRunner {
  /** Every message the client has written, decoded, in order. */
  readonly received: Record<string, unknown>[]
  /** Pushes a raw line onto the agent's stdout (used for framing tests). */
  emitRaw(line: string): void
  /** Sends one `session/update` notification. */
  emitUpdate(update: Record<string, unknown>): void
  /** Sends an arbitrary JSON-RPC message from the agent. */
  emit(message: Record<string, unknown>): void
  /** Ends the agent's output stream and settles its exit. */
  exit(code?: number): void
  /** The options the process was started with. */
  readonly startOptions: RunOptions | undefined
}

/** What the server does with one inbound request; returns the `result`. */
export type AcpTestHandler = (
  method: string,
  params: unknown,
  server: AcpTestServer
) => unknown | undefined

export function createAcpTestServer(handler: AcpTestHandler = () => ({})): AcpTestServer {
  const queue = createChunkQueue()
  const received: Record<string, unknown>[] = []
  let resolveExit: (result: { code: number | null; signal: null }) => void = () => {}
  const exitCode = new Promise<{ code: number | null; signal: null }>((resolve) => {
    resolveExit = resolve
  })
  let startOptions: RunOptions | undefined
  let ended = false

  const emit = (message: Record<string, unknown>): void => {
    queue.push({ stream: 'stdout', data: `${JSON.stringify(message)}\n` })
  }

  const server: AcpTestServer = {
    received,
    get startOptions() {
      return startOptions
    },
    emit,
    emitRaw(line: string) {
      queue.push({ stream: 'stdout', data: line })
    },
    emitUpdate(update: Record<string, unknown>) {
      emit({ jsonrpc: '2.0', method: 'session/update', params: { update } })
    },
    exit(code = 0) {
      if (ended) return
      ended = true
      queue.end()
      resolveExit({ code, signal: null })
    },
    run(_command: string, _args: string[], opts?: RunOptions): ProcessHandle {
      startOptions = opts
      return {
        output: queue,
        exitCode,
        kill: () => server.exit(null as unknown as number),
        write(chunk: string): boolean {
          for (const line of chunk.split('\n')) {
            if (line.trim() === '') continue
            const message = JSON.parse(line) as Record<string, unknown>
            received.push(message)
            const id = message.id
            const method = message.method
            if (typeof method !== 'string') continue
            const result = handler(method, message.params, server)
            // A notification (no id) is never answered; a handler that returns
            // `undefined` is declining to answer *this* request, which is how a
            // test simulates an agent that goes quiet.
            if (id !== undefined && result !== undefined) {
              emit({ jsonrpc: '2.0', id: id as number, result })
            }
          }
          return true
        }
      }
    }
  }
  return server
}
