import type { WeatherReading } from '../domain/types'

export type WeatherErrorCode = 'network' | 'parse' | 'http'

export class WeatherError extends Error {
  readonly code: WeatherErrorCode

  constructor(code: WeatherErrorCode, message: string) {
    super(message)
    this.name = 'WeatherError'
    this.code = code
  }
}

export interface WeatherSnapshot {
  reading: WeatherReading
  pressureTendency: number
}

interface OpenMeteoCurrent {
  time: string
  temperature_2m: number
  relative_humidity_2m: number
  precipitation: number
  weather_code: number
  cloud_cover: number
  pressure_msl: number
  wind_speed_10m: number
  wind_direction_10m: number
  wind_gusts_10m: number
}

interface OpenMeteoResponse {
  current: OpenMeteoCurrent
  hourly: { time: string[]; pressure_msl: number[] }
}

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
].join(',')

function isResponse(value: unknown): value is OpenMeteoResponse {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const current = record.current
  const hourly = record.hourly
  if (typeof current !== 'object' || current === null) return false
  if (typeof hourly !== 'object' || hourly === null) return false
  const hour = hourly as Record<string, unknown>
  return Array.isArray(hour.time) && Array.isArray(hour.pressure_msl)
}

function parse(body: OpenMeteoResponse): WeatherSnapshot {
  const current = body.current
  const times = body.hourly.time
  const pressures = body.hourly.pressure_msl

  let tendency = 0
  if (times.length >= 4 && pressures.length >= 4) {
    const found = times.indexOf(current.time)
    const index = found === -1 ? times.length - 1 : found
    const before = pressures[index - 3]
    if (typeof before === 'number') {
      tendency = current.pressure_msl - before
    }
  }

  return {
    pressureTendency: tendency,
    reading: {
      time: current.time,
      windSpeed: current.wind_speed_10m,
      windGust: current.wind_gusts_10m,
      windDirection: current.wind_direction_10m,
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      pressure: current.pressure_msl,
      precipitation: current.precipitation,
      cloudCover: current.cloud_cover,
      weatherCode: current.weather_code,
    },
  }
}

export async function fetchWeather(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<WeatherSnapshot> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))
  url.searchParams.set('current', CURRENT_FIELDS)
  url.searchParams.set('hourly', 'pressure_msl')
  url.searchParams.set('past_days', '1')
  url.searchParams.set('timezone', 'auto')

  let response: Response
  try {
    response = await fetchImpl(url)
  } catch (error) {
    throw new WeatherError('network', `Weather request failed: ${String(error)}`)
  }

  if (!response.ok) {
    throw new WeatherError('http', `Weather request returned ${response.status}`)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new WeatherError('parse', 'Weather response was not json')
  }

  if (!isResponse(body)) {
    throw new WeatherError('parse', 'Weather response had an unexpected shape')
  }

  return parse(body)
}

export async function fetchElevation(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
  const url = new URL('https://api.open-meteo.com/v1/elevation')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lon))

  try {
    const response = await fetchImpl(url)
    if (!response.ok) return null
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null) return null
    const elevations = (body as Record<string, unknown>).elevation
    if (!Array.isArray(elevations)) return null
    const first: unknown = elevations[0]
    return typeof first === 'number' && Number.isFinite(first) ? first : null
  } catch {
    return null
  }
}
