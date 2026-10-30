import { fnv1a } from './random'
import type { Mode } from './harmony'

export { fnv1a }
export type { Mode }

export type Material = 'wood' | 'glass' | 'metal' | 'stone' | 'water'

export interface PlaceProfile {
  seed: number
  material: Material
  mode: Mode
  tempo: number
  aperture: number
  elevation: number | null
}

export const MATERIALS: readonly Material[] = ['wood', 'glass', 'metal', 'stone', 'water']

function modeFor(lat: number): Mode {
  const abs = Math.abs(lat)
  if (abs < 23.5) return 'lydian'
  if (abs < 45) return 'dorian'
  if (abs < 60) return 'aeolian'
  return 'phrygian'
}

function materialFor(seed: number, elevation: number | null): Material {
  if (elevation === null || (elevation >= 30 && elevation < 300)) {
    return MATERIALS[seed % MATERIALS.length] ?? 'wood'
  }
  if (elevation > 800) return 'stone'
  if (elevation >= 300) return seed % 2 === 0 ? 'stone' : 'metal'
  return seed % 2 === 0 ? 'water' : 'wood'
}

export function placeProfile(
  lat: number,
  lon: number,
  elevation: number | null = null,
): PlaceProfile {
  const seed = fnv1a(`${lat.toFixed(3)},${lon.toFixed(3)}`)
  return {
    seed,
    material: materialFor(seed, elevation),
    mode: modeFor(lat),
    tempo: 48 + (seed % 17),
    aperture: 0.002 + (seed % 5) * 0.001,
    elevation,
  }
}
