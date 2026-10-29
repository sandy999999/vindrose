import type { WeatherReading } from './types'
import { norm } from './units'
import { rootForPressure } from './harmony'

export interface ChannelTargets {
  wind: { level: number; cutoff: number; pan: number }
  gust: { level: number }
  rain: { level: number; density: number }
  pressure: { level: number; index: number; root: number }
  humidity: { level: number; cutoff: number; root: number }
  temperature: { level: number; partials: number; root: number }
  reverb: { wet: number; preDelay: number }
}

export function mapWeather(reading: WeatherReading, _pressureTendency: number): ChannelTargets {
  const wind = norm(reading.windSpeed, 0, 25)
  const humidity = norm(reading.humidity, 0, 100)
  const temperature = norm(reading.temperature, -20, 30)
  const cloud = norm(reading.cloudCover, 0, 100)
  const rain = norm(reading.precipitation, 0, 10)
  const root = rootForPressure(reading.pressure)

  return {
    wind: {
      level: Math.sqrt(wind),
      cutoff: 200 + 1000 * wind,
      pan: Math.sin((reading.windDirection * Math.PI) / 180) * 0.8,
    },
    gust: { level: Math.sqrt(norm(reading.windGust - reading.windSpeed, 0, 15)) },
    rain: { level: Math.sqrt(rain), density: rain },
    pressure: { level: 0.5, index: norm(Math.abs(reading.pressure - 1013), 0, 25), root },
    humidity: { level: Math.sqrt(humidity), cutoff: 300 + 2700 * humidity, root },
    temperature: {
      level: Math.sqrt(temperature),
      partials: 2 + Math.round(4 * temperature),
      root,
    },
    reverb: { wet: 0.15 + 0.5 * cloud, preDelay: 0.01 + 0.04 * cloud },
  }
}
