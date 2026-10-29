<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { clamp } from '../domain/units'

  type Snap = 0 | 1 | 2

  interface Props {
    onSnap?: (snap: Snap) => void
    header: Snippet
    children?: Snippet
  }

  let { onSnap, header, children }: Props = $props()

  const PEEK_PX = 96
  const HALF_RATIO = 0.42
  const FULL_RATIO = 0.88
  const SNAP_NAMES = ['Collapsed', 'Half', 'Expanded']

  let viewportHeight = $state(844)
  let desktop = $state(false)
  let snap = $state<Snap>(0)
  let height = $state(PEEK_PX)
  let dragging = $state(false)

  let startY = 0
  let startHeight = 0
  let pointerId: number | null = null

  function snapHeights(): [number, number, number] {
    return [PEEK_PX, viewportHeight * HALF_RATIO, viewportHeight * FULL_RATIO]
  }

  function applySnap(index: Snap): void {
    snap = index
    height = snapHeights()[index]
    onSnap?.(index)
  }

  function onHandleKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      applySnap(Math.min(2, snap + 1) as Snap)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      applySnap(Math.max(0, snap - 1) as Snap)
    } else if (event.key === 'Home') {
      event.preventDefault()
      applySnap(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      applySnap(2)
    }
  }

  function beginDrag(event: PointerEvent): void {
    if (desktop) return
    const target = event.target as HTMLElement
    if (target.closest('button, input, a, select, textarea, [data-no-drag]')) return

    pointerId = event.pointerId
    startY = event.clientY
    startHeight = height
    dragging = true
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent): void {
    if (!dragging || event.pointerId !== pointerId) return
    const next = startHeight + (startY - event.clientY)
    height = clamp(next, PEEK_PX, snapHeights()[2])
  }

  function endDrag(event: PointerEvent): void {
    if (!dragging || event.pointerId !== pointerId) return
    dragging = false
    pointerId = null

    const heights = snapHeights()
    let nearest: Snap = 0
    let nearestDistance = Infinity
    heights.forEach((candidate, index) => {
      const distance = Math.abs(height - candidate)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = index as Snap
      }
    })
    applySnap(nearest)
  }

  onMount(() => {
    const query = window.matchMedia('(min-width: 900px)')
    const update = (): void => {
      viewportHeight = window.innerHeight
      desktop = query.matches
      if (!desktop) {
        height = snapHeights()[snap]
      }
    }
    update()
    query.addEventListener('change', update)
    window.addEventListener('resize', update)
    return () => {
      query.removeEventListener('change', update)
      window.removeEventListener('resize', update)
    }
  })
</script>

<section
  class="sheet"
  class:dragging
  class:desktop
  data-snap={snap}
  style:height={desktop ? '100%' : `${height}px`}
  aria-label="Weather and sound controls"
>
  <!-- A focusable separator with aria-valuenow is the ARIA resize-widget
       pattern; Svelte's linter still treats the role as non-interactive. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="handle"
    role="separator"
    tabindex="0"
    aria-orientation="horizontal"
    aria-label="Panel height"
    aria-valuemin="0"
    aria-valuemax="2"
    aria-valuenow={snap}
    aria-valuetext={SNAP_NAMES[snap]}
    onkeydown={onHandleKey}
    onpointerdown={beginDrag}
    onpointermove={moveDrag}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  >
    <span class="grip"></span>
  </div>

  <div
    class="header"
    role="presentation"
    onpointerdown={beginDrag}
    onpointermove={moveDrag}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  >
    {@render header()}
  </div>

  <div class="body">
    {#if children}{@render children()}{/if}
  </div>
</section>

<style>
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    background: var(--parchment);
    border-top: 1px solid var(--sand-dark);
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -12px 32px rgba(34, 37, 20, 0.14);
    overflow: hidden;
    transition: height 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
  }

  .sheet.dragging {
    transition: none;
  }

  .handle {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 18px;
    padding-top: 6px;
    touch-action: none;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
  }

  .grip {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--sand-dark);
  }

  .header {
    flex: 0 0 auto;
    padding: 0 18px 10px;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
  }

  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 18px calc(18px + env(safe-area-inset-bottom));
  }

  .sheet.dragging .handle,
  .sheet.dragging .header {
    cursor: grabbing;
  }

  @media (max-width: 899px) {
    .sheet[data-snap='0'] .header :global(.chips) {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet {
      transition: none;
    }
  }

  @media (min-width: 900px) {
    .sheet.desktop {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: auto;
      width: 38%;
      border-top: 0;
      border-left: 1px solid var(--sand-dark);
      border-radius: 0;
      box-shadow: none;
      transition: none;
    }

    .sheet.desktop .handle {
      display: none;
    }

    .sheet.desktop .header {
      padding: 24px 24px 12px;
      cursor: default;
    }

    .sheet.desktop .body {
      padding: 0 24px calc(24px + env(safe-area-inset-bottom));
    }
  }
</style>
