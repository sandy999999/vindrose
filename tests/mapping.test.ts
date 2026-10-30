import { describe, it, expect } from 'vitest'
import { mapWeather } from '../src/lib/domain/mapping'
import { placeProfile } from '../src/lib/domain/place'
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

const profile = placeProfile(58.11, 11.32)

describe('mapWeather', () => {
  it('maps stillness to silence and full wind to full level', () => {
    expect(mapWeather(zeroReading, profile, 0).wind.level).toBe(0)
    expect(mapWeather(maxReading, profile, 0).wind.level).toBe(1)
  })

  it('maps rain density to full level at ten mm per hour', () => {
    expect(mapWeather(maxReading, profile, 0).rain.level).toBe(1)
    expect(mapWeather(zeroReading, profile, 0).rain.density).toBe(0)
  })

  it('maps a clear sky to the dry reverb and overcast to the wet one', () => {
    expect(mapWeather({ ...calmReading, cloudCover: 0 }, profile, 0).reverb.wet).toBe(0.15)
    expect(mapWeather(overcastReading, profile, 0).reverb.wet).toBeCloseTo(0.65)
  })

  it('keeps the pipe at a constant level', () => {
    expect(mapWeather(zeroReading, profile, 0).pressure.level).toBe(0.35)
    expect(mapWeather(maxReading, profile, 0).pressure.level).toBe(0.35)
  })

  it('maps wind direction to stereo pan symmetrically', () => {
    expect(mapWeather({ ...calmReading, windDirection: 90 }, profile, 0).wind.pan).toBeCloseTo(0.8)
    expect(mapWeather({ ...calmReading, windDirection: 270 }, profile, 0).wind.pan).toBeCloseTo(-0.8)
    expect(mapWeather({ ...calmReading, windDirection: 0 }, profile, 0).wind.pan).toBeCloseTo(0)
  })

  it('derives the aeolian tone from speed and aperture', () => {
    const wide = { ...placeProfile(58.1, 11.3), aperture: 0.004 }
    const targets = mapWeather({ ...calmReading, windSpeed: 10 }, wide, 0)
    expect(targets.wind.freq).toBeCloseTo((0.2 * 10) / 0.004)
    expect(targets.wind.q).toBeGreaterThanOrEqual(8)
    expect(targets.wind.q).toBeLessThanOrEqual(38)
  })

  it('clamps the aeolian tone to 80 to 2000 Hz', () => {
    const narrow = { ...placeProfile(58.1, 11.3), aperture: 0.002 }
    expect(mapWeather({ ...calmReading, windSpeed: 0.1 }, narrow, 0).wind.freq).toBe(80)
    expect(mapWeather({ ...calmReading, windSpeed: 40 }, narrow, 0).wind.freq).toBe(2000)
  })

  it('maps pressure onto the pipe and snaps it to the mode', () => {
    const at = placeProfile(58.1, 11.3)
    const low = mapWeather({ ...calmReading, pressure: 980 }, at, 0).pressure.targetHz
    const high = mapWeather({ ...calmReading, pressure: 1030 }, at, 0).pressure.targetHz
    expect(low).toBeLessThan(high)
    expect(low).toBeGreaterThanOrEqual(50)
    expect(high).toBeLessThanOrEqual(120)
  })

  it('advances the pad through the chord cycle every eight bars', () => {
    const at = { ...placeProfile(58.1, 11.3), tempo: 60 }
    const bar = 4
    expect(mapWeather(calmReading, at, 0).pad.degree).toBe(0)
    expect(mapWeather(calmReading, at, 8 * bar).pad.degree).toBe(5)
    expect(mapWeather(calmReading, at, 16 * bar).pad.degree).toBe(3)
    expect(mapWeather(calmReading, at, 24 * bar).pad.degree).toBe(4)
  })
})
