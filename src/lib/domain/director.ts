import type { WeatherReading } from './types'

export type Section = 'emerge' | 'build' | 'expose' | 'break' | 'return'

export type LayerId = 'wind' | 'rain' | 'gust' | 'pressure' | 'thunder' | 'pad' | 'motif'

export interface SectionSpan {
  kind: Section
  startSec: number
  endSec: number
}

export interface Plan {
  pieceSeed: number
  lengthSec: number
  solo: LayerId
  sections: SectionSpan[]
}

const WEIGHTS: Record<Section, number> = {
  emerge: 1.0,
  build: 1.2,
  expose: 1.0,
  break: 0.45,
  return: 1.0,
}

const RANGES: Record<Section, readonly [number, number]> = {
  emerge: [90, 150],
  build: [120, 180],
  expose: [90, 150],
  break: [45, 75],
  return: [90, 150],
}

export function stormScore(reading: WeatherReading | null): number {
  if (reading === null) return 0.5
  let score =
    0.45 * (reading.windGust / 25) +
    0.3 * (reading.windSpeed / 20) +
    0.25 * (reading.precipitation / 8)
  score = Math.min(1, Math.max(0, score))
  if (reading.weatherCode >= 80) {
    score = Math.min(1, Math.max(0, score + 0.2))
  }
  return score
}

export function pieceLength(seed: number): number {
  return 480 + (((seed % 121) + 121) % 121)
}

function middleFor(score: number): Section {
  if (score > 0.6) return 'build'
  if (score < 0.2) return 'emerge'
  return 'expose'
}

function fitToRanges(kinds: Section[], lengths: number[]): void {
  for (let i = 0; i < lengths.length; i += 1) {
    const kind = kinds[i]!
    const [lo, hi] = RANGES[kind]
    let delta = lengths[i]! < lo ? lo - lengths[i]! : lengths[i]! > hi ? hi - lengths[i]! : 0
    if (delta === 0) continue
    lengths[i] = lengths[i]! + delta
    for (let j = 0; j < lengths.length && delta !== 0; j += 1) {
      if (j === i) continue
      const [nlo, nhi] = RANGES[kinds[j]!]
      const room = delta > 0 ? lengths[j]! - nlo : nhi - lengths[j]!
      const shift = Math.sign(delta) * Math.min(Math.abs(delta), Math.max(0, room))
      if (shift === 0) continue
      lengths[j] = lengths[j]! - shift
      delta -= shift
    }
  }
}

export function planFor(seed: number, reading: WeatherReading | null): Plan {
  const lengthSec = pieceLength(seed)
  const five = lengthSec >= 510
  const kinds: Section[] = five
    ? ['emerge', 'build', 'expose', 'break', 'return']
    : ['emerge', middleFor(stormScore(reading)), 'break', 'return']

  const totalWeight = kinds.reduce((sum, kind) => sum + WEIGHTS[kind], 0)
  const lengths = kinds.map((kind) => Math.round((lengthSec * WEIGHTS[kind]) / totalWeight))
  const last = lengths.length - 1
  lengths[last] = lengthSec - lengths.slice(0, last).reduce((sum, part) => sum + part, 0)
  fitToRanges(kinds, lengths)

  const sections: SectionSpan[] = []
  let startSec = 0
  for (let i = 0; i < kinds.length; i += 1) {
    const endSec = startSec + lengths[i]!
    sections.push({ kind: kinds[i]!, startSec, endSec })
    startSec = endSec
  }

  return { pieceSeed: seed, lengthSec, solo: 'wind', sections }
}
