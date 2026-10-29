<script lang="ts">
  interface Props {
    message: string | null
    onDismiss?: () => void
  }

  let { message, onDismiss }: Props = $props()

  const DURATION_MS = 3500

  $effect(() => {
    if (!message) return
    const timer = setTimeout(() => onDismiss?.(), DURATION_MS)
    return () => clearTimeout(timer)
  })
</script>

{#if message}
  <div class="toast" role="status" aria-live="polite">{message}</div>
{/if}

<style>
  .toast {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(112px + env(safe-area-inset-bottom));
    z-index: 30;
    padding: 12px 16px;
    border: 1px solid var(--forest-muted);
    border-radius: 12px;
    background: var(--forest);
    color: var(--cream-bright);
    font-family: var(--font-mono);
    font-size: 12px;
    letter-spacing: 0.03em;
    text-align: center;
  }

  @media (min-width: 900px) {
    .toast {
      left: auto;
      right: calc(38% + 24px);
      bottom: 24px;
      max-width: 320px;
    }
  }
</style>
