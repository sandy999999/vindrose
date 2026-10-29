import { describe, it, expect } from 'vitest'
import { fetchWeather, WeatherError } from '../src/lib/weather/openMeteo'

const payload = {
  current: {
    time: '2026-10-29T12:00',
    temperature_2m: 7.1,
    relative_humidity_2m: 87,
    precipitation: 2.4,
    weather_code: 61,
    cloud_cover: 100,
    pressure_msl: 1008.6,
    wind_speed_10m: 9.2,
    wind_direction_10m: 240,
    wind_gusts_10m: 14.8,
  },
  hourly: {
    time: [
      '2026-10-29T08:00',
      '2026-10-29T09:00',
      '2026-10-29T10:00',
      '2026-10-29T11:00',
      '2026-10-29T12:00',
    ],
    pressure_msl: [1010, 1009.5, 1009.5, 1009.1, 1008.6],
  },
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('fetchWeather', () => {
  it('maps the current block into a reading', async () => {
    const result = await fetchWeather(58.11, 11.32, async () => jsonResponse(payload))
    expect(result.reading).toMatchObject({
      time: '2026-10-29T12:00',
      windSpeed: 9.2,
      windGust: 14.8,
      windDirection: 240,
      temperature: 7.1,
      humidity: 87,
      pressure: 1008.6,
      precipitation: 2.4,
      cloudCover: 100,
      weatherCode: 61,
    })
  })

  it('computes the three hour pressure tendency', async () => {
    const result = await fetchWeather(58.11, 11.32, async () => jsonResponse(payload))
    expect(result.pressureTendency).toBeCloseTo(-0.9)
  })

  it('refuses a network failure with a typed error', async () => {
    const failing = async (): Promise<Response> => {
      throw new TypeError('offline')
    }
    await expect(fetchWeather(0, 0, failing)).rejects.toMatchObject({
      name: 'WeatherError',
      code: 'network',
    })
  })

  it('refuses a non ok response', async () => {
    await expect(fetchWeather(0, 0, async () => jsonResponse({}, 500))).rejects.toBeInstanceOf(
      WeatherError,
    )
  })

  it('refuses unreadable json', async () => {
    const broken = async (): Promise<Response> => new Response('<html>', { status: 200 })
    await expect(fetchWeather(0, 0, broken)).rejects.toMatchObject({ code: 'parse' })
  })
})
