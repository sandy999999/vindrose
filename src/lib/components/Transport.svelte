<script lang="ts">
  interface Props {
    playing: boolean
    recording: boolean
    elapsed: number
    master: number
    frozen: boolean
    allMuted: boolean
    onPlay: () => void
    onPause: () => void
    onRecord: () => void
    onMaster: (value: number) => void
    onToggleMuteAll: () => void
    onToggleFreeze: () => void
  }

  let {
    playing,
    recording,
    elapsed,
    master,
    frozen,
    allMuted,
    onPlay,
    onPause,
    onRecord,
    onMaster,
    onToggleMuteAll,
    onToggleFreeze,
  }: Props = $props()

  function clock(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds))
    const minutes = Math.floor(total / 60)
    const rest = total % 60
    return `${minutes}:${String(rest).padStart(2, '0')}`
  }
</script>

<div class="transport">
  <div class="row">
    <button
      type="button"
      class="primary"
      aria-label={playing ? 'Pause' : 'Play'}
      title={playing ? 'Pause' : 'Play'}
      onclick={() => (playing ? onPause() : onPlay())}
    >
      {#if playing}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="4" y="3" width="3" height="10" fill="currentColor" />
          <rect x="9" y="3" width="3" height="10" fill="currentColor" />
        </svg>
      {:else}
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 3.5v9l8-4.5z" fill="currentColor" />
        </svg>
      {/if}
    </button>

    <button
      type="button"
      class="record"
      class:recording
      disabled={!playing && !recording}
      aria-label={recording ? 'Stop recording' : 'Record'}
      title={!playing && !recording ? 'start the sound first' : undefined}
      onclick={onRecord}
    >
      <span class="disc"></span>
      <span class="clock">{clock(elapsed)}</span>
    </button>

    <div class="spacer"></div>

    <button
      type="button"
      class="toggle"
      class:on={allMuted}
      aria-pressed={allMuted}
      title="Mute all channels"
      onclick={onToggleMuteAll}
    >
      mute
    </button>

    <button
      type="button"
      class="toggle"
      class:on={frozen}
      aria-pressed={frozen}
      title="Freeze weather events; the bed keeps playing"
      onclick={onToggleFreeze}
    >
      freeze
    </button>
  </div>

  <label class="master">
    <span>master</span>
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={master}
      aria-label="Master volume"
      oninput={(event) => onMaster(Number(event.currentTarget.value))}
    />
  </label>
</div>

<style>
  .transport {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--sand-dark);
    --record: #a8452f;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .spacer {
    flex: 1 1 auto;
  }

  .primary,
  .record,
  .toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid var(--sand-dark);
    border-radius: 999px;
    background: var(--cream-bright);
    color: var(--forest);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    cursor: pointer;
  }

  .primary {
    width: 44px;
    padding: 0;
    border-color: var(--forest);
    background: var(--forest);
    color: var(--cream-bright);
  }

  .primary svg {
    width: 16px;
    height: 16px;
  }

  .record:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .disc {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 1.5px solid var(--record);
    background: transparent;
  }

  .record.recording .disc {
    background: var(--record);
    animation: pulse 1.4s ease-in-out infinite;
  }

  .clock {
    color: var(--forest-muted);
    font-variant-numeric: tabular-nums;
  }

  .record.recording {
    border-color: var(--record);
    color: var(--record);
  }

  .record.recording .clock {
    color: var(--record);
  }

  .toggle.on {
    border-color: var(--forest);
    background: var(--forest);
    color: var(--cream-bright);
  }

  .master {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--forest-muted);
  }

  .master input {
    flex: 1 1 auto;
    accent-color: var(--forest);
  }

  @keyframes pulse {
    50% {
      opacity: 0.35;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .record.recording .disc {
      animation: none;
    }
  }
</style>
