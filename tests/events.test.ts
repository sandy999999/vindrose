import { describe, it, expect } from 'vitest'
import { detectEvents, freshEventState } from '../src/lib/domain/events'
import type { WeatherReading } from '../src/lib/domain/types'

const calm: WeatherReading = {
  time: '2026-10-29T12:00',
  windSpeed: 3,
  windGust: 3,
  windDirection: 180,
  temperature: 7,
  humidity: 80,
  pressure: 1010,
  precipitation: 0,
  cloudCover: 50,
  weatherCode: 1,
}

const windy: WeatherReading = { ...calm, windGust: 12 }

describe('detectEvents', () => {
  it('fires nothing on the first reading', () => {
    expect(detectEvents(null, calm, 0, 1000, freshEventState())).toEqual([])
  })

  it('fires a gust burst when the spread crosses six metres per second', () => {
    const events = detectEvents(calm, windy, 0, 2000, freshEventState())
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'gust-burst' })
  })

  it('rate limits the same event type to one per 1.5 seconds', () => {
    const state = freshEventState()
    detectEvents(calm, windy, 0, 2000, state)
    expect(detectEvents(calm, windy, 0, 2001, state)).toEqual([])
    expect(detectEvents(calm, windy, 0, 3601, state)).toHaveLength(1)
  })

  it('fires a rain change when the state band changes', () => {
    const state = freshEventState()
    detectEvents(null, calm, 0, 1000, state)
    const wet = { ...calm, precipitation: 2 }
    expect(detectEvents(calm, wet, 0, 2000, state)).toEqual([
      { type: 'rain-change', state: 'rain' },
    ])
  })

  it('fires a pressure glide on a steep fall', () => {
    const state = freshEventState()
    detectEvents(null, calm, 0, 1000, state)
    expect(detectEvents(calm, calm, -3, 2000, state)).toEqual([
      { type: 'pressure-glide', direction: 'down' },
    ])
  })
})
