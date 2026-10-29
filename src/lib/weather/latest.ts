export function latestOnly<T>(): (run: () => Promise<T>) => Promise<T | null> {
  let newest = 0
  return (run) => {
    newest += 1
    const mine = newest
    return run().then((value) => (mine === newest ? value : null))
  }
}
