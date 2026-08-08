import { vi, type Mock } from 'vitest'

/** Each MCP-console bridge method as a vitest `Mock`, so tests can override per method. */
export type HiveMcpLogsMock = Record<keyof Window['hive']['mcpLogs'], Mock>

/**
 * A fully-stubbed `window.hive.mcpLogs` namespace (mcp-logs) for tests that
 * mount UI reading `window.hive` but don't drive the MCP console: no servers,
 * no history, and a no-op live tail whose unsubscribe is a real function (the
 * console calls it on unmount, so returning `undefined` here would throw).
 * Tests that DO drive the console override the methods they need.
 */
export function createHiveMcpLogsMock(): HiveMcpLogsMock {
  return {
    sources: vi.fn().mockResolvedValue([]),
    read: vi.fn().mockResolvedValue([]),
    openDir: vi.fn().mockResolvedValue(undefined),
    watch: vi.fn().mockReturnValue(() => {})
  }
}
