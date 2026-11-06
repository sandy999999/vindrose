# Vindrose

**[Try it live](https://sandy999999.github.io/vindrose/)**

Live weather, turned into generative music. Pick a place on the map, hear
its current conditions, and record what you hear. Nothing is pre-rendered:
every sound comes from the reading the Open-Meteo API returned a moment ago.

The live site is built from `main` and deployed to GitHub Pages by
`.github/workflows/deploy.yml`.

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
- **Sound** — seven strips. Five are physical models of the weather: wind
  (two resonant bands and a noise bed, tuned by speed and the place's
  aperture), rain (drops striking four resonances of the place's material),
  gust (bursts of filtered noise with a low thump), pressure (a delay
  feedback pipe tuned to the mode) and thunder (a rumble and a crack, only
  at weather code 95 and above). The other two are synths: pad (a chord bed
  walking a four-chord cycle) and motif (a generated phrase of two to five
  notes, repeated A, A, B, A). Cloud cover drives the reverb. Only pad and
  motif offer timbre pickers, crossfaded over 500 ms.
- **Place as instrument** — each place has a profile drawn from its
  coordinates: seed, mode from latitude, tempo, aperture, and material from
  elevation (wood, glass, metal, stone or water). The material tunes the
  rain's resonances, so the same shower sounds different on a lowland and a
  mountain.
- **Piece** — a deterministic director composes a piece of eight to ten
  minutes from the seed and the reading: emerge, build, expose (one
  weather voice solo, pad out), break (near silence, a bell before the
  return) and return. Layer masks fade channels by section, and the next
  piece chains in from the same seed. Changes within a reading glide; sudden
  weather changes cross a threshold and fire an event instead.
- **Recording** — the engine's tap is captured in an AudioWorklet, written
  as 16-bit stereo WAV at the AudioContext's sample rate (48 kHz on most
  devices), and downloaded when you stop. Master volume and `mute` are
  monitor controls and never change the file; the channel faders and mutes
  are the mix it captures. The cap is ten minutes with a warning at eight,
  about 105 MB of audio in memory at 44.1 kHz before it is written out. The
  file is named `vindrose-<place>-<yyyymmdd-hhmm>-<seed>.wav` from the place
  and piece that were active when recording started.

## Controls

The sheet at the bottom of the map (a side panel on desktop) holds the
mixer. Drag its handle, or focus it and use the arrow keys, to change its
height.

- **Fader** — channel volume, remembered between visits.
- **Mute dot** — silences one channel; `mute` silences all channels for
  monitoring only, without changing a recording in progress.
- **Timbre label** — pad and motif only: tap to cycle, hold to choose from
  all three. The five weather strips keep their single voice.
- **Play / pause** — starts and stops the engine; a screen wake lock is held
  while playing.
- **Record** — starts and stops the WAV; the clock counts the take.
- **freeze** — stops weather events; the bed keeps playing.
- **Weather only / Weather + music** — silences the pad and motif without
  moving their faders; the choice is remembered.

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
