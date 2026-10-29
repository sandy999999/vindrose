export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function norm(value: number, min: number, max: number): number {
  if (max === min) return 0
  return clamp((value - min) / (max - min), 0, 1)
}

export function expSmooth(
  current: number,
  target: number,
  dtSeconds: number,
  tauSeconds: number,
): number {
  if (tauSeconds <= 0) return target
  const alpha = 1 - Math.exp(-dtSeconds / tauSeconds)
  return current + (target - current) * alpha
}
