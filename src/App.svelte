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
  import type { ChannelId } from './lib/audio/engine'
  import { TIMBRES } from './lib/audio/timbres'
  import { recordAlert } from './lib/audio/recorder'
  import { recordingName } from './lib/domain/recordingName'
  import { getSession } from './lib/stores/live'
  import { latestResult } from './lib/weather/latest'
  import type { SessionState } from './lib/stores/session'
  import type { Place } from './lib/weather/photon'
  import { reversePlace } from './lib/weather/photon'

  const session = getSession()
  let view = $state<SessionState>(session.snapshot)
  let toast = $state<string | null>(null)
  let elapsed = $state(0)

  const STRIPS: Array<{ id: ChannelId; label: string }> = [
    { id: 'wind', label: 'WIN' },
    { id: 'rain', label: 'RAI' },
    { id: 'gust', label: 'GUS' },
    { id: 'pressure', label: 'PRE' },
    { id: 'thunder', label: 'THU' },
    { id: 'pad', label: 'PAD' },
    { id: 'motif', label: 'MOT' },
  ]

  const allMuted = $derived(view.mutedAll)
  const reverse = latestResult<Place | null>()
  let warned = false

  let wakeLock: WakeLockSentinel | null = null

  async function acquireWakeLock(): Promise<void> {
    if (wakeLock || !('wakeLock' in navigator) || document.hidden) return
    try {
      const lock = await navigator.wakeLock.request('screen')
      wakeLock = lock
      lock.addEventListener('release', () => {
        if (wakeLock === lock) wakeLock = null
      })
    } catch {
      wakeLock = null
    }
  }

  async function releaseWakeLock(): Promise<void> {
    const lock = wakeLock
    wakeLock = null
    try {
      await lock?.release()
    } catch {
      // Already released by the browser.
    }
  }

  $effect(() => {
    if (view.playing) {
      void acquireWakeLock()
    } else {
      void releaseWakeLock()
    }
  })

  onMount(() => {
    const unsubscribe = session.subscribe((next) => {
      view = next
    })
    const saved = session.snapshot.place
    if (saved) {
      void session.selectPlace(saved)
    }
    const onVisibility = (): void => {
      if (!document.hidden && session.snapshot.playing) void acquireWakeLock()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
      void releaseWakeLock()
    }
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
      const alert = recordAlert(elapsed, warned)
      if (alert === 'limit') {
        finishRecording(true)
      } else if (alert === 'warn') {
        warned = true
        toast = '2 min left of 10'
      }
    }, 500)
    return () => clearInterval(timer)
  })

  function select(place: Place): void {
    void session.selectPlace(place)
  }

  async function pick(lat: number, lon: number): Promise<void> {
    const result = await reverse(() => reversePlace(lat, lon).catch(() => null))
    if (!result.fresh) return
    select(
      result.value ?? {
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
    warned = false
    elapsed = 0
    try {
      await session.startRecording()
    } catch {
      toast = 'Start the sound before recording'
    }
  }

  function finishRecording(limitReached: boolean): void {
    const result = session.stopRecording()
    warned = false
    if (!result || result.blob.size <= 44) {
      toast = 'Nothing was recorded'
      return
    }
    download(result.blob, result.place, result.pieceSeed)
    const length = clock(result.durationSec)
    toast = limitReached ? `10 min limit reached · saved ${length}` : `Saved ${length}`
  }

  function download(blob: Blob, place: Place | null, seed: number): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = recordingName(place, new Date(), seed)
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  function clock(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds))
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  }

  function cycleTimbre(id: ChannelId): void {
    const options = TIMBRES[id]
    if (!options) return
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
      <WeatherHeader
        place={view.place}
        reading={view.reading}
        stale={view.stale}
        section={view.section}
      />
      <ParameterChips reading={view.reading} />
    {/snippet}

    {#snippet children()}
      <div class="mixer">
        {#each STRIPS as strip (strip.id)}
          <ChannelStrip
            id={strip.id}
            label={strip.label}
            value={view.levels[strip.id]}
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
        soundMode={view.soundMode}
        onPlay={() => void session.play()}
        onPause={() => session.pause()}
        onRecord={() => void toggleRecording()}
        onMaster={(value) => session.setMaster(value)}
        onToggleMuteAll={() => session.toggleMuteAll()}
        onToggleFreeze={() => session.toggleFreeze()}
        onSoundMode={(mode) => session.setSoundMode(mode)}
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
