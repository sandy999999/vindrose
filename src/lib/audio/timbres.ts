import type { ChannelId } from './engine'

export type TimbreName = string

export interface TimbreOption {
  name: TimbreName
  label: string
}

export const TIMBRES: Record<ChannelId, TimbreOption[]> = {
  wind: [
    { name: 'hiss', label: 'Hiss' },
    { name: 'roar', label: 'Roar' },
    { name: 'whistle', label: 'Whistle' },
  ],
  gust: [
    { name: 'ping', label: 'Ping' },
    { name: 'wood', label: 'Wood' },
    { name: 'tick', label: 'Tick' },
  ],
  rain: [
    { name: 'droplet', label: 'Droplet' },
    { name: 'patter', label: 'Patter' },
    { name: 'static', label: 'Static' },
  ],
  pressure: [
    { name: 'sine', label: 'Sine' },
    { name: 'hollow', label: 'Hollow' },
    { name: 'reed', label: 'Reed' },
  ],
  humidity: [
    { name: 'pad', label: 'Pad' },
    { name: 'choir', label: 'Choir' },
    { name: 'glass', label: 'Glass' },
  ],
  temperature: [
    { name: 'shimmer', label: 'Shimmer' },
    { name: 'bell', label: 'Bell' },
    { name: 'air', label: 'Air' },
  ],
}

export function defaultTimbre(id: ChannelId): TimbreName {
  return TIMBRES[id][0]?.name ?? ''
}

export function isTimbre(id: ChannelId, name: TimbreName): boolean {
  return TIMBRES[id].some((option) => option.name === name)
}

export function timbreLabel(id: ChannelId, name: TimbreName): string {
  return TIMBRES[id].find((option) => option.name === name)?.label ?? name
}

export function defaultTimbres(): Record<ChannelId, TimbreName> {
  const map = {} as Record<ChannelId, TimbreName>
  for (const id of Object.keys(TIMBRES) as ChannelId[]) {
    map[id] = defaultTimbre(id)
  }
  return map
}
