<script lang="ts">
  import { onMount } from 'svelte'
  import {
    GeoJSONSource,
    Map as MapLibreMap,
    Marker,
    setWorkerUrl,
    type MapMouseEvent,
  } from 'maplibre-gl'
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
  import type { Feature, FeatureCollection, LineString } from 'geojson'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import { loadLastPlace } from '../stores/persistence'
  import type { Place } from '../weather/photon'

  setWorkerUrl(workerUrl)

  interface Props {
    place: Place | null
    windDirection: number | null
    onPick: (lat: number, lon: number) => void
  }

  let { place, windDirection, onPick }: Props = $props()

  const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
  const FALLBACK_CENTER: [number, number] = [10.75, 59.91]
  const LINE_HALF_DEGREES = 0.045

  let container: HTMLDivElement
  let map: MapLibreMap | null = null
  let marker: Marker | null = null
  let ready = $state(false)
  let pendingPin = $state<{ lat: number; lon: number } | null>(null)
  let flownTo: Place | null = null

  function lineFeature(lat: number, lon: number, bearing: number): Feature<LineString> {
    const radians = (bearing * Math.PI) / 180
    const dLat = Math.cos(radians) * LINE_HALF_DEGREES
    const dLon =
      (Math.sin(radians) * LINE_HALF_DEGREES) / Math.cos((lat * Math.PI) / 180)
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [lon - dLon, lat - dLat],
          [lon + dLon, lat + dLat],
        ],
      },
    }
  }

  function emptyLine(): FeatureCollection {
    return { type: 'FeatureCollection', features: [] }
  }

  function pinElement(): HTMLDivElement {
    const element = document.createElement('div')
    element.className = 'windrose-pin'
    const halo = document.createElement('span')
    halo.className = 'windrose-pin-halo'
    const dot = document.createElement('span')
    dot.className = 'windrose-pin-dot'
    element.append(halo, dot)
    return element
  }

  function placePin(lon: number, lat: number): void {
    if (!map) return
    if (!marker) {
      marker = new Marker({ element: pinElement(), anchor: 'center' })
      marker.setLngLat([lon, lat]).addTo(map)
      return
    }
    marker.setLngLat([lon, lat])
  }

  onMount(() => {
    const saved = loadLastPlace()
    const start = place ?? saved
    map = new MapLibreMap({
      container,
      style: STYLE_URL,
      center: start ? [start.lon, start.lat] : FALLBACK_CENTER,
      zoom: start ? 10 : 9,
      attributionControl: { compact: true },
    })

    map.on('load', () => {
      if (!map) return
      map.addSource('bearing', { type: 'geojson', data: emptyLine() })
      map.addLayer({
        id: 'bearing-line',
        type: 'line',
        source: 'bearing',
        paint: {
          'line-color': '#92a494',
          'line-width': 1.5,
          'line-opacity': 0.55,
        },
      })
      ready = true
    })

    map.on('click', (event: MapMouseEvent) => {
      const { lat, lng } = event.lngLat
      pendingPin = { lat, lon: lng }
      onPick(lat, lng)
    })

    return () => {
      marker?.remove()
      marker = null
      map?.remove()
      map = null
    }
  })

  $effect(() => {
    if (!ready || !map) return
    const target = pendingPin ?? (place ? { lat: place.lat, lon: place.lon } : null)
    if (!target) return
    placePin(target.lon, target.lat)
  })

  $effect(() => {
    if (!ready || !map || !place || place === flownTo) return
    flownTo = place
    pendingPin = null
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    map.flyTo({
      center: [place.lon, place.lat],
      zoom: Math.max(map.getZoom(), 10),
      duration: reduceMotion ? 0 : 900,
    })
  })

  $effect(() => {
    if (!ready || !map) return
    const source = map.getSource('bearing')
    if (!(source instanceof GeoJSONSource)) return

    const target = pendingPin ?? (place ? { lat: place.lat, lon: place.lon } : null)
    if (!target || windDirection === null) {
      source.setData(emptyLine())
      return
    }
    source.setData(lineFeature(target.lat, target.lon, windDirection))
  })
</script>

<div class="map" bind:this={container} aria-label="Weather map" role="application"></div>

<style>
  .map {
    position: absolute;
    inset: 0;
    background: var(--parchment-dim);
  }

  :global(.map .maplibregl-canvas) {
    filter: sepia(0.18) saturate(0.85);
  }

  :global(.windrose-pin) {
    position: relative;
    width: 18px;
    height: 18px;
    pointer-events: none;
  }

  :global(.windrose-pin-dot) {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: var(--sage-dark);
    border: 2px solid var(--cream-bright);
  }

  :global(.windrose-pin-halo) {
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(146, 164, 148, 0.35) 0%,
      rgba(146, 164, 148, 0) 70%
    );
  }
</style>
