import { describe, it, expect } from 'vitest'
import { mapWeather } from '../src/lib/domain/mapping'
import type { WeatherReading } from '../src/lib/domain/types'

const zeroReading: WeatherReading = {
  time: '2026-10-29T12:00',
  windSpeed: 0,
  windGust: 0,
  windDirection: 0,
  temperature: 0,
  humidity: 0,
  pressure: 1013,
  precipitation: 0,
  cloudCover: 0,
  weatherCode: 0,
}

const calmReading: WeatherReading = { ...zeroReading, windSpeed: 3, windGust: 3 }
const overcastReading: WeatherReading = { ...zeroReading, cloudCover: 100 }

const maxReading: WeatherReading = {
  ...zeroReading,
  windSpeed: 25,
  windGust: 25,
  windDirection: 90,
  temperature: 30,
  humidity: 100,
  pressure: 1038,
  precipitation: 10,
  cloudCover: 100,
}

describe('mapWeather', () => {
  it('maps stillness to silence and full wind to full level', () => {
    expect(mapWeather(zeroReading, 0).wind.level).toBe(0)
    expect(mapWeather(maxReading, 0).wind.level).toBe(1)
  })

  it('maps rain density to full level at ten mm per hour', () => {
    expect(mapWeather(maxReading, 0).rain.level).toBe(1)
    expect(mapWeather(zeroReading, 0).rain.density).toBe(0)
  })

  it('maps a clear sky to the dry reverb and overcast to the wet one', () => {
    expect(mapWeather({ ...calmReading, cloudCover: 0 }, 0).reverb.wet).toBe(0.15)
    expect(mapWeather(overcastReading, 0).reverb.wet).toBeCloseTo(0.65)
  })

  it('keeps the drone at a constant level', () => {
    expect(mapWeather(zeroReading, 0).pressure.level).toBe(0.5)
    expect(mapWeather(maxReading, 0).pressure.level).toBe(0.5)
  })

  it('maps wind direction to stereo pan symmetrically', () => {
    expect(mapWeather({ ...calmReading, windDirection: 90 }, 0).wind.pan).toBeCloseTo(0.8)
    expect(mapWeather({ ...calmReading, windDirection: 270 }, 0).wind.pan).toBeCloseTo(-0.8)
    expect(mapWeather({ ...calmReading, windDirection: 0 }, 0).wind.pan).toBeCloseTo(0)
  })
})
