# Vindrose: live weather sonification, web prototype

2026-10-29

## Intent

A browser instrument. Pick a place on a map, hear that place's current weather as
generative sound, and record what you hear. Built for fun and for standing
outside somewhere with a phone. It continues the Bølger work in
`ai-music/music` (weather data to composed audio) but inverts the medium: those
scripts render offline from pasted SMHI arrays, this runs live in the browser
against a global weather API.

The sound is the product. The map is how you aim it.

## Success

- A place can be found and picked in under ten seconds on a phone.
- Sound starts within a second of picking a place.
- Left running for ten minutes with unchanging weather, it still evolves and
  never sounds like a stuck loop.
- Two different places, one stormy and one calm, sound clearly different in
  character, not just in volume.
- A recording can be stopped and downloaded as a WAV that plays correctly.
- Nothing in the output reads as cheesy: no arpeggiated weather cliches, no
  major-key jingles, no obvious "data dashboard beeps".

## Non-goals

- No user accounts, saving, or sharing links.
- No historical weather browsing or date picking.
- No MIDI export, no DAW integration, no VST.
- No multi-location comparison in v1.
- No back end. The app is static and talks to public APIs directly.

## Anti-goals

Design decisions that would make this a failure even if it technically works:

- Weather values mapped straight to pitch so that a wind reading plays a melody.
- A mixer that looks like a DAW and hides the map.
- Continuous noise with no events, or event spam with no bed.
- A pitch that jumps when a new reading arrives.
- Audio that stalls or glitches on a mid-range phone.

## Constraints

- Runs in a mobile browser, one-handed, portrait first.
- Must survive iOS Safari audio rules: context resume on a user gesture, no
  autoplay, silent-switch behaviour accepted.
- Public keyless APIs only, because there is no back end.
- Unda Soni design system for all visuals.

## The object: Map deck, phone first

Full-bleed map. A floating search pill at the top. A bottom sheet with three
snap heights, draggable:

- **Peek** (about 96 px): place name, weather line, wind number, record button.
- **Half** (about 42%): adds the parameter chips and the six channel faders.
- **Full** (about 88%): adds the live trace, source attribution and settings.

Layout elements, top to bottom:

1. Search pill with a magnifier, placeholder "search place or station".
   Typing shows a result list of up to six places. Selecting one drops the pin
   and starts the weather fetch.
2. Map. Tapping anywhere also drops the pin and reverse geocodes the name.
   The pin is a sage dot with a soft halo. Wind direction is drawn as a faint
   line through the pin.
3. Bottom sheet, parchment surface, forest ink, sage accents.
   - Header row: place name and coordinates in micro caps, weather condition
     and temperature, then the large wind number with its unit.
   - Chips: pressure, humidity, precipitation, direction.
   - Channel strips: six vertical faders, one per channel, with a mute dot.
     Each strip shows a 3 letter label, the live value as a tiny bar, and a
     timbre name.
   - Transport row: play/pause, record circle, master volume, elapsed timer.
   - Live trace: a two minute scrolling line of wind and pressure, rendered on
     a canvas in the Unda Soni palette.
4. Desktop (min width 900 px): the same parts, map left 62%, sheet becomes a
   fixed right panel. No separate layout, just a responsive rearrangement.

Visual rules: parchment `#e8e5db` field, forest `#222514` ink, sage `#c4d1c6`
and sage-dark `#92a494` accents, sand `#e4d9c5` and cream `#eeeada` for
highlights. ModernDOS 8x16 for numerals and micro labels, a system grotesque
for prose. Hairline borders, no shadows except under the sheet.

## Weather data

Source: Open-Meteo, keyless and CORS enabled.

- Forecast endpoint: `https://api.open-meteo.com/v1/forecast`
- Params for the picked point: `current=temperature_2m,relative_humidity_2m,
  precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,
  wind_direction_10m,wind_gusts_10m`, plus `hourly=pressure_msl,wind_speed_10m`
  with `past_days=1` to seed a short history, `timezone=auto`.
- Poll every 5 minutes while playing and on every new location. Open-Meteo
  updates current conditions roughly every 15 minutes, so more frequent
  polling buys nothing.
- Derived values: gust spread (gust minus sustained wind), three hour pressure
  tendency from the hourly series, rain state (dry, drizzle, rain, heavy).

Geocoding: Photon (`https://photon.komoot.io/api/`), debounced 300 ms, six
results, cached per query. Reverse geocoding uses the same service with
`reverse=true`.

Failure behaviour: the last successful reading stays in use and a small
"stale" marker appears next to the timestamp. No modal errors, no silence.

## Audio engine

Raw Web Audio API, no Tone.js. Reason: full control of the grain and noise
layers, no bundle weight, and the recording tap is simpler to own.

Three layers, agreeing on the earlier decision:

1. **Clock.** A scheduler with a 25 ms lookahead tick and a 120 ms horizon.
   Base 56 BPM, 4/4. One bar is 4.29 s, one phrase is 8 bars. The clock drives
   chord changes, shimmer entries and grain scheduling. It never becomes an
   audible beat.
2. **Modulation.** Every weather parameter has `target` and `current` values.
   Targets update when a reading arrives; `current` follows with an exponential
   smoothing constant of 20 s, evaluated on an animation frame. On top of that,
   each parameter gets its own slow drift oscillator, 40 to 90 s period, at 3 to
   6 percent of range, so a flat reading still breathes.
3. **Events.** Discrete gestures fired by thresholds and transitions, rate
   limited to one per 1.5 s per type:
   - Gust spread over 6 m/s: a burst in the gust cloud.
   - Pressure tendency under -2 hPa per 3 h: a downward glide in the drone.
   - Precipitation crossing 0.1 mm/h: rain grains fade in or out over 8 s.
   - Wind direction crossing a 45 degree sector: a stereo sweep.
   - Temperature crossing an integer: a single shimmer note.

Tempo, key and scale are fixed per session rather than weather derived:
D Dorian. Pressure moves the harmonic root slowly between D, C, G and A, always
diatonic. Temperature selects extension brightness, not the scale. This is
deliberate: weather-driven harmony is where the cheese lives.

Voice budget: never more than 48 concurrent grains and 12 short events per
second, measured and enforced by a counter in the scheduler.

Master chain: channel sum, then a gentle `DynamicsCompressorNode` (threshold
-18 dB, ratio 3), then a `GainNode` master, then destination and the recording
tap in parallel.

## Sound design

Each channel is one instrument driven by one weather value. Level mapping is
perceptual, using square roots on normalized values rather than linear, so the
quiet half of the range stays useful.

| Channel | Data | Instrument | Mapping |
|---|---|---|---|
| wind | wind_speed_10m, 0 to 25 m/s | Two decorrelated pink noise beds through a bandpass, Q 0.7, centre 200 to 1200 Hz | Level from speed, cutoff from speed, stereo position from direction (pan equals sine of bearing) |
| gust | gust minus sustained, 0 to 15 m/s | Short resonant clicks: 4 ms noise burst plus a sine ping, random pan | Presence and burst density from spread; events add clusters |
| rain | precipitation, 0 to 10 mm/h | Granular droplets, 30 to 80 ms filtered noise grains, pitch quantised to the scale | Density from rate, grain pitch narrows toward the root as rate rises, plus a high hiss above 4 mm/h |
| press | pressure_msl, 980 to 1030 hPa | Two operator FM drone, carrier 55 to 82 Hz, ratio 1.5 | Carrier follows the root, modulation index from pressure deviation, slow glide on tendency events |
| hum | relative_humidity_2m, 0 to 100% | Soft pad, three detuned triangle voices, 4 s attack, 6 s release | Level from humidity, lowpass cutoff 300 to 3000 Hz, slow chord changes on phrase boundaries |
| temp | temperature_2m, -20 to 30 C | Shimmer: high sine partials with ring modulation, long decay | Level from warmth, partial count from temperature, one note per phrase |

Global from cloud_cover: reverb. A single generated impulse response (2.8 s,
exponentially decaying noise, lowpassed), with wet amount and pre-delay from
cloud cover. Overcast sounds wider and further away.

Each channel has a timbre picker with three options. Defaults are the sounds
above; the other two are restrained variants (for example wind: "hiss", "roar",
"whistle"). Timbre changes crossfade over 500 ms, never restart the engine.

Master controls: master volume, mute all, and a "freeze" toggle that stops new
events while the bed keeps playing. Freeze is useful while recording.

## Recording and export

- A `MediaStreamAudioDestinationNode` taps the master after the compressor.
- `MediaRecorder` with `audio/webm;codecs=opus` on Chrome and Android,
  `audio/mp4` on Safari.
- On stop, the blob is decoded with `decodeAudioData` and re-encoded to 16 bit
  PCM WAV in a worker. If decoding fails, the raw blob downloads instead and
  the UI says so.
- File name: `vindrose-<place-slug>-<yyyy-mm-dd-hhmm>.wav`.
- Recording continues while the sheet is collapsed and while the phone screen
  is on. A red dot and elapsed time stay visible in the peek state.
- Maximum recording length is 30 minutes, then it stops and saves.

## Tech decisions

These are the builder's calls unless flagged:

- **Svelte 5 + Vite + TypeScript.** Matches the principal's stack, smallest
  path to a polished mobile UI.
- **MapLibre GL JS** with the OpenFreeMap `positron` style, keyless. A CSS tint
  layer (`filter: sepia(0.18) saturate(0.85)`) pulls the basemap toward
  parchment. Fallback if OpenFreeMap is down: CARTO raster tiles.
- **Photon** for geocoding, **Open-Meteo** for weather. Both keyless.
- **Raw Web Audio**, no audio framework. A `WavEncoder` and the mapping
  functions are pure and unit tested.
- **Vitest** for the pure layer. No Playwright in v1; audio is verified by ear
  against a written checklist.
- **No back end, no analytics, no cookies.** Deployment to Vercel static is
  optional and outside this spec.
- State in Svelte stores plus `localStorage` for the last location only.

## Accessibility and mobile

- All controls reachable by keyboard on desktop, visible focus rings in sage.
- Faders are `input[type=range]` rotated, with aria labels naming data and
  channel.
- `prefers-reduced-motion` stops the trace animation and the pin halo.
- Contrast: forest on parchment is 12.4:1, sage-dark on forest is 4.9:1.
- The app requests a screen wake lock while playing, released on pause.

## Risks

- **iOS recording.** Codec support differs and `decodeAudioData` may reject
  webm. Mitigation: try wav, fall back to the raw blob with a clear label.
- **Tile provider.** OpenFreeMap is a small free service. Mitigation: raster
  fallback and a neutral background map colour if both fail.
- **Phone CPU.** Grain clouds are the risk. Mitigation: voice budget, 48 grains
  cap, and a quality toggle that halves it.
- **Weather is boring.** Mitigated by the clock, drift and event layers; this is
  the main thing to judge by ear.
- **Geocoder rate limits.** Debounce, cache, and never request on every
  keystroke.

## Deferred

- Tone presets per landscape type.
- Comparing two locations side by side.
- Saving a session and resuming it later.
- A public gallery of recordings.
- A "wind rose" generative mark per location, in the Unda Soni forms library.

## Decisions already made with the principal

- Live stream that follows the location, with recording, not a fixed render.
- Hybrid engine: clock plus modulation plus events.
- Humidity is a soft pad, not a detune.
- Map deck, phone first.
- Six channels, one data source per channel.

## Left to the builder

Exact reverb algorithm, the two alternate timbres per channel, fader styling,
the exact trace visual, error copy, and whether the settings live in the full
sheet or a separate dialog.
