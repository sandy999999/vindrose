import { encodeWav, toInt16 } from './wav'

export const MAX_RECORD_SECONDS = 600

interface CaptureMessage {
  left: Float32Array
  right: Float32Array
}

export class Recorder {
  onLimit: (() => void) | null = null

  private readonly chunks: Int16Array[] = []
  private frames = 0
  private startedAt = 0
  private recording = false

  private constructor(
    private readonly ctx: AudioContext,
    private readonly node: AudioWorkletNode,
  ) {
    this.node.port.onmessage = (event: MessageEvent<CaptureMessage>) => {
      this.push(event.data)
    }
  }

  static async create(ctx: AudioContext, input: AudioNode): Promise<Recorder> {
    await ctx.audioWorklet.addModule(new URL('./worklet/pcm-capture.js', import.meta.url))

    const node = new AudioWorkletNode(ctx, 'pcm-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      channelCount: 2,
      channelCountMode: 'explicit',
    })

    const silence = ctx.createGain()
    silence.gain.value = 0

    input.connect(node)
    node.connect(silence)
    silence.connect(ctx.destination)

    return new Recorder(ctx, node)
  }

  get isRecording(): boolean {
    return this.recording
  }

  get elapsed(): number {
    if (!this.recording) return 0
    return this.ctx.currentTime - this.startedAt
  }

  start(): void {
    this.chunks.length = 0
    this.frames = 0
    this.startedAt = this.ctx.currentTime
    this.recording = true
  }

  stop(): { blob: Blob; durationSec: number } {
    this.recording = false
    return {
      blob: encodeWav(this.chunks, this.ctx.sampleRate, 2),
      durationSec: this.frames / this.ctx.sampleRate,
    }
  }

  private push(message: CaptureMessage): void {
    if (!this.recording) return

    const { left, right } = message
    const frames = Math.min(left.length, right.length)
    const interleaved = new Int16Array(frames * 2)
    for (let i = 0; i < frames; i += 1) {
      interleaved[i * 2] = toInt16(left[i] ?? 0)
      interleaved[i * 2 + 1] = toInt16(right[i] ?? 0)
    }

    this.chunks.push(interleaved)
    this.frames += frames

    if (this.frames / this.ctx.sampleRate >= MAX_RECORD_SECONDS) {
      this.recording = false
      this.onLimit?.()
    }
  }
}
