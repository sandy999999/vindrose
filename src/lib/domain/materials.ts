import { snapHzToMode, type Mode } from './harmony'
import type { Material } from './place'
import { mulberry32 } from './random'

export interface MaterialSpec {
  ratios: [number, number, number, number]
  baseLow: number
  baseHigh: number
}

export const MATERIAL_SPEC: Record<Material, MaterialSpec> = {
  wood: { ratios: [1, 2.32, 4.25, 6.63], baseLow: 180, baseHigh: 260 },
  glass: { ratios: [1, 2.76, 5.4, 8.93], baseLow: 800, baseHigh: 1400 },
  metal: { ratios: [1, 2.71, 5.15, 8.42], baseLow: 400, baseHigh: 900 },
  stone: { ratios: [1, 2.01, 3.44, 5.12], baseLow: 120, baseHigh: 260 },
  water: { ratios: [1, 1.59, 2.14, 2.65], baseLow: 90, baseHigh: 220 },
}

export function basePitch(material: Material, seed: number, mode: Mode): number {
  const spec = MATERIAL_SPEC[material]
  const hz = spec.baseLow + (spec.baseHigh - spec.baseLow) * mulberry32(seed)()
  return snapHzToMode(mode, hz)
}
