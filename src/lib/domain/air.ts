import { clamp } from './units'

const T_ZERO = 273.15
const T_REF = 293.15
const P_REF = 101.325

/** Speed of sound in dry air, metres per second. */
export function speedOfSound(celsius: number): number {
  return 331.3 * Math.sqrt(1 + celsius / T_ZERO)
}

/** Speed of sound relative to a reference day, used to retune resonances. */
export function speedRatio(celsius: number, reference = 20): number {
  return speedOfSound(celsius) / speedOfSound(reference)
}

/**
 * Atmospheric absorption per metre, ISO 9613-1. `humidity` is relative
 * humidity in percent, `hz` the band centre, `pressureKpa` the ambient
 * pressure (sea level unless a site is high enough to matter).
 */
export function airAbsorption(
  celsius: number,
  humidity: number,
  hz: number,
  pressureKpa = P_REF,
): number {
  const t = celsius + T_ZERO
  const pressure = Math.max(1, pressureKpa)
  // Saturation vapour pressure, normalised to the reference pressure.
  const psat = Math.pow(10, -6.8346 * Math.pow(T_ZERO / t, 1.261) + 4.6151)
  // Molar concentration of water vapour, percent, as the standard expects.
  const h = (clamp(humidity, 0, 100) * psat * P_REF) / pressure
  const shared = (0.02 + h) / (0.391 + h)

  const oxygen = (pressure / P_REF) * (24 + 4.04e4 * h * shared)
  const nitrogen =
    Math.pow(pressure / P_REF, -1) * Math.sqrt(T_REF / t) * (24 + 404 * h * shared)

  const relaxation =
    Math.pow(T_REF / t, 2.5) *
    (0.01275 * Math.exp(-2239.1 / t) / (oxygen + (hz * hz) / oxygen) +
      0.1068 * Math.exp(-3352 / t) / (nitrogen + (hz * hz) / nitrogen))
  const classical = 1.84e-11 * (P_REF / pressure) * Math.sqrt(t / T_REF)

  return 8.686 * hz * hz * (classical + relaxation)
}

/** Absorption over a listening path, as a high shelf gain in dB. */
export function airShelfDb(
  celsius: number,
  humidity: number,
  metres: number,
  hz = 4000,
): number {
  const loss = airAbsorption(celsius, humidity, hz) * Math.max(0, metres)
  if (loss <= 0) return 0
  return clamp(-loss, -18, 0)
}
