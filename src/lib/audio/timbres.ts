import type { ChannelId } from './engine'

export type TimbreName = string

export interface TimbreOption {
  name: TimbreName
  label: string
}

export const TIMBRES: Partial<Record<ChannelId, TimbreOption[]>> = {
  pad: [
    { name: 'pad', label: 'Pad' },
    { name: 'choir', label: 'Choir' },
    { name: 'glass', label: 'Glass' },
  ],
  motif: [
    { name: 'shimmer', label: 'Shimmer' },
    { name: 'bell', label: 'Bell' },
    { name: 'air', label: 'Air' },
  ],
}

export function defaultTimbre(id: ChannelId): TimbreName {
  return TIMBRES[id]?.[0]?.name ?? ''
}

export function isTimbre(id: ChannelId, name: TimbreName): boolean {
  return TIMBRES[id]?.some((option) => option.name === name) ?? false
}

export function timbreLabel(id: ChannelId, name: TimbreName): string {
  return TIMBRES[id]?.find((option) => option.name === name)?.label ?? name
}

export function defaultTimbres(): Partial<Record<ChannelId, TimbreName>> {
  const map: Partial<Record<ChannelId, TimbreName>> = {}
  for (const id of Object.keys(TIMBRES) as ChannelId[]) {
    map[id] = defaultTimbre(id)
  }
  return map
}
