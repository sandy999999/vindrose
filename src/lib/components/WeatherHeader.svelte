<script lang="ts">
  import type { Section } from '../domain/director'
  import type { WeatherReading } from '../domain/types'
  import type { Place } from '../weather/photon'

  interface Props {
    place: Place | null
    reading: WeatherReading | null
    stale: boolean
    section: Section | null
  }

  let { place, reading, stale, section }: Props = $props()

  function conditionOf(code: number): string {
    if (code === 0) return 'clear'
    if (code === 1) return 'mostly clear'
    if (code === 2) return 'partly cloudy'
    if (code === 3) return 'overcast'
    if (code <= 48) return 'fog'
    if (code <= 57) return 'drizzle'
    if (code <= 67) return 'rain'
    if (code <= 77) return 'snow'
    if (code <= 82) return 'showers'
    if (code <= 86) return 'snow showers'
    return 'thunderstorm'
  }

  function coordsOf(point: Place): string {
    const lat = `${Math.abs(point.lat).toFixed(2)}° ${point.lat >= 0 ? 'N' : 'S'}`
    const lon = `${Math.abs(point.lon).toFixed(2)}° ${point.lon >= 0 ? 'E' : 'W'}`
    return `${lat} · ${lon}`
  }

  function timeOf(iso: string): string {
    const match = /T(\d{2}:\d{2})/.exec(iso)
    return match?.[1] ?? iso
  }

  const condition = $derived(reading ? conditionOf(reading.weatherCode) : 'no reading yet')
  const temperature = $derived(reading ? `${reading.temperature.toFixed(1)}°` : '--')
  const wind = $derived(reading ? (reading.windSpeed * 3.6).toFixed(1) : '--')
  const updated = $derived(reading ? timeOf(reading.time) : '')
</script>

<header class="header">
  <div class="identity">
    <div class="name">{place?.name ?? 'Search a place'}</div>
    <div class="meta">
      {#if section}<span class="section">{section.toUpperCase()}</span>{/if}
      {#if place}<span class="coords">{coordsOf(place)}</span>{/if}
      {#if stale && reading}
        <span class="stale">stale · last updated {updated}</span>
      {/if}
    </div>
  </div>

  <div class="weather">
    <div class="condition">{condition}</div>
    <div class="temperature">{temperature}</div>
  </div>

  <div class="wind">
    <span class="value">{wind}</span>
    <span class="unit">km/h</span>
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: flex-end;
    gap: 14px;
  }

  .identity {
    flex: 1 1 auto;
    min-width: 0;
  }

  .name {
    font-size: 19px;
    font-weight: 600;
    line-height: 1.15;
    color: var(--forest);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 3px;
  }

  .section,
  .coords,
  .stale {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--forest-muted);
  }

  .section {
    letter-spacing: 0.14em;
    color: var(--forest);
  }

  .stale {
    color: var(--forest);
  }

  .weather {
    flex: 0 0 auto;
    text-align: right;
    padding-bottom: 2px;
  }

  .condition {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--forest-muted);
  }

  .temperature {
    font-size: 17px;
    color: var(--forest);
  }

  .wind {
    flex: 0 0 auto;
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .wind .value {
    font-family: var(--font-mono);
    font-size: 34px;
    line-height: 0.9;
    letter-spacing: -0.02em;
    color: var(--forest);
  }

  .wind .unit {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--forest-muted);
  }

  @media (min-width: 900px) {
    .name {
      font-size: 22px;
    }

    .wind .value {
      font-size: 42px;
    }
  }
</style>
