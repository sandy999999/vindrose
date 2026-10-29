<script lang="ts">
  import { onMount } from 'svelte'
  import type { WeatherReading } from '../domain/types'
  import type { Place } from '../weather/photon'

  interface Props {
    reading: WeatherReading | null
    place: Place | null
  }

  let { reading, place }: Props = $props()

  const POINTS = 120
  const SAMPLE_MS = 1000
  const COLORS = {
    background: '#222514',
    grid: '#363928',
    wind: '#c4d1c6',
    pressure: '#92a494',
  }

  let canvas = $state<HTMLCanvasElement | null>(null)
  let reducedMotion = $state(false)

  const wind: number[] = []
  const pressure: number[] = []
  let lastPlace: string | null = null

  function unit(value: number): number {
    return Math.max(0, Math.min(1, value))
  }

  function sample(from: WeatherReading): void {
    wind.push(unit(from.windSpeed / 25))
    pressure.push(unit((from.pressure - 995) / 35))
    while (wind.length > POINTS) {
      wind.shift()
      pressure.shift()
    }
  }

  function series(ctx: CanvasRenderingContext2D, data: number[], color: string, width: number, height: number): void {
    if (data.length < 2) return
    const step = width / (POINTS - 1)
    const offset = POINTS - data.length

    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    data.forEach((value, index) => {
      const x = (offset + index) * step
      const y = height - 6 - value * (height - 12)
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()
  }

  function draw(): void {
    const element = canvas
    if (!element) return

    const width = element.clientWidth
    const height = element.clientHeight
    if (width === 0 || height === 0) return

    const ratio = Math.min(2, window.devicePixelRatio || 1)
    if (element.width !== Math.round(width * ratio)) {
      element.width = Math.round(width * ratio)
      element.height = Math.round(height * ratio)
    }

    const ctx = element.getContext('2d')
    if (!ctx) return

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height - 0.5)
    ctx.lineTo(width, height - 0.5)
    ctx.stroke()

    series(ctx, wind, COLORS.wind, width, height)
    series(ctx, pressure, COLORS.pressure, width, height)
  }

  $effect(() => {
    const key = place ? `${place.lat},${place.lon}` : null
    if (key === lastPlace) return
    lastPlace = key
    wind.length = 0
    pressure.length = 0
    draw()
  })

  $effect(() => {
    const current = reading
    if (current && reducedMotion) {
      sample(current)
      draw()
    }
  })

  onMount(() => {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const observer = new ResizeObserver(() => draw())
    if (canvas) observer.observe(canvas)

    let timer: ReturnType<typeof setInterval> | null = null
    if (!reducedMotion) {
      timer = setInterval(() => {
        if (reading) {
          sample(reading)
          draw()
        }
      }, SAMPLE_MS)
    }
    draw()

    return () => {
      observer.disconnect()
      if (timer !== null) clearInterval(timer)
    }
  })
</script>

<div class="trace">
  <div class="legend">
    <span class="wind">wind</span>
    <span class="pressure">pressure</span>
    <span class="window">last 2 min</span>
  </div>
  <div
    class="plot"
    role="img"
    aria-label="Live trace of wind speed and pressure over the last two minutes"
  >
    <canvas bind:this={canvas} aria-hidden="true"></canvas>
  </div>
</div>

<style>
  .trace {
    margin-top: 16px;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 6px;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--forest-muted);
  }

  .legend span::before {
    content: '';
    width: 10px;
    height: 2px;
    background: currentColor;
  }

  .legend span.wind {
    color: var(--sage-dark);
  }

  .legend span.pressure {
    color: var(--forest-muted);
  }

  .window {
    margin-left: auto;
  }

  .plot {
    border-radius: 10px;
    overflow: hidden;
  }

  canvas {
    display: block;
    width: 100%;
    height: 84px;
    border-radius: 10px;
    background: var(--forest);
  }

  @media (min-width: 900px) {
    canvas {
      height: 108px;
    }
  }
</style>
