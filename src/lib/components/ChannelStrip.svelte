<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { ChannelId } from '../audio/engine'
  import type { TimbreName, TimbreOption } from '../audio/timbres'

  interface Props {
    id: ChannelId
    label: string
    value: number
    gain: number
    muted: boolean
    timbre: TimbreName
    timbreOptions: TimbreOption[]
    onGain: (value: number) => void
    onToggleMute: () => void
    onNextTimbre: () => void
    onPickTimbre: (name: TimbreName) => void
  }

  let {
    id,
    label,
    value,
    gain,
    muted,
    timbre,
    timbreOptions,
    onGain,
    onToggleMute,
    onNextTimbre,
    onPickTimbre,
  }: Props = $props()

  const HOLD_MS = 500

  const NAMES: Record<ChannelId, string> = {
    wind: 'Wind',
    gust: 'Gust',
    rain: 'Rain',
    pressure: 'Pressure',
    humidity: 'Humidity',
    temperature: 'Temperature',
  }

  let menuOpen = $state(false)
  let held = false
  let pressTimer: ReturnType<typeof setTimeout> | null = null

  const current = $derived(
    timbreOptions.find((option) => option.name === timbre) ?? timbreOptions[0],
  )

  function clearPress(): void {
    if (pressTimer !== null) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  function startPress(): void {
    clearPress()
    held = false
    pressTimer = setTimeout(() => {
      pressTimer = null
      held = true
      menuOpen = true
    }, HOLD_MS)
  }

  function endPress(): void {
    clearPress()
    if (held) {
      held = false
      return
    }
    onNextTimbre()
  }

  function cancelPress(): void {
    clearPress()
    held = false
  }

  function pick(name: TimbreName): void {
    menuOpen = false
    onPickTimbre(name)
  }

  function stop(event: Event): void {
    event.stopPropagation()
  }

  onDestroy(clearPress)

  $effect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') menuOpen = false
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
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

  <button
    type="button"
    class="timbre"
    aria-haspopup="dialog"
    aria-expanded={menuOpen}
    aria-label={`${NAMES[id]} timbre: ${current?.label ?? timbre}. Tap to cycle, hold to choose`}
    title={`${current?.label ?? timbre} · tap to cycle, hold for all`}
    onpointerdown={startPress}
    onpointerup={endPress}
    onpointerleave={cancelPress}
    onpointercancel={cancelPress}
    oncontextmenu={(event) => event.preventDefault()}
    onclick={(event) => {
      if (event.detail === 0) onNextTimbre()
    }}
  >
    {current?.label ?? timbre}
  </button>

  <span class="label">{label}</span>
</div>

{#if menuOpen}
  <div class="menu-layer">
    <button
      type="button"
      class="backdrop"
      aria-label="Close timbre menu"
      onclick={() => (menuOpen = false)}
    ></button>
    <div class="menu" role="dialog" aria-label={`${NAMES[id]} timbre`}>
      <span class="menu-title">{NAMES[id]}</span>
      {#each timbreOptions as option (option.name)}
        <button
          type="button"
          class:active={option.name === timbre}
          aria-pressed={option.name === timbre}
          onclick={() => pick(option.name)}
        >
          {option.label}
        </button>
      {/each}
    </div>
  </div>
{/if}

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

  .timbre {
    max-width: 100%;
    padding: 2px 5px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.04em;
    color: var(--sage-dark);
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    cursor: pointer;
    touch-action: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .timbre:hover,
  .timbre:focus-visible {
    background: var(--sand);
    color: var(--forest);
  }

  .label {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    color: var(--forest-muted);
  }

  .menu-layer {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0 16px 28px;
    background: rgba(34, 37, 20, 0.28);
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    padding: 0;
    background: transparent;
    cursor: default;
  }

  .menu {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 200px;
    padding: 10px;
    background: var(--parchment);
    border: 1px solid var(--sand-dark);
    border-radius: 14px;
    box-shadow: 0 16px 40px rgba(34, 37, 20, 0.2);
  }

  .menu-title {
    padding: 2px 10px 6px;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--forest-muted);
  }

  .menu button {
    padding: 9px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    font-family: inherit;
    font-size: 14px;
    text-align: left;
    color: var(--forest);
    cursor: pointer;
  }

  .menu button:hover {
    background: var(--sand);
  }

  .menu button.active {
    background: var(--forest);
    color: var(--parchment);
  }

  @media (min-width: 900px) {
    .fader,
    .meter {
      height: 136px;
    }

    .fader input {
      width: 136px;
    }

    .menu-layer {
      align-items: center;
    }
  }
</style>
