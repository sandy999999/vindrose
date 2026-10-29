<script lang="ts">
  import type { ChannelId } from '../audio/engine'

  interface Props {
    id: ChannelId
    label: string
    value: number
    gain: number
    muted: boolean
    onGain: (value: number) => void
    onToggleMute: () => void
  }

  let { id, label, value, gain, muted, onGain, onToggleMute }: Props = $props()

  const NAMES: Record<ChannelId, string> = {
    wind: 'Wind',
    gust: 'Gust',
    rain: 'Rain',
    pressure: 'Pressure',
    humidity: 'Humidity',
    temperature: 'Temperature',
  }

  function stop(event: Event): void {
    event.stopPropagation()
  }
</script>

<div class="strip">
  <button
    type="button"
    class="mute"
    class:on={muted}
    aria-pressed={muted}
    aria-label={`Mute ${NAMES[id]}`}
    title={`Mute ${NAMES[id].toLowerCase()}`}
    onclick={onToggleMute}
    onpointerdown={stop}
  >
    <span class="dot"></span>
  </button>

  <div class="rail">
    <div class="fader">
      <input
        type="range"
        min="0"
        max="1.5"
        step="0.05"
        value={gain}
        aria-label={`${NAMES[id]} channel gain`}
        oninput={(event) => onGain(Number(event.currentTarget.value))}
        onpointerdown={stop}
        onpointermove={stop}
      />
    </div>

    <div class="meter" aria-hidden="true">
      <span style:height={`${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`}></span>
    </div>
  </div>

  <span class="label">{label}</span>
</div>

<style>
  .strip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .mute {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--sand-dark);
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
  }

  .mute .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--sage-dark);
    opacity: 0.45;
  }

  .mute.on {
    border-color: var(--forest);
    background: var(--forest);
  }

  .mute.on .dot {
    background: var(--parchment);
    opacity: 1;
  }

  .rail {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }

  .fader {
    position: relative;
    width: 26px;
    height: 84px;
  }

  .fader input {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 84px;
    height: 26px;
    margin: 0;
    transform: translate(-50%, -50%) rotate(-90deg);
    accent-color: var(--forest);
    cursor: pointer;
    touch-action: none;
  }

  .meter {
    position: relative;
    width: 3px;
    height: 84px;
    border-radius: 2px;
    background: var(--sand);
    overflow: hidden;
  }

  .meter span {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--sage-dark);
    transition: height 600ms linear;
  }

  .label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    color: var(--forest-muted);
  }

  @media (min-width: 900px) {
    .fader,
    .meter {
      height: 136px;
    }

    .fader input {
      width: 136px;
    }
  }
</style>
