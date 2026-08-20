import { describe, expect, it } from 'vitest'
import { join } from 'path'
import {
  resolveWhisperCandidates,
  resolveWhisperRequest,
  whisperFileHeaders,
  WHISPER_SCHEME,
  WHISPER_SCHEME_PRIVILEGES,
  type WhisperProtocolRoots
} from './whisperProtocol'

const MODELS_ROOT = join('/data', 'whisper-models')
const BUNDLED_ROOT = join('/app', 'resources', 'whisper-models')
const roots: WhisperProtocolRoots = { models: MODELS_ROOT }

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
      ).toBe(join(MODELS_ROOT, 'Xenova/whisper-base/config.json'))
    })

    it('resolves a nested onnx weight file', () => {
      expect(
        resolveWhisperRequest(
          roots,
          'hive-model://models/Xenova/whisper-base/onnx/encoder_model.onnx'
        )
      ).toBe(join(MODELS_ROOT, 'Xenova/whisper-base/onnx/encoder_model.onnx'))
    })

    it('percent-decodes the path', () => {
      expect(resolveWhisperRequest(roots, 'hive-model://models/a%20b/c.json')).toBe(
        join(MODELS_ROOT, 'a b/c.json')
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
        join(MODELS_ROOT, 'etc/passwd')
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

  /**
   * Bundled weights (D-SB-8) reach the renderer through the very same scheme,
   * which is what lets `tiny`/`base`/`small` work with nothing downloaded. The
   * search path is the whole mechanism, so the guard is asserted per root: a
   * second root must widen what can be *served*, never where a crafted path can
   * *reach*.
   */
  describe('resolveWhisperCandidates (search path)', () => {
    const searched: WhisperProtocolRoots = { models: [MODELS_ROOT, BUNDLED_ROOT] }

    it('offers the downloaded copy first and the bundled copy second', () => {
      expect(resolveWhisperCandidates(searched, 'hive-model://models/base/config.json')).toEqual([
        join(MODELS_ROOT, 'base/config.json'),
        join(BUNDLED_ROOT, 'base/config.json')
      ])
    })

    it('applies the path-escape guard to every root, not just the first', () => {
      expect(
        resolveWhisperCandidates(searched, 'hive-model://models/%2e%2e%2f%2e%2e%2fetc/passwd')
      ).toEqual([])
    })

    it('refuses an unknown host however many roots are configured', () => {
      expect(resolveWhisperCandidates(searched, 'hive-model://secrets/id_rsa')).toEqual([])
    })

    it('treats an empty search path as no root at all', () => {
      expect(resolveWhisperCandidates({ models: [] }, 'hive-model://models/x.json')).toEqual([])
    })

    it('resolveWhisperRequest keeps answering with the highest-priority root', () => {
      expect(resolveWhisperRequest(searched, 'hive-model://models/base/config.json')).toBe(
        join(MODELS_ROOT, 'base/config.json')
      )
    })
  })

  /**
   * `net.fetch(file://…)` answers without a `Content-Length`, and Transformers.js
   * reacts to a missing one by reading the body into a buffer it keeps growing.
   * On the 208 MB fp32 decoder that turned a ~20 s model load into minutes of
   * apparent hang — the reason transcription looked broken. The header is the
   * fix, so it is pinned here.
   */
  describe('whisperFileHeaders', () => {
    it('always states the byte length', () => {
      expect(whisperFileHeaders('/m/onnx/decoder.onnx', 208560983)['content-length']).toBe(
        '208560983'
      )
    })

    it('states a zero length rather than omitting the header', () => {
      expect(whisperFileHeaders('/m/empty.onnx', 0)['content-length']).toBe('0')
    })

    it('types the model metadata as JSON', () => {
      expect(whisperFileHeaders('/m/config.json', 10)['content-type']).toBe('application/json')
    })

    it('types the merges/vocab text files as text', () => {
      expect(whisperFileHeaders('/m/merges.txt', 10)['content-type']).toBe('text/plain')
    })

    it('leaves weights as opaque bytes', () => {
      expect(whisperFileHeaders('/m/onnx/encoder_model.onnx', 10)['content-type']).toBe(
        'application/octet-stream'
      )
      expect(whisperFileHeaders('/m/onnx/encoder_model.onnx_data', 10)['content-type']).toBe(
        'application/octet-stream'
      )
    })
  })
})
