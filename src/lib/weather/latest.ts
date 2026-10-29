export function latestOnly<T>(): (run: () => Promise<T>) => Promise<T | null> {
  const seq = sequence()
  return (run) => {
    const mine = seq.next()
    return run().then((value) => (mine === seq.current() ? value : null))
  }
}

export interface LatestResult<T> {
  value: T
  fresh: boolean
}

export function latestResult<T>(): (run: () => Promise<T>) => Promise<LatestResult<T>> {
  const seq = sequence()
  return (run) => {
    const mine = seq.next()
    return run().then((value) => ({ value, fresh: mine === seq.current() }))
  }
}

function sequence(): { next(): number; current(): number } {
  let value = 0
  return {
    next: () => (value += 1),
    current: () => value,
  }
}
