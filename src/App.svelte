<script lang="ts">
  import { onMount } from 'svelte'
  import MapDeck from './lib/components/MapDeck.svelte'
  import SearchPill from './lib/components/SearchPill.svelte'
  import BottomSheet from './lib/components/BottomSheet.svelte'
  import WeatherHeader from './lib/components/WeatherHeader.svelte'
  import ParameterChips from './lib/components/ParameterChips.svelte'
  import ChannelStrip from './lib/components/ChannelStrip.svelte'
  import Transport from './lib/components/Transport.svelte'
  import LiveTrace from './lib/components/LiveTrace.svelte'
  import Toast from './lib/components/Toast.svelte'
  import { CHANNELS, type ChannelId } from './lib/audio/engine'
  import { TIMBRES } from './lib/audio/timbres'
  import { MAX_RECORD_SECONDS } from './lib/audio/recorder'
  import { mapWeather } from './lib/domain/mapping'
  import { getSession } from './lib/stores/live'
  import type { SessionState } from './lib/stores/session'
  import type { Place } from './lib/weather/photon'
  import { reversePlace } from './lib/weather/photon'

  const session = getSession()
  let view = $state<SessionState>(session.snapshot)
  let toast = $state<string | null>(null)
  let elapsed = $state(0)

  const STRIPS: Array<{ id: ChannelId; label: string }> = [
    { id: 'wind', label: 'WIN' },
    { id: 'gust', label: 'GUS' },
    { id: 'rain', label: 'RAI' },
    { id: 'pressure', label: 'PRE' },
    { id: 'humidity', label: 'HUM' },
    { id: 'temperature', label: 'TEM' },
  ]

  const targets = $derived(view.reading ? mapWeather(view.reading, view.tendency) : null)
  const levels: Record<ChannelId, number> = $derived({
    wind: targets?.wind.level ?? 0,
    gust: targets?.gust.level ?? 0,
    rain: targets?.rain.level ?? 0,
    pressure: targets?.pressure.level ?? 0,
    humidity: targets?.humidity.level ?? 0,
    temperature: targets?.temperature.level ?? 0,
  })
  const allMuted = $derived(CHANNELS.every((id) => view.channelMuted[id]))

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

  $effect(() => {
    if (!view.recording) {
      elapsed = 0
      return
    }
    elapsed = session.recordingSeconds
    const timer = setInterval(() => {
      if (!session.snapshot.recording) return
      elapsed = session.recordingSeconds
      if (elapsed >= MAX_RECORD_SECONDS) {
        finishRecording(true)
      }
    }, 500)
    return () => clearInterval(timer)
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

  async function toggleRecording(): Promise<void> {
    if (view.recording) {
      finishRecording(false)
      return
    }
    try {
      await session.startRecording()
    } catch {
      toast = 'Start the sound before recording'
    }
  }

  function finishRecording(limitReached: boolean): void {
    const result = session.stopRecording()
    if (!result || result.blob.size <= 44) {
      toast = 'Nothing was recorded'
      return
    }
    download(result.blob)
    const length = clock(result.durationSec)
    toast = limitReached ? `10 min limit reached · saved ${length}` : `Saved ${length}`
  }

  function download(blob: Blob): void {
    const slug =
      (view.place?.name ?? 'vindrose')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'vindrose'
    const date = new Date().toISOString().slice(0, 10)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vindrose-${slug}-${date}.wav`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  function clock(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds))
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  }

  function cycleTimbre(id: ChannelId): void {
    const options = TIMBRES[id]
    const index = options.findIndex((option) => option.name === view.timbre[id])
    const next = options[(index + 1) % options.length]
    if (next) session.setTimbre(id, next.name)
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

    {#snippet children()}
      <div class="mixer">
        {#each STRIPS as strip (strip.id)}
          <ChannelStrip
            id={strip.id}
            label={strip.label}
            value={levels[strip.id]}
            gain={view.channelGain[strip.id]}
            muted={view.channelMuted[strip.id]}
            timbre={view.timbre[strip.id]}
            timbreOptions={TIMBRES[strip.id]}
            onGain={(value) => session.setChannelGain(strip.id, value)}
            onToggleMute={() => session.toggleMute(strip.id)}
            onNextTimbre={() => cycleTimbre(strip.id)}
            onPickTimbre={(name) => session.setTimbre(strip.id, name)}
          />
        {/each}
      </div>

      <Transport
        playing={view.playing}
        recording={view.recording}
        elapsed={elapsed}
        master={view.master}
        frozen={view.frozen}
        allMuted={allMuted}
        onPlay={() => void session.play()}
        onPause={() => session.pause()}
        onRecord={() => void toggleRecording()}
        onMaster={(value) => session.setMaster(value)}
        onToggleMuteAll={() => session.toggleMuteAll()}
        onToggleFreeze={() => session.toggleFreeze()}
      />

      <LiveTrace reading={view.reading} place={view.place} />

      <footer class="sources">
        weather: Open-Meteo · map: OpenFreeMap · search: Photon
      </footer>
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

  .mixer {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    padding: 14px 0 4px;
    border-top: 1px solid var(--sand-dark);
    margin-top: 14px;
  }

  .sources {
    margin-top: 14px;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.06em;
    color: var(--forest-muted);
    text-align: center;
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
