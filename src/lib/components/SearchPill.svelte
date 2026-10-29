<script lang="ts">
  import { onMount } from 'svelte'
  import { searchPlaces, type Place } from '../weather/photon'

  interface Props {
    onSelect: (place: Place) => void
  }

  let { onSelect }: Props = $props()

  const DEBOUNCE_MS = 300
  const MIN_QUERY = 2

  let query = $state('')
  let results = $state<Place[]>([])
  let open = $state(false)
  let empty = $state(false)
  let active = $state(-1)
  let root: HTMLDivElement

  let timer: ReturnType<typeof setTimeout> | null = null
  let controller: AbortController | null = null
  const cache = new Map<string, Place[]>()

  function cancel(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    controller?.abort()
    controller = null
  }

  function onInput(): void {
    cancel()
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY) {
      results = []
      empty = false
      open = false
      active = -1
      return
    }
    timer = setTimeout(() => {
      void run(trimmed)
    }, DEBOUNCE_MS)
  }

  async function run(term: string): Promise<void> {
    const key = term.toLowerCase()
    const cached = cache.get(key)
    if (cached) {
      results = cached
      empty = cached.length === 0
      open = true
      return
    }

    controller = new AbortController()
    try {
      const found = await searchPlaces(term, controller.signal)
      cache.set(key, found)
      results = found
      empty = found.length === 0
      open = true
      active = -1
    } catch {
      // An aborted request is superseded; a failed one leaves the last list.
    }
  }

  function choose(place: Place): void {
    cancel()
    query = place.name
    results = []
    empty = false
    open = false
    active = -1
    onSelect(place)
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      open = false
      return
    }
    if (!open || results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      active = (active + 1) % results.length
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      active = (active - 1 + results.length) % results.length
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      const place = results[active]
      if (place) choose(place)
    }
  }

  function onOutside(event: PointerEvent): void {
    if (open && !root.contains(event.target as Node)) {
      open = false
    }
  }

  onMount(() => () => cancel())
</script>

<svelte:window onpointerdown={onOutside} />

<div class="search" bind:this={root} role="search">
  <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
    <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" />
  </svg>
  <input
    type="search"
    role="combobox"
    placeholder="search place or station"
    aria-label="Search place or station"
    aria-expanded={open}
    aria-controls="search-results"
    autocomplete="off"
    spellcheck="false"
    bind:value={query}
    oninput={onInput}
    onkeydown={onKeydown}
    onfocus={() => {
      if (results.length > 0 || empty) open = true
    }}
  />

  {#if open && (results.length > 0 || empty)}
    <ul id="search-results" role="listbox" aria-label="Search results">
      {#each results as place, index (place.lat + ':' + place.lon + ':' + index)}
        <li
          role="option"
          aria-selected={index === active}
          class:active={index === active}
        >
          <button type="button" onclick={() => choose(place)} onpointerenter={() => (active = index)}>
            <span class="name">{place.name}</span>
            {#if place.country}<span class="country">{place.country}</span>{/if}
          </button>
        </li>
      {/each}
      {#if empty}
        <li class="empty" role="presentation">No places found</li>
      {/if}
    </ul>
  {/if}
</div>

<style>
  .search {
    position: relative;
    width: 100%;
  }

  .icon {
    position: absolute;
    left: 14px;
    top: 50%;
    width: 16px;
    height: 16px;
    transform: translateY(-50%);
    color: var(--forest-muted);
    pointer-events: none;
  }

  input {
    width: 100%;
    height: 44px;
    padding: 0 16px 0 38px;
    border: 1px solid var(--sand-dark);
    border-radius: 999px;
    background: var(--cream-bright);
    color: var(--forest);
    font-family: var(--font-mono);
    font-size: 13px;
    letter-spacing: 0.02em;
    outline: none;
    appearance: none;
  }

  input::placeholder {
    color: var(--forest-muted);
    opacity: 0.7;
  }

  input:focus {
    border-color: var(--sage-dark);
    box-shadow: 0 0 0 3px rgba(146, 164, 148, 0.22);
  }

  input::-webkit-search-cancel-button {
    appearance: none;
  }

  ul {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    margin: 0;
    padding: 4px;
    list-style: none;
    background: var(--cream-bright);
    border: 1px solid var(--sand-dark);
    border-radius: 14px;
    overflow: hidden;
    z-index: 20;
  }

  li button {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    padding: 10px 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--forest);
    text-align: left;
    cursor: pointer;
  }

  li.active button,
  li button:hover {
    background: var(--sand);
  }

  .name {
    font-size: 14px;
  }

  .country {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--forest-muted);
    white-space: nowrap;
  }

  .empty {
    padding: 12px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    color: var(--forest-muted);
  }
</style>
