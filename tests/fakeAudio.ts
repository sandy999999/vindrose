export class FakeParam {
  readonly calls: Array<{ method: string; value: number; time: number }> = []

  constructor(public value = 0) {}

  setValueAtTime(value: number, time: number): FakeParam {
    return this.record('setValueAtTime', value, time)
  }

  setTargetAtTime(value: number, time: number, _tau?: number): FakeParam {
    return this.record('setTargetAtTime', value, time)
  }

  linearRampToValueAtTime(value: number, time: number): FakeParam {
    return this.record('linearRamp', value, time)
  }

  exponentialRampToValueAtTime(value: number, time: number): FakeParam {
    return this.record('exponentialRamp', value, time)
  }

  cancelScheduledValues(time: number): FakeParam {
    return this.record('cancel', this.value, time)
  }

  private record(method: string, value: number, time: number): FakeParam {
    this.value = value
    this.calls.push({ method, value, time })
    return this
  }
}

export class FakeNode {
  readonly connections: unknown[] = []

  connect(destination: unknown): unknown {
    this.connections.push(destination)
    return destination
  }

  disconnect(): void {
    this.connections.length = 0
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1)
}

class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam(-24)
  readonly knee = new FakeParam(30)
  readonly ratio = new FakeParam(12)
  readonly attack = new FakeParam(0.003)
  readonly release = new FakeParam(0.25)
}

class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam(0)
}

class FakeConvolver extends FakeNode {
  buffer: unknown = null
}

class FakeBiquad extends FakeNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new FakeParam(350)
  readonly Q = new FakeParam(1)
  readonly gain = new FakeParam(0)
}

class FakePanner extends FakeNode {
  readonly pan = new FakeParam(0)
}

class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null
  loop = false
  onended: (() => void) | null = null
  startedAt: number | null = null
  stoppedAt: number | null = null

  start(when = 0): void {
    this.startedAt = when
  }

  stop(when = 0): void {
    this.stoppedAt = when
  }
}

class FakeOscillator extends FakeNode {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeParam(440)
  readonly detune = new FakeParam(0)
  onended: (() => void) | null = null
  startedAt: number | null = null

  start(when = 0): void {
    this.startedAt = when
  }

  stop(): void {
    /* the fake runs no clock */
  }
}

export class FakeBuffer {
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {}

  getChannelData(): Float32Array {
    return new Float32Array(this.length)
  }
}

export class FakeAudioContext {
  readonly sampleRate = 8000
  currentTime = 0
  state: AudioContextState = 'suspended'
  readonly destination = new FakeNode()
  readonly created = {
    gains: [] as FakeGain[],
    biquads: [] as FakeBiquad[],
    delays: [] as FakeDelay[],
    oscs: [] as FakeOscillator[],
    sources: [] as FakeSource[],
    panners: [] as FakePanner[],
  }
  suspensions = 0
  resumptions = 0

  async resume(): Promise<void> {
    this.state = 'running'
    this.resumptions += 1
  }

  async suspend(): Promise<void> {
    this.state = 'suspended'
    this.suspensions += 1
  }

  createGain(): FakeGain {
    const node = new FakeGain()
    this.created.gains.push(node)
    return node
  }

  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor()
  }

  createDelay(): FakeDelay {
    const node = new FakeDelay()
    this.created.delays.push(node)
    return node
  }

  createConvolver(): FakeConvolver {
    return new FakeConvolver()
  }

  createBiquadFilter(): FakeBiquad {
    const node = new FakeBiquad()
    this.created.biquads.push(node)
    return node
  }

  createStereoPanner(): FakePanner {
    const node = new FakePanner()
    this.created.panners.push(node)
    return node
  }

  createBufferSource(): FakeSource {
    const node = new FakeSource()
    this.created.sources.push(node)
    return node
  }

  createOscillator(): FakeOscillator {
    const node = new FakeOscillator()
    this.created.oscs.push(node)
    return node
  }

  createBuffer(channels: number, length: number, sampleRate: number): FakeBuffer {
    return new FakeBuffer(channels, length, sampleRate)
  }
}

export function asCtx(fake: FakeAudioContext): AudioContext {
  return fake as unknown as AudioContext
}
