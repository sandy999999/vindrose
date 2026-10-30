import { describe, it, expect } from 'vitest'
import { eventTarget } from '../src/lib/audio/engine'
import { rainBurstCount } from '../src/lib/audio/channels/rain'

describe('eventTarget', () => {
  it('sends every event type to the channel that plays it', () => {
    expect(eventTarget({ type: 'gust-burst', strength: 0.5 })).toBe('gust')
    expect(eventTarget({ type: 'pressure-glide', direction: 'down' })).toBe('pressure')
    expect(eventTarget({ type: 'rain-change', state: 'rain' })).toBe('rain')
    expect(eventTarget({ type: 'direction-sweep', pan: 0.4 })).toBe('wind')
    expect(eventTarget({ type: 'temperature-note', note: 64 })).toBe('motif')
  })
})

describe('rainBurstCount', () => {
  it('makes a heavier rain change a bigger burst and a dry one silent', () => {
    expect(rainBurstCount('dry')).toBe(0)
    expect(rainBurstCount('drizzle')).toBeGreaterThan(0)
    expect(rainBurstCount('drizzle')).toBeLessThan(rainBurstCount('rain'))
    expect(rainBurstCount('rain')).toBeLessThan(rainBurstCount('heavy'))
  })
})
