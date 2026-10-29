# Vindrose

Live weather, turned into generative music. Pick a place on the map, hear
its current conditions, and record what you hear. Nothing is pre-rendered:
every sound comes from the reading the Open-Meteo API returned a moment ago.

## Setup

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the built bundle
npm test         # vitest
npm run check    # svelte-check
```

No API keys are needed. Audio starts only after you press play, because
browsers refuse to start an AudioContext without a user gesture.

## How it works

- **Weather** — Open-Meteo's forecast endpoint, polled every 300 seconds.
  A failed poll keeps the last reading and marks it stale rather than
  stopping the sound.
- **Search** — Photon geocoder for place names; clicking the map reverse
  geocodes the point, falling back to plain coordinates.
- **Map** — MapLibre GL with the OpenFreeMap `positron` style.
- **Sound** — six channels, one per weather parameter: wind (bandpass
  noise), gusts (event-driven clicks and pings), rain (grains plus hiss),
  pressure (two-operator FM drone), humidity (a detuned pad that walks a
  chord each phrase) and temperature (sine partials that breathe). Cloud
  cover drives the reverb. Each channel offers three timbres, crossfaded
  over 500 ms.
- **Time** — 56 BPM, 4/4, eight-bar phrases in D Dorian. Weather readings
  are exponential targets rather than steps, so a new reading glides; sudden
  changes cross a threshold and fire an event instead.
- **Recording** — the engine's tap is captured in an AudioWorklet, written
  as 16-bit stereo WAV at the AudioContext's sample rate (48 kHz on most
  devices), and downloaded when you stop. The cap is ten minutes, about
  105 MB of audio in memory at 44.1 kHz before it is written out.

## Controls

The sheet at the bottom of the map (a side panel on desktop) holds the
mixer. Drag its handle, or focus it and use the arrow keys, to change its
height.

- **Fader** — channel volume, remembered between visits.
- **Mute dot** — silences one channel; `mute` silences all.
- **Timbre label** — tap to cycle, hold to choose from all three.
- **Play / pause** — starts and stops the engine; a screen wake lock is held
  while playing.
- **Record** — starts and stops the WAV; the clock counts the take.
- **freeze** — stops weather events; the bed keeps playing.

## Browser support

Needs Web Audio with AudioWorklet, which means current Chrome, Edge, Safari
and Firefox on desktop, and iOS Safari 14.5 or newer. The screen wake lock
is used where available and ignored elsewhere. `prefers-reduced-motion`
turns off the map's fly animation and the live trace's animation.

## Data and attribution

Weather data from [Open-Meteo](https://open-meteo.com) (CC BY 4.0).
Geocoding from [Photon](https://photon.komoot.io), using OpenStreetMap data
(ODbL). Map tiles and style from [OpenFreeMap](https://openfreemap.org),
rendered by [MapLibre GL JS](https://maplibre.org). Sound: no samples, only
synthesised oscillators and generated noise buffers.

## Manual checks

`tests/manual-ear-checklist.md` covers what the test suite cannot: how the
result actually sounds, and how it behaves in a hand on a real phone.
