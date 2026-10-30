import { describe, it, expect } from 'vitest'
import { fetchElevation, fetchWeather, WeatherError } from '../src/lib/weather/openMeteo'

const payload = {
  current: {
    time: '2026-10-29T12:00',
    interval: 900,
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
      precipitation: 9.6,
      cloudCover: 100,
      weatherCode: 61,
    })
  })

  it('asks for wind in metres per second', async () => {
    let called = ''
    const fetchImpl = (async (url: URL | RequestInfo) => {
      called = String(url)
      return jsonResponse(payload)
    }) as typeof fetch
    await fetchWeather(58.11, 11.32, fetchImpl)
    expect(new URL(called).searchParams.get('wind_speed_unit')).toBe('ms')
  })

  it('converts the 15 minute precipitation interval to an hourly rate', async () => {
    const hourly = {
      ...payload,
      current: { ...payload.current, interval: 3600, precipitation: 2.4 },
    }
    const result = await fetchWeather(58.11, 11.32, async () => jsonResponse(hourly))
    expect(result.reading.precipitation).toBeCloseTo(2.4)
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

describe('fetchElevation', () => {
  it('reads the first elevation from the keyless endpoint', async () => {
    let called = ''
    const fetchImpl = (async (url: URL | RequestInfo) => {
      called = String(url)
      return new Response(JSON.stringify({ elevation: [12.4] }), { status: 200 })
    }) as typeof fetch
    await expect(fetchElevation(58.11, 11.32, fetchImpl)).resolves.toBe(12.4)
    expect(called).toContain('/v1/elevation')
    expect(called).toContain('latitude=58.11')
  })

  it('returns null on a bad response instead of throwing', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 500 })) as typeof fetch
    await expect(fetchElevation(1, 2, fetchImpl)).resolves.toBeNull()
    const broken = (async () => { throw new Error('offline') }) as typeof fetch
    await expect(fetchElevation(1, 2, broken)).resolves.toBeNull()
  })
})
