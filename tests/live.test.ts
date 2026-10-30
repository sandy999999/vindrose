import { describe, it, expect, vi, afterEach } from 'vitest'
import { getSession } from '../src/lib/stores/live'

describe('getSession', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks Open-Meteo for the elevation of a selected place', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (input: unknown) => {
      const url = String(input)
      calls.push(url)
      if (url.includes('/v1/elevation')) {
        return new Response(JSON.stringify({ elevation: [1200] }), { status: 200 })
      }
      return new Response('{}', { status: 500 })
    })

    const session = getSession()
    await session.selectPlace({ name: 'Käringön', lat: 58.11, lon: 11.32, country: 'Sweden' })

    expect(calls.some((url) => url.includes('/v1/elevation'))).toBe(true)
  })
})
