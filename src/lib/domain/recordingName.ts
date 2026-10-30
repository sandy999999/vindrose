import type { Place } from '../weather/photon'

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0')
}

export function recordingName(place: Place | null, date: Date, seed: number): string {
  const slug =
    (place?.name ?? 'vindrose')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'vindrose'
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}`
  return `vindrose-${slug}-${stamp}-${seed.toString(16).padStart(8, '0')}.wav`
}
