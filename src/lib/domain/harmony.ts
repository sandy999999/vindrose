export const DORIAN = [0, 2, 3, 5, 7, 9, 10]
export const D2 = 38

export function isInScale(midi: number): boolean {
  const pc = (((midi - D2) % 12) + 12) % 12
  return DORIAN.includes(pc)
}

export function quantizeToScale(midi: number): number {
  let best = midi
  let bestDistance = Number.POSITIVE_INFINITY
  for (let offset = -6; offset <= 6; offset += 1) {
    const candidate = midi + offset
    if (!isInScale(candidate)) continue
    const distance = Math.abs(offset)
    if (distance < bestDistance || (distance === bestDistance && candidate > best)) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

export function rootForPressure(pressure: number): number {
  if (pressure < 995) return 45
  if (pressure < 1005) return 43
  if (pressure < 1018) return 38
  return 36
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}
