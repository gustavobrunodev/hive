import { describe, expect, it } from 'vitest'
import { join } from 'path'
import {
  resolveWhisperRequest,
  WHISPER_SCHEME,
  WHISPER_SCHEME_PRIVILEGES,
  type WhisperProtocolRoots
} from './whisperProtocol'

const roots: WhisperProtocolRoots = { models: join('/data', 'whisper-models') }

describe('whisperProtocol', () => {
  describe('scheme privileges (T2 spike corrections)', () => {
    it('is CORS-enabled — without it a file:// renderer cannot fetch the scheme at all', () => {
      expect(WHISPER_SCHEME_PRIVILEGES.privileges.corsEnabled).toBe(true)
    })

    it('is a standard, secure, fetchable, streaming scheme that does NOT bypass CSP', () => {
      const { privileges, scheme } = WHISPER_SCHEME_PRIVILEGES
      expect(scheme).toBe(WHISPER_SCHEME)
      expect(privileges.standard).toBe(true)
      expect(privileges.secure).toBe(true)
      expect(privileges.supportFetchAPI).toBe(true)
      expect(privileges.stream).toBe(true)
      expect(privileges.bypassCSP).toBe(false)
    })
  })

  describe('resolveWhisperRequest', () => {
    it('resolves host=models + pathname to a file under the models root', () => {
      expect(
        resolveWhisperRequest(roots, 'hive-model://models/Xenova/whisper-base/config.json')
      ).toBe(join(roots.models, 'Xenova/whisper-base/config.json'))
    })

    it('resolves a nested onnx weight file', () => {
      expect(
        resolveWhisperRequest(
          roots,
          'hive-model://models/Xenova/whisper-base/onnx/encoder_model.onnx'
        )
      ).toBe(join(roots.models, 'Xenova/whisper-base/onnx/encoder_model.onnx'))
    })

    it('percent-decodes the path', () => {
      expect(resolveWhisperRequest(roots, 'hive-model://models/a%20b/c.json')).toBe(
        join(roots.models, 'a b/c.json')
      )
    })

    it('refuses an unknown host (only declared store roots are addressable)', () => {
      expect(resolveWhisperRequest(roots, 'hive-model://secrets/id_rsa')).toBeNull()
      expect(resolveWhisperRequest(roots, 'hive-model://ort/ort-wasm.wasm')).toBeNull()
    })

    // Two distinct traversal shapes, neutralized at two different layers.
    it('neutralizes literal ../ — the URL parser normalizes it away, so it stays in-root', () => {
      // `new URL()` resolves `..` at parse time for a standard scheme, so the
      // request never escapes; it just lands on a (non-existent) in-root path.
      expect(resolveWhisperRequest(roots, 'hive-model://models/../../etc/passwd')).toBe(
        join(roots.models, 'etc/passwd')
      )
    })

    it('refuses percent-encoded traversal, which survives URL parsing (path-escape guard)', () => {
      // `%2e%2e%2f` is opaque to the parser and only becomes `../` after
      // decoding — this is the shape the explicit guard exists for.
      expect(
        resolveWhisperRequest(roots, 'hive-model://models/%2e%2e%2f%2e%2e%2fetc/passwd')
      ).toBeNull()
      expect(
        resolveWhisperRequest(roots, 'hive-model://models/a/%2e%2e%2f%2e%2e%2f%2e%2e%2fx')
      ).toBeNull()
    })

    it('refuses an empty path (the root itself is not a file)', () => {
      expect(resolveWhisperRequest(roots, 'hive-model://models/')).toBeNull()
      expect(resolveWhisperRequest(roots, 'hive-model://models')).toBeNull()
    })

    it('refuses another scheme, even for a valid-looking path', () => {
      expect(resolveWhisperRequest(roots, 'file:///data/whisper-models/x.json')).toBeNull()
      expect(resolveWhisperRequest(roots, 'https://models/x.json')).toBeNull()
    })

    it('refuses an unparseable URL or malformed percent-encoding', () => {
      expect(resolveWhisperRequest(roots, 'not a url')).toBeNull()
      expect(resolveWhisperRequest(roots, 'hive-model://models/%E0%A4%A')).toBeNull()
    })

    it('allows a root given with a trailing separator', () => {
      const trailing: WhisperProtocolRoots = { models: join('/data', 'whisper-models') + '/' }
      expect(resolveWhisperRequest(trailing, 'hive-model://models/x.json')).toBe(
        join('/data/whisper-models', 'x.json')
      )
    })
  })
})
