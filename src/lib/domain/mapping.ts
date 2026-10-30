import { BARS_PER_PHRASE, barDuration } from '../audio/scheduler'
import { airShelfDb, speedRatio } from './air'
import { snapHzToMode } from './harmony'
import { basePitch } from './materials'
import type { PlaceProfile } from './place'
import type { WeatherReading } from './types'
import { clamp, norm } from './units'

export interface ChannelTargets {
  wind: { level: number; freq: number; q: number; pan: number; breath: number }
  rain: { level: number; density: number; rate: number; basePitch: number }
  gust: { level: number }
  pressure: { level: number; targetHz: number }
  thunder: { level: number }
  pad: { level: number; cutoff: number; degree: number }
  motif: { level: number; register: number }
  air: { shelfDb: number }
  reverb: { wet: number; preDelay: number }
}

const PAD_CYCLE = [0, 5, 3, 4]
// Strouhal number for a bluff body: f = St * U / D, with D the aperture.
const STROUHAL = 0.2
const AIR_PATH_METRES = 100

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
  // Air density changes the speed of sound, and every resonance tuned to a
  // length moves with it. This is the temperature you hear, not a metaphor.
  const soundSpeed = speedRatio(reading.temperature)

  return {
    wind: {
      level: Math.sqrt(wind),
      freq: clamp((STROUHAL * reading.windSpeed * soundSpeed) / profile.aperture, 80, 2000),
      q: 8 + 30 * wind,
      pan: Math.sin((reading.windDirection * Math.PI) / 180) * 0.8,
      breath: 1 - wind,
    },
    rain: {
      level: Math.sqrt(rain),
      density: rain,
      rate: reading.precipitation,
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
      cutoff: clamp((300 + 2700 * humidity) * (0.6 + 0.8 * temperature), 200, 6000),
      degree: PAD_CYCLE[((phrase % 4) + 4) % 4] ?? 0,
    },
    motif: {
      level: 1,
      register: 50 + Math.round(24 * temperature),
    },
    air: { shelfDb: airShelfDb(reading.temperature, reading.humidity, AIR_PATH_METRES) },
    reverb: { wet: 0.15 + 0.5 * cloud, preDelay: 0.01 + 0.04 * cloud },
  }
}
