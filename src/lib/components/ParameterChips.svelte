<script lang="ts">
  import type { WeatherReading } from '../domain/types'

  interface Props {
    reading: WeatherReading | null
  }

  let { reading }: Props = $props()

  const COMPASS = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ]

  function compassOf(degrees: number): string {
    const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16
    return COMPASS[index] ?? 'N'
  }

  const chips = $derived(
    reading
      ? [
          { label: 'pressure', value: `${Math.round(reading.pressure)} hPa` },
          { label: 'humidity', value: `${Math.round(reading.humidity)}%` },
          { label: 'precip', value: `${reading.precipitation.toFixed(1)} mm` },
          {
            label: 'direction',
            value: `${compassOf(reading.windDirection)} ${Math.round(reading.windDirection)}°`,
          },
        ]
      : [
          { label: 'pressure', value: '--' },
          { label: 'humidity', value: '--' },
          { label: 'precip', value: '--' },
          { label: 'direction', value: '--' },
        ],
  )
</script>

<dl class="chips">
  {#each chips as chip}
    <div class="chip">
      <dt>{chip.label}</dt>
      <dd>{chip.value}</dd>
    </div>
  {/each}
</dl>

<style>
  .chips {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin: 12px 0 0;
  }

  .chip {
    padding: 8px 10px;
    border: 1px solid var(--sand-dark);
    border-radius: 10px;
    background: var(--cream);
  }

  dt {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--forest-muted);
  }

  dd {
    margin: 4px 0 0;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--forest);
    white-space: nowrap;
  }

  @media (max-width: 359px) {
    .chips {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
