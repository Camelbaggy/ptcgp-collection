import { describe, expect, it } from 'vitest'
import { inflatePzPayload, PZ_MAX_INFLATED } from './pzCollection'

async function pack(text: string): Promise<string> {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const bytes = new Uint8Array(await new Response(s).arrayBuffer())
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('inflatePzPayload', () => {
  it('round-trips a normal payload', async () => {
    expect(await inflatePzPayload(await pack('{"v":2}'))).toBe('{"v":2}')
  })
  it('refuses a decompression bomb', async () => {
    const bomb = await pack('a'.repeat(PZ_MAX_INFLATED + 1024))
    await expect(inflatePzPayload(bomb)).rejects.toThrow(/volumineuses/)
  })
})
