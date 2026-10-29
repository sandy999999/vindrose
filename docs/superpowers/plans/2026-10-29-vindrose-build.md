# Vindrose Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone-first web instrument that turns live weather at any searched location into a generative ambient stream, with per-channel mixing and WAV recording.

**Architecture:** A Svelte 5 single-page app with three layers. Pure domain modules map weather readings to channel targets, a raw Web Audio engine renders six instrument channels against a clock plus event layer, and a thin session store wires polling, smoothing and UI state. The map and bottom sheet are presentation only.

**Tech Stack:** Svelte 5 + Vite + TypeScript, MapLibre GL JS with OpenFreeMap tiles, Photon geocoding, Open-Meteo weather, raw Web Audio API, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-weather-sonification-design.md`

## Global Constraints

- TypeScript strict, no `any`, no non-null assertions in application code.
- Files under 500 lines. Cognitive complexity under 22 per function.
- No backend, no analytics, no cookies, no API keys. Open-Meteo, Photon and OpenFreeMap only.
- Palette: parchment `#e8e5db`, forest `#222514`, sage `#c4d1c6`, sage-dark `#92a494`, sand `#e4d9c5`, cream `#eeeada`.
- Audio: 44.1 kHz, 16 bit, stereo WAV. Hard stop at 10 minutes.
- Voice budget: 48 concurrent grains, 12 short events per second.
- Tempo 56 BPM. Key D Dorian, roots D, C, G, A.
- Poll weather every 5 minutes and on every new place.
- Required browsers: iOS Safari 16+, Android Chrome, desktop Chrome and Safari. Firefox best effort.
- Errors surface as structured values, never swallowed.

## Review Focus

- **Weather API fails or goes offline mid-session:** the last reading must stay in use, a stale marker must appear, and audio must keep playing.
- **Place chosen before or without play:** the audio context must resume on the play gesture, and choosing a place must not throw when the engine is stopped.
- **Place switched while recording:** recording must continue and the file name must keep the starting place.
- **Fast typing and out-of-order geocoder responses:** a slow earlier response must never replace a newer result.
- **Sheet dragging with a finger on a fader or scroll area:** dragging a control must not move the sheet, and dragging the sheet must not change a fader.

## File Structure

```
vindrose/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/
    main.ts
    App.svelte
    lib/
      design/tokens.css
      design/base.css
      domain/units.ts
      domain/types.ts
      domain/mapping.ts
      domain/harmony.ts
      domain/events.ts
      weather/openMeteo.ts
      weather/photon.ts
      weather/latest.ts
      audio/engine.ts
      audio/scheduler.ts
      audio/reverb.ts
      audio/recorder.ts
      audio/wav.ts
      audio/timbres.ts
      audio/channels/wind.ts
      audio/channels/gust.ts
      audio/channels/rain.ts
      audio/channels/pressure.ts
      audio/channels/humidity.ts
      audio/channels/temperature.ts
      audio/worklet/pcm-capture.js
      stores/session.svelte.ts
      stores/persistence.ts
      components/MapDeck.svelte
      components/SearchPill.svelte
      components/BottomSheet.svelte
      components/WeatherHeader.svelte
      components/ParameterChips.svelte
      components/ChannelStrip.svelte
      components/Transport.svelte
      components/LiveTrace.svelte
      components/Toast.svelte
  tests/
    units.test.ts
    mapping.test.ts
    harmony.test.ts
    events.test.ts
    openMeteo.test.ts
    photon.test.ts
    latest.test.ts
    scheduler.test.ts
    wav.test.ts
    session.test.ts
```

---

### Task 1: Scaffold, design tokens, test harness

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/App.svelte`, `src/lib/design/tokens.css`, `src/lib/design/base.css`
- Test: `tests/units.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run dev`, `npm run build`, `npm test` working; CSS custom properties `--parchment`, `--forest`, `--sage`, `--sage-dark`, `--sand`, `--cream`, `--font-mono`, `--font-body`.

- [ ] **Step 1: Scaffold the app**

Run: `npm create vite@latest . -- --template svelte-ts`, then `npm install` and `npm install -D vitest`. Set `test: { environment: 'node' }` in `vite.config.ts` and `"test": "vitest run"` in package.json. Enable `strict` and `noUncheckedIndexedAccess` in tsconfig.

- [ ] **Step 2: Write the design tokens**

Create `src/lib/design/tokens.css` with the six palette variables exactly as listed in Global Constraints, plus `--font-mono: 'ModernDOS', ui-monospace, monospace` and `--font-body: ui-sans-serif, system-ui, sans-serif`. Copy `../label-templates/fonts/ModernDOS8x16.ttf` into `public/fonts/` and declare it with `@font-face` in `base.css`.

- [ ] **Step 3: Write a failing smoke test**

```ts
import { describe, it, expect } from 'vitest'
import { clamp } from '../src/lib/domain/units'

describe('units', () => {
  it('clamps to range', () => {
    expect(clamp(12, 0, 10)).toBe(10)
  })
})
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npm test`
Expected: FAIL, cannot resolve `../src/lib/domain/units`.

- [ ] **Step 5: Create `units.ts` with `clamp` only**

```ts
export function clamp(value: number, min: number, max: number): number
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold svelte app with design tokens"
```

---

### Task 2: Domain mapping, harmony and event detection

**Files:**
- Create: `src/lib/domain/types.ts`, `src/lib/domain/units.ts`, `src/lib/domain/mapping.ts`, `src/lib/domain/harmony.ts`, `src/lib/domain/events.ts`
- Test: `tests/units.test.ts`, `tests/mapping.test.ts`, `tests/harmony.test.ts`, `tests/events.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface WeatherReading { time: string; windSpeed: number; windGust: number; windDirection: number; temperature: number; humidity: number; pressure: number; precipitation: number; cloudCover: number; weatherCode: number }`
  - `clamp(n, min, max): number`, `norm(value, min, max): number` (0 to 1, clamped), `expSmooth(current, target, dtSeconds, tauSeconds): number`
  - `interface ChannelTargets { wind: { level: number; cutoff: number; pan: number }; gust: { level: number }; rain: { level: number; density: number }; pressure: { level: number; index: number }; humidity: { level: number; cutoff: number }; temperature: { level: number; partials: number }; reverb: { wet: number; preDelay: number } }`
  - `mapWeather(r: WeatherReading, pressureTendency: number): ChannelTargets`
  - `interface AudioEvent` union, `detectEvents(prev: WeatherReading | null, next: WeatherReading, tendency: number, nowMs: number, state: EventState): AudioEvent[]`
  - `quantizeToScale(midi: number): number`, `rootForPressure(pressure: number): number`

- [ ] **Step 1: Write failing tests for units, mapping, harmony and events**

Tests must pin these exact values:

```ts
norm(5, 0, 10) === 0.5
norm(20, 0, 10) === 1
expSmooth(0, 10, 20, 20) ≈ 6.321   // 10 * (1 - e^-1)
mapWeather(zeroReading, 0).wind.level === 0
mapWeather(maxReading, 0).wind.level === 1
mapWeather(maxReading, 0).rain.level === 1
mapWeather(calmReading, 0).reverb.wet === 0.15
mapWeather(overcastReading, 0).reverb.wet === 0.65
quantizeToScale(61) is a pitch class in D Dorian
rootForPressure(990) === 45  // A2
rootForPressure(1025) === 36 // C2
detectEvents(null, reading, 0, 1000, freshState) === []
detectEvents(calm, windy, 0, 1000, freshState) has one 'gust-burst'
detectEvents(calm, windy, 0, 1001, stateJustFiredGust) === []  // 1.5 s rate limit
```

Define the fixtures in the test file: `zeroReading` has every numeric field 0 except `windSpeed: 0`, `pressure: 1013`, `temperature: 0`, `humidity: 0`, `cloudCover: 0`. `calmReading` is `{ ...zeroReading, windSpeed: 3, windGust: 3 }`. `overcastReading` is `{ ...zeroReading, cloudCover: 100 }`. `maxReading` has wind 25, precip 10, humidity 100, temp 30, cloud 100. `windy` is `{ ...calmReading, windGust: 12 }`.

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the four modules**

Mapping rules, exact:

```ts
wind.level = Math.sqrt(norm(windSpeed, 0, 25))
wind.cutoff = 200 + 1000 * norm(windSpeed, 0, 25)
wind.pan = Math.sin((windDirection * Math.PI) / 180) * 0.8
gust.level = Math.sqrt(norm(windGust - windSpeed, 0, 15))
rain.level = Math.sqrt(norm(precipitation, 0, 10))
rain.density = norm(precipitation, 0, 10)
pressure.level = 0.5
pressure.index = norm(Math.abs(pressure - 1013), 0, 25)
humidity.level = Math.sqrt(norm(humidity, 0, 100))
humidity.cutoff = 300 + 2700 * norm(humidity, 0, 100)
temperature.level = Math.sqrt(norm(temperature, -20, 30))
temperature.partials = 2 + Math.round(4 * norm(temperature, -20, 30))
reverb.wet = 0.15 + 0.5 * norm(cloudCover, 0, 100)
reverb.preDelay = 0.01 + 0.04 * norm(cloudCover, 0, 100)
```

`pressureTendency` is accepted but only affects the `pressure.index` sign handling; keep the parameter in the signature.

Harmony: Dorian offsets `[0, 2, 3, 5, 7, 9, 10]` from the root. `rootForPressure` zones with 3 hPa hysteresis handled by the caller: under 995 returns 45 (A2), 995 to 1005 returns 43 (G2), 1005 to 1018 returns 38 (D2), above returns 36 (C2). `quantizeToScale` picks the nearest MIDI note whose pitch class is in the scale, ties rounding up.

Events: fire `gust-burst` when gust spread crosses 6 m/s upward, `pressure-glide` when tendency is below -2 hPa per 3 h, `rain-change` when the precipitation state (dry under 0.1, drizzle under 1, rain under 4, heavy at or above 4) differs, `direction-sweep` when `Math.floor(dir / 45)` changes, `temperature-note` when the rounded temperature changes. Rate limit each event type to 1500 ms using `EventState.last: Record<string, number>`. First reading with `prev === null` returns no events but updates state.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain tests
git commit -m "feat: add weather mapping, harmony and event detection"
```

---

### Task 3: Weather and geocoding clients

**Files:**
- Create: `src/lib/weather/openMeteo.ts`, `src/lib/weather/photon.ts`, `src/lib/weather/latest.ts`
- Test: `tests/openMeteo.test.ts`, `tests/photon.test.ts`, `tests/latest.test.ts`

**Interfaces:**
- Consumes: `WeatherReading` from Task 2.
- Produces:
  - `class WeatherError extends Error { code: 'network' | 'parse' | 'http' }`
  - `fetchWeather(lat: number, lon: number, fetchImpl?: typeof fetch): Promise<{ reading: WeatherReading; pressureTendency: number }>`
  - `interface Place { name: string; lat: number; lon: number; country: string | null }`
  - `searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]>`
  - `reversePlace(lat: number, lon: number): Promise<Place | null>`
  - `latestOnly<T>(): (run: () => Promise<T>) => Promise<T | null>` returning null for superseded calls.

- [ ] **Step 1: Write failing tests with fixed JSON fixtures**

Pin: Open-Meteo parsing reads `current.wind_speed_10m` into `windSpeed`, computes tendency as current `pressure_msl` minus the hourly `pressure_msl` three hours earlier, and throws `WeatherError` with code `network` on a rejected fetch. Photon parsing prefers `properties.name`, falls back to `properties.city`, then to `"lat,lon"` with one decimal. `latestOnly` resolves null for an earlier call that finishes after a later one.

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the clients**

Open-Meteo URL is `https://api.open-meteo.com/v1/forecast` with `latitude`, `longitude`, `current=temperature_2m,relative_humidity_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m`, `hourly=pressure_msl`, `past_days=1`, `timezone=auto`. If the hourly series has fewer than four points, tendency is 0.

Photon URL is `https://photon.komoot.io/api/?q=<encoded>&limit=6&lang=en`, and reverse is `https://photon.komoot.io/reverse?lat=&lon=`. Both take `AbortSignal`.

`latestOnly` keeps a monotonically increasing request id per call site; it is created once per consumer.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weather tests
git commit -m "feat: add open-meteo and photon clients"
```

---

### Task 4: Audio engine core and scheduler

**Files:**
- Create: `src/lib/audio/engine.ts`, `src/lib/audio/scheduler.ts`, `src/lib/audio/reverb.ts`
- Test: `tests/scheduler.test.ts`

**Interfaces:**
- Consumes: `ChannelTargets`, `AudioEvent`.
- Produces:
  - `barDuration(bpm: number): number`, `barIndexAt(time: number, origin: number, bpm: number): number`, `phraseIndexAt(...)`
  - `class Scheduler { constructor(bpm: number, onBar: (time: number, bar: number) => void); start(): void; stop(): void }`
  - `class AudioEngine { constructor(ctx: AudioContext); start(): Promise<void>; stop(): void; resume(): Promise<void>; applyTargets(t: ChannelTargets, tau: number): void; setMix(channel: ChannelId, gain: number, muted: boolean): void; setMaster(v: number): void; fire(events: AudioEvent[]): void; readonly tap: AudioNode }`
  - `type ChannelId = 'wind' | 'gust' | 'rain' | 'pressure' | 'humidity' | 'temperature'`

- [ ] **Step 1: Write failing scheduler tests**

```ts
barDuration(56) ≈ 4.2857
barIndexAt(0, 0, 56) === 0
barIndexAt(4.29, 0, 56) === 1
phraseIndexAt(34.3, 0, 56) === 1
```

Also test that a started scheduler invokes `onBar` for consecutive bars when the clock advances, using fake timers or an injectable `now` function.

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement scheduler and engine graph**

Graph: each channel output into a dry bus and a reverb send; dry bus and reverb return feed a `DynamicsCompressorNode` (threshold -18, ratio 3); compressor feeds the master `GainNode` and the recording tap in parallel; master feeds destination. The tap is an `AudioWorkletNode` added in Task 7, exposed as `engine.tap`; until Task 7 it is an unused `GainNode`.

Scheduler uses a 25 ms `setInterval` with a 120 ms lookahead, computes bar boundaries from `ctx.currentTime`, and calls `onBar` ahead of time with the exact `AudioContext` time to schedule at.

`applyTargets` delegates to each channel with a `setTargetAtTime` time constant of `tau` (default 20, 2.5 on place switch).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Manual check**

Run `npm run dev`, add a temporary button in App.svelte that calls `engine.start()` and logs. Expected: no console errors, context state `running`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio tests/scheduler.test.ts
git commit -m "feat: add audio engine core and bar scheduler"
```

---

### Task 5: Noise and grain channels (wind, gust, rain)

**Files:**
- Create: `src/lib/audio/channels/wind.ts`, `src/lib/audio/channels/gust.ts`, `src/lib/audio/channels/rain.ts`, `src/lib/audio/noise.ts`
- Modify: `src/lib/audio/engine.ts`

**Interfaces:**
- Consumes: `ChannelTargets` slices, `Scheduler`.
- Produces:
  - `createNoiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer` (pink noise)
  - Each channel exports `class XChannel { constructor(ctx, destination, scheduler); update(target, tau): void; fire(strength: number): void; dispose(): void }` where `X` is `Wind`, `Gust`, `Rain`.

- [ ] **Step 1: Implement wind**

Two looping 4 s pink noise buffers, decorrelated, through one bandpass (type `bandpass`, Q 0.7) and one `StereoPannerNode`, then a gain. `update` sets gain, filter frequency and pan with `setTargetAtTime`.

- [ ] **Step 2: Implement gust**

Shared short noise buffer (0.02 s). `fire(strength)` schedules `3 + round(strength * 9)` clicks over 0.6 s, each a 4 ms noise burst through a highpass at 1200 Hz plus a sine ping at a random note from `quantizeToScale`, 60 ms exponential decay, random pan. Counter guards 12 events per second.

- [ ] **Step 3: Implement rain**

Grain scheduler on each bar: grains per bar equals `round(density * 40)`, capped at 24, offsets uniform within the bar. Each grain is a 30 to 80 ms noise slice through a bandpass at a scale note frequency, 20 ms fade in and out. Above density 0.4 add a constant high hiss gain.

- [ ] **Step 4: Wire into engine**

Engine constructs the three channels in `start()` and forwards `applyTargets` and `fire` events. Grain counters enforce the 48 cap across gust and rain.

- [ ] **Step 5: Manual check**

Run dev server, set targets manually with wind level 0.8, cut 800, and fire a gust. Expected: audible noise bed that changes with target, and click clusters on fire.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio
git commit -m "feat: add wind, gust and rain channels"
```

---

### Task 6: Tonal channels and reverb (pressure, humidity, temperature)

**Files:**
- Create: `src/lib/audio/channels/pressure.ts`, `src/lib/audio/channels/humidity.ts`, `src/lib/audio/channels/temperature.ts`, `src/lib/audio/reverb.ts`
- Modify: `src/lib/audio/engine.ts`

**Interfaces:**
- Consumes: `ChannelTargets` slices, `rootForPressure`, `quantizeToScale`.
- Produces: `PressureChannel`, `HumidityChannel`, `TemperatureChannel` with the same `constructor(ctx, destination, scheduler)` and `update(target, tau)` shape; `createReverb(ctx): { input: GainNode; output: GainNode; setWet(wet: number, preDelay: number): void }`.

- [ ] **Step 1: Implement the reverb**

Generate a 2.8 s impulse: decaying noise with an exponential envelope, lowpassed at 4 kHz, stereo. `ConvolverNode` plus a `DelayNode` for pre-delay and a wet gain.

- [ ] **Step 2: Implement pressure**

Two oscillators, carrier and modulator, carrier frequency from the current root directly (65 to 110 Hz), modulator ratio 1.5 into a gain of `index * carrierFrequency` connected to `carrier.frequency`. Root changes glide over 8 s. `fire('pressure-glide')` schedules a downward pitch bend of 3 semitones over 4 s.

- [ ] **Step 3: Implement humidity**

Three triangle oscillators detuned -6, 0, +6 cents, a lowpass, and a gain with 4 s attack and 6 s release. On phrase boundaries the chord changes to the next scale degree (root, third, fifth) with `setTargetAtTime` over 6 s.

- [ ] **Step 4: Implement temperature**

Two to six sine oscillators at octave partials of the current root, each with a slow independent tremolo, through a ring modulator, one note per phrase with 6 s decay.

- [ ] **Step 5: Wire into engine and manual check**

Expected: a low drone always present, a soft pad that follows humidity, and sparse high shimmer. Total mix audible with all six channels.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audio
git commit -m "feat: add pressure, humidity and temperature channels"
```

---

### Task 7: Recorder and WAV export

**Files:**
- Create: `src/lib/audio/recorder.ts`, `src/lib/audio/wav.ts`, `src/lib/audio/worklet/pcm-capture.js`
- Modify: `src/lib/audio/engine.ts`
- Test: `tests/wav.test.ts`

**Interfaces:**
- Consumes: `engine.tap`.
- Produces:
  - `encodeWav(chunks: Int16Array[], sampleRate: number, channels: number): Blob`
  - `class Recorder { static create(ctx: AudioContext, input: AudioNode): Promise<Recorder>; start(): void; stop(): { blob: Blob; durationSec: number }; readonly elapsed: number; readonly isRecording: boolean }`
  - `const MAX_RECORD_SECONDS = 600`

- [ ] **Step 1: Write failing WAV tests**

```ts
const blob = encodeWav([new Int16Array([0, 32767, -32768])], 44100, 2)
blob.type === 'audio/wav'
blob.size === 44 + 6
// header: 'RIFF', 'WAVE', 'fmt ', 'data', sampleRate 44100, channels 2, bits 16
encodeWav([Int16Array.from([2, -2]), Int16Array.from([4, -4])], 44100, 2).size === 44 + 8
```

Also test that a float sample of 1.5 clamps to 32767 and -1.5 to -32768 in the conversion helper `toInt16(value: number): number`.

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement `toInt16` and `encodeWav`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Implement the worklet and Recorder**

`pcm-capture.js` registers `pcm-capture`, accumulates 4096-frame blocks per channel, posts `{ left, right }` Float32Arrays with transferables. The processor also outputs silence so it stays alive.

Recorder loads the worklet with `ctx.audioWorklet.addModule(new URL('./worklet/pcm-capture.js', import.meta.url))`, connects the input to the worklet and the worklet to a zero gain node into the destination. On each message it converts to `Int16Array` immediately and pushes to a chunk list. `stop()` concatenates via `encodeWav` and returns the blob and elapsed time. It auto-stops at `MAX_RECORD_SECONDS`.

- [ ] **Step 6: Manual check**

Record 10 seconds of a test tone, stop, download, verify it plays in QuickTime with correct duration and no clicks at the end.

- [ ] **Step 7: Commit**

```bash
git add src/lib/audio tests/wav.test.ts
git commit -m "feat: add pcm recorder and wav encoder"
```

---

### Task 8: Session store with polling, smoothing and recording state

**Files:**
- Create: `src/lib/stores/session.svelte.ts`, `src/lib/stores/persistence.ts`
- Test: `tests/session.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 3, 4, 7.
- Produces:
  - `interface SessionDeps { engine: AudioEngine; weather: typeof fetchWeather; search: typeof searchPlaces; reverse: typeof reversePlace; now(): number }`
  - `class Session { place: Place | null; reading: WeatherReading | null; tendency: number; playing: boolean; recording: boolean; stale: boolean; frozen: boolean; channelGain: Record<ChannelId, number>; channelMuted: Record<ChannelId, boolean>; selectPlace(p: Place): Promise<void>; play(): Promise<void>; pause(): void; startRecording(): void; stopRecording(): { blob: Blob; durationSec: number } | null; setChannelGain(id, v): void; toggleMute(id): void; toggleFreeze(): void; dispose(): void }`
  - `loadLastPlace(): Place | null`, `saveLastPlace(p: Place): void`
  - `loadMix(): { gain: Record<ChannelId, number>; muted: Record<ChannelId, boolean> } | null`, `saveMix(mix: { gain: Record<ChannelId, number>; muted: Record<ChannelId, boolean> }): void`
  - Exported singleton `session` created with real dependencies.

- [ ] **Step 1: Write failing session tests with fakes**

Pin: `selectPlace` sets the place immediately and calls `saveLastPlace`; a failed weather fetch keeps the previous reading and sets `stale` true; a successful fetch clears `stale`; `selectPlace` while recording does not call `stopRecording`; `toggleMute` flips only that channel; channel gains persist across `selectPlace` and are written with `saveMix`; `selectPlace` while paused fetches and updates state without calling `engine.start`; `play()` after a place is already set resumes the context and starts audio with the current targets.

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Implement the store**

`selectPlace` uses `latestOnly`, applies targets with tau 2.5, polls every 300 000 ms with `setInterval`, and fires `detectEvents`. Audio is not started by `selectPlace`; `play()` calls `engine.resume()` then `engine.start()`, and starts the clock. Readings arriving while paused update state and targets but do not start audio.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores tests/session.test.ts
git commit -m "feat: add session store with polling and recording state"
```

---

### Task 9: Map, search and bottom sheet shell

**Files:**
- Create: `src/App.svelte`, `src/lib/components/MapDeck.svelte`, `src/lib/components/SearchPill.svelte`, `src/lib/components/BottomSheet.svelte`, `src/lib/components/WeatherHeader.svelte`, `src/lib/components/ParameterChips.svelte`, `src/lib/components/Toast.svelte`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `session`.
- Produces: the three-snap bottom sheet with `onSnap(index: 0 | 1 | 2)`; `SearchPill` emits `onSelect(place: Place)`.

- [ ] **Step 1: Map**

MapLibre with style `https://tiles.openfreemap.org/styles/positron`, initial center from `loadLastPlace()` else `[10.75, 59.91]` at zoom 9. Tint the canvas with `filter: sepia(0.18) saturate(0.85)`. Click sets the pin and calls `reversePlace`; a sage marker with halo. Draw a faint line through the pin along the wind bearing.

- [ ] **Step 2: Search**

Debounced 300 ms, aborts the previous request, shows up to six results with name and country, closes on select, shows "no places found" after an empty response.

- [ ] **Step 3: Bottom sheet**

Pointer-drag with three snap heights (96 px, 42%, 88% of viewport). Drag only starts on the handle or the header, never on the channel area or faders. Use `touch-action: none` on the handle only. Animate snap with a 220 ms transition, and honour `prefers-reduced-motion`.

- [ ] **Step 4: Readouts**

`WeatherHeader` shows place name, coordinates, condition text from `weatherCode`, temperature, and the large wind number. `ParameterChips` shows pressure, humidity, precipitation and direction. When `session.stale`, show a "last updated" marker in sage-dark.

- [ ] **Step 5: Desktop layout**

At `min-width: 900px` the map takes 62% on the left and the sheet becomes a fixed right panel with no drag handle. Verify at 1280 x 800.

- [ ] **Step 6: Manual check at 390 x 844**

Expected: map fills the screen, sheet drags between three heights, search selects a place and the readouts update. No layout overflow. Then check 1280 x 800 for the split layout.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: add map, search and bottom sheet shell"
```

---

### Task 10: Channel strips, transport and live trace

**Files:**
- Create: `src/lib/components/ChannelStrip.svelte`, `src/lib/components/Transport.svelte`, `src/lib/components/LiveTrace.svelte`
- Modify: `src/App.svelte`

**Interfaces:**
- Consumes: `session`, `ChannelId`.
- Produces: `ChannelStrip` props `{ id, label, value, gain, muted, onGain, onToggleMute }`; `Transport` props `{ playing, recording, elapsed, onPlay, onPause, onRecord }`.

- [ ] **Step 1: Channel strips**

Six vertical `input[type=range]` rotated -90 degrees, 0 to 1.5 step 0.05, aria-label "Wind channel gain" and so on. A mute dot, a 3 letter label, and a live value bar. The fader must stop pointer propagation so the sheet does not drag.

- [ ] **Step 2: Transport**

Play/pause, record circle with red state and elapsed time, master volume slider, mute all, and a freeze toggle that stops new events while the bed keeps playing. Record disabled until playing, with a tooltip "start the sound first".

- [ ] **Step 3: Live trace**

Canvas 2 minute scrolling line of wind and pressure, 1 frame per second, drawing in sage and sage-dark on forest. Stop drawing under `prefers-reduced-motion`. Clear on place change.

- [ ] **Step 4: Recording flow**

On stop, `session.stopRecording()` returns the blob, download as `vindrose-<slug>-<date>.wav`, show a toast with the duration.

- [ ] **Step 5: Manual check**

Expected: faders change the mix immediately, mute silences one channel, record captures 15 s and downloads a playable WAV.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: add mixer, transport and live trace"
```

---

### Task 11: Timbre variants per channel

**Files:**
- Create: `src/lib/audio/timbres.ts`
- Modify: `src/lib/audio/channels/*.ts`, `src/lib/audio/engine.ts`, `src/lib/components/ChannelStrip.svelte`, `src/lib/stores/session.svelte.ts`
- Test: `tests/timbres.test.ts`

**Interfaces:**
- Consumes: the six channel classes.
- Produces:
  - `type TimbreName = string`
  - `const TIMBRES: Record<ChannelId, { name: TimbreName; label: string }[]>` with exactly three entries per channel and the first entry the default.
  - `engine.setTimbre(channel: ChannelId, name: TimbreName): void`
  - `session.timbre: Record<ChannelId, TimbreName>` and `session.setTimbre(id, name): void`, persisted with the mix.

- [ ] **Step 1: Write failing tests**

Pin: every channel has exactly three timbres; the first is the default used before any choice; `setTimbre` with an unknown name is rejected and leaves the previous value.

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL, module not found.

- [ ] **Step 3: Define the timbre table**

```ts
wind:        hiss, roar, whistle
gust:        ping, wood, tick
rain:        droplet, patter, static
pressure:    sine, hollow, reed
humidity:    pad, choir, glass
temperature: shimmer, bell, air
```

- [ ] **Step 4: Implement crossfade**

Each channel holds two parallel voices A and B with gains. `setTimbre` loads the new voice, ramps its gain up and the old down over 500 ms with `linearRampToValueAtTime`, then disposes the old voice after the ramp. The default timbre starts in slot A.

- [ ] **Step 5: Wire the picker**

`ChannelStrip` shows the current timbre label under the fader. Tapping it cycles to the next timbre; a long press opens a list. Persist through `session.setTimbre`.

- [ ] **Step 6: Manual check**

Switch every channel through its three timbres while playing. Expected: no click, no gap, an audible but not drastic difference, and the choice survives a reload.

- [ ] **Step 7: Commit**

```bash
git add src/lib/audio src/lib/components src/lib/stores tests/timbres.test.ts
git commit -m "feat: add per-channel timbre variants"
```

---

### Task 12: Mobile polish, accessibility and ear check

**Files:**
- Modify: `src/App.svelte`, `src/lib/design/base.css`, `src/lib/components/*.svelte`
- Create: `README.md`
- Test: `tests/manual-ear-checklist.md`

**Interfaces:**
- Consumes: everything.
- Produces: a build that passes the written checklist.

- [ ] **Step 1: Accessibility pass**

Visible sage focus rings, keyboard reachable controls, aria labels on every fader and button, `prefers-reduced-motion` stops the trace and halo, contrast verified against the palette.

- [ ] **Step 2: Mobile pass**

Wake lock while playing (released on pause), safe-area insets on the sheet, 44 px minimum tap targets, no horizontal scroll at 360 px width.

- [ ] **Step 3: Write the ear checklist**

`tests/manual-ear-checklist.md` with: calm inland place vs stormy coast sound clearly different; ten minutes without input still evolves and never freezes; no pitch jumps on reading updates; no clicks when starting, stopping, switching place or starting recording; recording WAV duration matches elapsed time; offline keeps the bed and shows stale.

- [ ] **Step 4: Run the checklist**

Run: `npm run dev`, walk every line, note failures. Fix.

- [ ] **Step 5: Write README**

Setup, scripts, data sources and attribution, browser support, the 10 minute cap, and the architecture in five lines.

- [ ] **Step 6: Final build and commit**

Run: `npm run build` and `npm test`, both pass.

```bash
git add -A
git commit -m "feat: mobile polish, accessibility and readme"
```
