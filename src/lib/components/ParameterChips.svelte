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
          {
            label: 'pressure',
            full: 'mean sea level pressure',
            value: `${Math.round(reading.pressure)} hPa`,
          },
          {
            label: 'humidity',
            full: 'relative humidity',
            value: `${Math.round(reading.humidity)}%`,
          },
          {
            label: 'precip',
            full: 'precipitation',
            value: `${reading.precipitation.toFixed(1)} mm/h`,
          },
          {
            label: 'direction',
            full: 'wind direction',
            value: `${compassOf(reading.windDirection)} ${Math.round(reading.windDirection)}°`,
          },
        ]
      : [
          { label: 'pressure', full: 'mean sea level pressure', value: '--' },
          { label: 'humidity', full: 'relative humidity', value: '--' },
          { label: 'precip', full: 'precipitation', value: '--' },
          { label: 'direction', full: 'wind direction', value: '--' },
        ],
  )
</script>

<dl class="chips">
  {#each chips as chip}
    <div class="chip" data-full={chip.full}>
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
    position: relative;
    padding: 8px 10px;
    border: 1px solid var(--sand-dark);
    border-radius: 10px;
    background: var(--cream);
  }

  .chip::after {
    content: attr(data-full);
    position: absolute;
    left: -1px;
    right: -1px;
    bottom: calc(100% + 6px);
    padding: 5px 8px;
    border-radius: 7px;
    background: var(--forest);
    color: var(--parchment);
    font-family: var(--font-mono);
    font-size: 9px;
    line-height: 1.35;
    letter-spacing: 0.04em;
    text-transform: none;
    opacity: 0;
    transform: translateY(4px);
    pointer-events: none;
    transition:
      opacity 180ms ease,
      transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .chip:hover::after {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .chip::after {
      transition: none;
    }
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
