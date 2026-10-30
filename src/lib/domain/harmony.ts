export const DORIAN = [0, 2, 3, 5, 7, 9, 10]
export const D2 = 38

export type Mode = 'lydian' | 'dorian' | 'aeolian' | 'phrygian'

export const MODES: Record<Mode, readonly number[]> = {
  lydian: [0, 2, 4, 6, 7, 9, 11],
  dorian: DORIAN,
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
}

export const ROOT_MIDI = 38

export function scaleNote(mode: Mode, degree: number, octave = 0): number {
  const pattern = MODES[mode]
  const index = ((degree % 7) + 7) % 7
  return ROOT_MIDI + 12 * octave + (pattern[index] ?? 0)
}

export function snapHzToMode(mode: Mode, hz: number): number {
  const pattern = MODES[mode]
  let best = hz
  let bestDistance = Number.POSITIVE_INFINITY
  for (let midi = 30; midi <= 90; midi += 1) {
    const pc = (((midi - ROOT_MIDI) % 12) + 12) % 12
    if (!pattern.includes(pc)) continue
    const candidate = midiToHz(midi)
    const distance = Math.abs(Math.log2(candidate / hz))
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

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
