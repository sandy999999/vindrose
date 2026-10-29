import type { Place } from '../weather/photon'
import type { Mix } from './session'

const PLACE_KEY = 'vindrose.place'
const MIX_KEY = 'vindrose.mix'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readJson(key: string): unknown {
  try {
    const raw = storage()?.getItem(key)
    return raw === null || raw === undefined ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

function isPlace(value: unknown): value is Place {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.name === 'string' &&
    typeof record.lat === 'number' &&
    Number.isFinite(record.lat) &&
    typeof record.lon === 'number' &&
    Number.isFinite(record.lon)
  )
}

function isMix(value: unknown): value is Mix {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.gain === 'object' && typeof record.muted === 'object'
}

export function loadLastPlace(): Place | null {
  const value = readJson(PLACE_KEY)
  if (!isPlace(value)) return null
  return { name: value.name, lat: value.lat, lon: value.lon, country: value.country ?? null }
}

export function saveLastPlace(place: Place): void {
  try {
    storage()?.setItem(PLACE_KEY, JSON.stringify(place))
  } catch {
    // Storage full or blocked; the place simply will not be remembered.
  }
}

export function loadMix(): Mix | null {
  const value = readJson(MIX_KEY)
  return isMix(value) ? value : null
}

export function saveMix(mix: Mix): void {
  try {
    storage()?.setItem(MIX_KEY, JSON.stringify(mix))
  } catch {
    // Storage full or blocked; the mix simply will not be remembered.
  }
}
