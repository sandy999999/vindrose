import type { WeatherReading } from './types'
import { clamp } from './units'
import { quantizeToScale } from './harmony'

export type RainState = 'dry' | 'drizzle' | 'rain' | 'heavy'

export type AudioEvent =
  | { type: 'gust-burst'; strength: number }
  | { type: 'pressure-glide'; direction: 'down' | 'up' }
  | { type: 'rain-change'; state: RainState }
  | { type: 'direction-sweep'; pan: number }
  | { type: 'temperature-note'; note: number }

export interface EventState {
  last: Record<string, number>
  rain: RainState | null
}

export const RATE_LIMIT_MS = 1500

export function freshEventState(): EventState {
  return { last: {}, rain: null }
}

export function rainState(precipitation: number): RainState {
  if (precipitation < 0.1) return 'dry'
  if (precipitation < 1) return 'drizzle'
  if (precipitation < 4) return 'rain'
  return 'heavy'
}

export function detectEvents(
  prev: WeatherReading | null,
  next: WeatherReading,
  tendency: number,
  nowMs: number,
  state: EventState,
): AudioEvent[] {
  if (prev === null) {
    state.rain = rainState(next.precipitation)
    return []
  }

  const events: AudioEvent[] = []
  const allowed = (key: string): boolean =>
    nowMs - (state.last[key] ?? Number.NEGATIVE_INFINITY) >= RATE_LIMIT_MS
  const mark = (key: string): void => {
    state.last[key] = nowMs
  }

  const spreadNext = next.windGust - next.windSpeed
  const spreadPrev = prev.windGust - prev.windSpeed

  if (spreadNext > 6 && spreadPrev <= 6 && allowed('gust-burst')) {
    events.push({ type: 'gust-burst', strength: clamp(spreadNext / 15, 0, 1) })
    mark('gust-burst')
  }

  if (tendency < -2 && allowed('pressure-glide')) {
    events.push({ type: 'pressure-glide', direction: 'down' })
    mark('pressure-glide')
  }

  const nextRain = rainState(next.precipitation)
  if (state.rain !== null && nextRain !== state.rain && allowed('rain-change')) {
    events.push({ type: 'rain-change', state: nextRain })
    mark('rain-change')
  }
  state.rain = nextRain

  if (
    Math.floor(next.windDirection / 45) !== Math.floor(prev.windDirection / 45) &&
    allowed('direction-sweep')
  ) {
    events.push({
      type: 'direction-sweep',
      pan: Math.sin((next.windDirection * Math.PI) / 180) * 0.8,
    })
    mark('direction-sweep')
  }

  if (
    Math.round(next.temperature) !== Math.round(prev.temperature) &&
    allowed('temperature-note')
  ) {
    events.push({
      type: 'temperature-note',
      note: quantizeToScale(60 + Math.round(next.temperature)),
    })
    mark('temperature-note')
  }

  return events
}
