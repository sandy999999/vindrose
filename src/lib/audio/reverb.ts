export interface Reverb {
  input: GainNode
  output: GainNode
  setWet(wet: number, preDelay: number): void
}

function createImpulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)

  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    let lowpassed = 0
    for (let i = 0; i < length; i += 1) {
      const progress = i / length
      const decay = Math.pow(1 - progress, 2.2)
      const white = Math.random() * 2 - 1
      lowpassed = lowpassed * 0.7 + white * 0.3
      data[i] = lowpassed * decay
    }
  }

  return buffer
}

export function createReverb(ctx: AudioContext): Reverb {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  dry.gain.value = 0.85

  const preDelay = ctx.createDelay(0.2)
  preDelay.delayTime.value = 0.02

  const convolver = ctx.createConvolver()
  convolver.buffer = createImpulse(ctx, 2.8)

  const wet = ctx.createGain()
  wet.gain.value = 0.3

  input.connect(dry)
  dry.connect(output)
  input.connect(preDelay)
  preDelay.connect(convolver)
  convolver.connect(wet)
  wet.connect(output)

  return {
    input,
    output,
    setWet(wetLevel: number, delay: number): void {
      const now = ctx.currentTime
      preDelay.delayTime.setTargetAtTime(delay, now, 0.1)
      wet.gain.setTargetAtTime(wetLevel, now, 0.3)
      dry.gain.setTargetAtTime(1 - wetLevel * 0.5, now, 0.3)
    },
  }
}
