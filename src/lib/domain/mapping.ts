import { BARS_PER_PHRASE, barDuration } from '../audio/scheduler'
import { snapHzToMode } from './harmony'
import { basePitch } from './materials'
import type { PlaceProfile } from './place'
import type { WeatherReading } from './types'
import { clamp, norm } from './units'

export interface ChannelTargets {
  wind: { level: number; freq: number; q: number; pan: number; breath: number }
  rain: { level: number; density: number; basePitch: number }
  gust: { level: number }
  pressure: { level: number; targetHz: number }
  thunder: { level: number }
  pad: { level: number; cutoff: number; degree: number }
  motif: { level: number; register: number }
  reverb: { wet: number; preDelay: number }
}

const PAD_CYCLE = [0, 5, 3, 4]

export function mapWeather(
  reading: WeatherReading,
  profile: PlaceProfile,
  elapsedSec: number,
): ChannelTargets {
  const wind = norm(reading.windSpeed, 0, 25)
  const humidity = norm(reading.humidity, 0, 100)
  const temperature = norm(reading.temperature, -20, 30)
  const cloud = norm(reading.cloudCover, 0, 100)
  const rain = norm(reading.precipitation, 0, 10)
  const phrase = Math.floor(elapsedSec / (barDuration(profile.tempo) * BARS_PER_PHRASE))

  return {
    wind: {
      level: Math.sqrt(wind),
      freq: clamp((0.2 * reading.windSpeed) / profile.aperture, 80, 2000),
      q: 8 + 30 * wind,
      pan: Math.sin((reading.windDirection * Math.PI) / 180) * 0.8,
      breath: 1 - wind,
    },
    rain: {
      level: Math.sqrt(rain),
      density: rain,
      basePitch: basePitch(profile.material, profile.seed, profile.mode),
    },
    gust: { level: Math.sqrt(norm(reading.windGust - reading.windSpeed, 0, 15)) },
    pressure: {
      level: 0.35,
      targetHz: snapHzToMode(profile.mode, 55 + 55 * norm(reading.pressure, 980, 1030)),
    },
    thunder: { level: reading.weatherCode >= 95 ? 1 : 0 },
    pad: {
      level: Math.sqrt(humidity),
      cutoff: 300 + 2700 * humidity,
      degree: PAD_CYCLE[((phrase % 4) + 4) % 4] ?? 0,
    },
    motif: {
      level: 1,
      register: 50 + Math.round(24 * temperature),
    },
    reverb: { wet: 0.15 + 0.5 * cloud, preDelay: 0.01 + 0.04 * cloud },
  }
}
