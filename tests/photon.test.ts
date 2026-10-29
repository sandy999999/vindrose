import { describe, it, expect } from 'vitest'
import { searchPlaces, reversePlace } from '../src/lib/weather/photon'

const results = {
  features: [
    {
      properties: { name: 'Käringön', country: 'Sweden' },
      geometry: { coordinates: [11.32, 58.11] },
    },
    {
      properties: { city: 'Oslo', country: 'Norway' },
      geometry: { coordinates: [10.75, 59.91] },
    },
    {
      properties: { country: 'Norway' },
      geometry: { coordinates: [5.04, 60.02] },
    },
  ],
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('searchPlaces', () => {
  it('prefers name, then city, then coordinates', async () => {
    const places = await searchPlaces('karing', undefined, async () => jsonResponse(results))
    expect(places.map((place) => place.name)).toEqual(['Käringön', 'Oslo', '60.0,5.0'])
  })

  it('keeps coordinates as numbers', async () => {
    const places = await searchPlaces('oslo', undefined, async () => jsonResponse(results))
    expect(places[1]).toMatchObject({ lat: 59.91, lon: 10.75, country: 'Norway' })
  })

  it('returns an empty list for no features', async () => {
    const places = await searchPlaces('nowhere', undefined, async () =>
      jsonResponse({ features: [] }),
    )
    expect(places).toEqual([])
  })
})

describe('reversePlace', () => {
  it('returns the first feature', async () => {
    const place = await reversePlace(58.11, 11.32, async () => jsonResponse(results))
    expect(place).toMatchObject({ name: 'Käringön', lat: 58.11, lon: 11.32 })
  })

  it('returns null when nothing matches', async () => {
    const place = await reversePlace(0, 0, async () => jsonResponse({ features: [] }))
    expect(place).toBeNull()
  })
})
