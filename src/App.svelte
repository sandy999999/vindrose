<script lang="ts">
  const swatches = [
    { name: 'parchment', value: 'var(--parchment)' },
    { name: 'sage', value: 'var(--sage)' },
    { name: 'sand', value: 'var(--sand)' },
    { name: 'cream', value: 'var(--cream)' },
    { name: 'forest', value: 'var(--forest)' },
    { name: 'sage-dark', value: 'var(--sage-dark)' },
  ]
</script>

<main>
  <h1>Vindrose</h1>
  <p>Weather, sonified.</p>
  <ul>
    {#each swatches as swatch}
      <li style:background={swatch.value}>{swatch.name}</li>
    {/each}
  </ul>
</main>

<style>
  main {
    min-height: 100%;
    padding: 32px;
  }
  h1 {
    font-family: var(--font-mono);
    font-size: 22px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin: 0 0 6px;
  }
  p {
    margin: 0 0 24px;
    color: var(--forest-muted);
  }
  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    width: 120px;
    height: 80px;
    border: 1px solid var(--sand-dark);
    border-radius: 8px;
    display: flex;
    align-items: flex-end;
    padding: 8px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--cream);
  }
</style>
