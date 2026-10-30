import { clamp } from '../domain/units'

// Marshall-Palmer: N(D) = N0 exp(-lambda D), D in mm, R in mm/h.
const N0 = 8000
const LAMBDA_BASE = 4.1
const LAMBDA_EXPONENT = -0.21
export const DROP_MIN_MM = 0.1
export const DROP_MAX_MM = 8
// The surface the listener hears: about 60 square centimetres, a leaf or a
// window ledge at arm's length.
const CATCH_AREA_M2 = 0.006
const MAX_DROPS_PER_SECOND = 40
const MIN_RATE = 0.05

export function lambdaFor(rateMmH: number): number {
  return LAMBDA_BASE * Math.pow(Math.max(MIN_RATE, rateMmH), LAMBDA_EXPONENT)
}

/** Atlas terminal velocity, metres per second. */
export function terminalVelocity(diameterMm: number): number {
  return 9.65 - 10.3 * Math.exp(-0.6 * diameterMm)
}

/** Inverse CDF of the truncated exponential drop-size law. */
export function sampleDiameter(rateMmH: number, u: number): number {
  const lambda = lambdaFor(rateMmH)
  const span = 1 - Math.exp(-lambda * DROP_MAX_MM)
  const diameter = -Math.log(1 - clamp(u, 0, 0.999999) * span) / lambda
  return clamp(diameter, DROP_MIN_MM, DROP_MAX_MM)
}

/** Drops crossing a square metre each second, integrated over the size law. */
export function dropFlux(rateMmH: number): number {
  if (rateMmH <= 0) return 0
  const lambda = lambdaFor(rateMmH)
  const step = 0.1
  let flux = 0
  for (let d = step / 2; d < DROP_MAX_MM; d += step) {
    flux += N0 * Math.exp(-lambda * d) * terminalVelocity(d) * step
  }
  return flux
}

/** Drop impacts per second on the listener's patch. */
export function dropRate(rateMmH: number): number {
  if (rateMmH <= 0) return 0
  return Math.min(MAX_DROPS_PER_SECOND, dropFlux(rateMmH) * CATCH_AREA_M2)
}

/** Impact brightness: small drops tick, large ones thud. */
export function dropTone(diameterMm: number): number {
  return clamp(5200 * Math.pow(0.8 / Math.max(DROP_MIN_MM, diameterMm), 1.1), 300, 9000)
}

/** Relative kinetic energy of an impact, used for the strike amplitude. */
export function dropEnergy(diameterMm: number): number {
  const velocity = terminalVelocity(diameterMm)
  return diameterMm * diameterMm * diameterMm * velocity * velocity
}

/** Broadband hiss of a downpour, absent below four mm per hour. */
export function hissLevel(rateMmH: number): number {
  if (rateMmH <= 4) return 0
  return clamp((rateMmH - 4) / 6, 0, 1) * 0.12
}
