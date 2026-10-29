<script lang="ts">
  import { onMount } from 'svelte'
  import MapDeck from './lib/components/MapDeck.svelte'
  import SearchPill from './lib/components/SearchPill.svelte'
  import BottomSheet from './lib/components/BottomSheet.svelte'
  import WeatherHeader from './lib/components/WeatherHeader.svelte'
  import ParameterChips from './lib/components/ParameterChips.svelte'
  import Toast from './lib/components/Toast.svelte'
  import { getSession } from './lib/stores/live'
  import type { SessionState } from './lib/stores/session'
  import type { Place } from './lib/weather/photon'
  import { reversePlace } from './lib/weather/photon'

  const session = getSession()
  let view = $state<SessionState>(session.snapshot)
  let toast = $state<string | null>(null)

  onMount(() => {
    const unsubscribe = session.subscribe((next) => {
      view = next
    })
    const saved = session.snapshot.place
    if (saved) {
      void session.selectPlace(saved)
    }
    return unsubscribe
  })

  function select(place: Place): void {
    void session.selectPlace(place)
  }

  async function pick(lat: number, lon: number): Promise<void> {
    let place: Place | null = null
    try {
      place = await reversePlace(lat, lon)
    } catch {
      place = null
    }
    select(
      place ?? {
        name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
        lat,
        lon,
        country: null,
      },
    )
  }
</script>

<div class="deck">
  <div class="map-slot">
    <MapDeck
      place={view.place}
      windDirection={view.reading?.windDirection ?? null}
      onPick={pick}
    />
  </div>

  <div class="search-slot">
    <SearchPill onSelect={select} />
  </div>

  <BottomSheet>
    {#snippet header()}
      <WeatherHeader place={view.place} reading={view.reading} stale={view.stale} />
      <ParameterChips reading={view.reading} />
    {/snippet}
  </BottomSheet>

  <Toast message={toast} onDismiss={() => (toast = null)} />
</div>

<style>
  .deck {
    position: relative;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: var(--parchment);
  }

  .map-slot {
    position: absolute;
    inset: 0;
  }

  .search-slot {
    position: absolute;
    top: calc(12px + env(safe-area-inset-top));
    left: 12px;
    right: 12px;
    z-index: 15;
  }

  @media (min-width: 900px) {
    .map-slot {
      right: 38%;
    }

    .search-slot {
      left: 24px;
      right: calc(38% + 24px);
      max-width: 420px;
    }
  }
</style>
