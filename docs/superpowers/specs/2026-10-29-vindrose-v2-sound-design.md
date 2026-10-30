# Vindrose v2: physical weather, generated pieces

**Status:** design, not yet planned.

**Supersedes:** the audio engine, sound design and event layer sections of
`2026-10-29-weather-sonification-design.md`. Map, search, session, recording,
persistence, transport and the design system carry over unchanged.

## Why

The v1 engine is accurate but static. Every channel is one loop, six loops
run at even density, and the two tonal channels make it read as an ambient
preset rather than as weather. Listening for ten minutes produces no
development, because weather itself changes slower than attention does.

v2 keeps the accuracy and adds two things the ear needs: sounds that are
physically derived rather than synthesised, and a composition above them
that has sections, entrances, silences and an end.

The shape, decided in conversation:

1. Weather is modelled, not played. Exciters and resonators, tuned by the
   reading and by the place.
2. Music is generated on top, by a director that writes pieces, not loops.
3. Place is an instrument. The coordinates pick the resonator material,
   the mode and the tempo, so every place has a voice of its own.

## Goals

- A place sounds like itself: Stavanger and Osaka are relatives, not clones.
- A piece has a beginning, a middle and an end, 8 to 12 minutes long, and a
  listener can hear that something is happening every 30 seconds.
- Rain, wind, gusts, pressure and thunder are recognisable as those things,
  not as textures that happen to be mapped to numbers.
- The six-parameter mixer survives, extended by one channel.
- Recording, mute, master and offline behaviour keep working. Pad and motif
  keep their three-timbre pickers; the weather strips do not have one,
  because each is a single physical model.

## Non-goals

- Live audio feeds (webcams, hydrophones, radio). Almost all public webcam
  audio does not exist, and the rest is unlicensed or CORS-blocked.
- Multiple places at once.
- Forecast-ahead playback.
- AI generation of audio or structure. The director is deterministic code.
- A tracker or sequencer UI. The user listens and adjusts, not composes.

## Anti-goals

- Anything that sounds like a film trailer, a drone compilation, or a
  weather app with a chord pad.
- Weather-driven harmony that wanders chromatically, which is where the
  cheese lives.
- A piece that ends by fading out because nothing else was left.

## The place profile

Computed once per place, stored with the last place, deterministic from the
coordinates alone except for the optional elevation lookup.

```ts
interface PlaceProfile {
  seed: number          // FNV-1a 32-bit of `${lat.toFixed(3)},${lon.toFixed(3)}`
  material: Material    // wood | glass | metal | stone | water
  mode: Mode            // lydian | dorian | aeolian | phrygian
  tempo: number         // 48 to 64 BPM
  aperture: number      // 0.002 to 0.006 m, the wind pipe diameter
  elevation: number | null
}
```

- **Seed.** FNV-1a over the coordinates at three decimals. Everything else
  derives from it unless noted.
- **Mode** from absolute latitude: below 23.5 Lydian, 23.5 to 45 Dorian, 45
  to 60 Aeolian, 60 and up Phrygian. The root is always D. Latitude is the
  honest determinant here: it is the one musical fact a place has.
- **Tempo** is `48 + (seed % 17)` BPM. Fixed per place and piece, because a
  tempo change mid-piece reads as a mistake.
- **Material** by elevation when the lookup succeeds, by seed otherwise:
  above 800 m stone; 300 to 800 m metal, or stone when the seed is even;
  below 30 m wood, or water when the seed is even; everything else the seed
  picks among all five. Elevation comes from Open-Meteo's keyless
  `/v1/elevation` endpoint, which sends `access-control-allow-origin: *`.
  A failed lookup changes nothing visible.
- **Aperture** is `0.002 + (seed % 5) * 0.001` m, the width the wind blows
  across. It sets the aeolian tone frequency.

The profile is displayed nowhere in v2. It is heard.

## The weather layer

Physical models, one per parameter. These replace the current wind, rain,
gust and pressure voices. The models are approximations, chosen for what
they sound like, not for numerical accuracy.

### Wind: aeolian resonance

Excitation is filtered noise. Resonance is two bandpasses in parallel at
`f` and `2.7f`, where `f = 0.2 * speed / aperture`, clamped to 80 to 2000
Hz. Q rises from 8 at calm to 38 at 25 m/s, which is what turns hiss into
a howl as the wind picks up. A lowpass noise bed at 300 to 900 Hz sits
under it as breath. Direction pans the pair.

### Rain: impacts on a material

One shared modal bus per material, four bandpasses at the material's
inharmonic ratios, Q 25 to 60, fed by every drop:

| Material | Ratios | Base pitch |
|---|---|---|
| wood | 1, 2.32, 4.25, 6.63 | 180 to 260 Hz |
| glass | 1, 2.76, 5.40, 8.93 | 800 to 1400 Hz |
| metal | 1, 2.71, 5.15, 8.42 | 400 to 900 Hz |
| stone | 1, 2.01, 3.44, 5.12 | 120 to 260 Hz |
| water | 1, 1.59, 2.14, 2.65 | 90 to 220 Hz |

The base pitch is quantised to the current root, so drops ring in key
without being played as notes. A drop is an 8 to 30 ms noise impulse with a
click envelope, panned, density from precipitation. The old scale-quantised
grain pitch goes away: real drops are inharmonic, and the material is what
makes them musical.

### Gusts: an aperture burst

Noise through a lowpass that sweeps up and down over 300 to 800 ms, plus a
sine thump at 40 to 90 Hz. Strength scales both. A gust cluster is three to
twelve of these spread over 600 ms.

### Pressure: a pipe

A delay line of 5 to 40 ms, fed back through a lowpass at gain 0.93, with
breath noise as the exciter: a Karplus-Strong pipe. Loop length maps
pressure 980 to 1030 hPa onto 55 to 110 Hz, and the target frequency snaps
to the nearest degree of the current mode, so the pipe is always in key
with the pad. It glides to each new target over 8 s, so a pitch change is a
portamento and never a step. Pressure tendency events bend the loop the
same way instead of the v1 drone's 2 s glide.

### Thunder: a rare event

Weather code 95 and above. A rumble of noise lowpassed at 60 to 180 Hz
decaying over 2 to 6 s, with a 40 ms bright crack at the onset. At most one
per 90 s, only in a build or expose section. This is the only new weather
parameter in the mixer.

## The musical layer

Two synth voices, kept because physical modelling alone would be a field
recording, and the brief is a generator that makes pieces.

- **Pad** (humidity): the chord bed. Humidity sets brightness and voice
  count; it enters and leaves by section rather than running throughout.
  Harmony moves on phrase boundaries through a four-chord cycle of scale
  degrees, I, vi, IV, V in the mode, drawn once from the seed and kept for
  the piece. The root is D and the cycle never leaves the mode.
- **Motif** (temperature): a generated melodic figure. One eight-bar phrase
  holds 2 to 5 onsets on the bar grid, the first on the downbeat; the
  rhythm cell is drawn from the seed and reused for the whole phrase, with
  the last onset optionally displaced by an eighth. Four phrases run A, A,
  B, A, with the final A varied by one degree and one step. Pitch comes from
  the mode and the pad's current chord, register from temperature, density
  from the director. This replaces the one-note-per-phrase shimmer and is
  where most of the musicality comes from.

Both keep the existing three-timbre picker.

## The director

The director turns the layers into a piece. It is a pure deterministic
function of the seed, the weather and the piece clock, so it is
unit-testable.

```ts
type Section = 'emerge' | 'build' | 'expose' | 'break' | 'return'

interface Plan {
  pieceSeed: number
  sections: Array<{ kind: Section; startSec: number; endSec: number }>
  layerTargets(kind: Section): Record<LayerId, number>
}

function stormScore(reading: WeatherReading | null): number // 0 to 1
```

- **The clock.** It runs only while the transport plays. Pause freezes it,
  resume continues the same piece where it stopped, and stop discards the
  piece, so the next play begins a new one. Freeze stops events and thunder
  but leaves the clock running: it quietens the weather, it does not pause
  the composition.
- **Piece length.** Drawn from the seed in 8 to 10 minutes. The recording
  cap is 10, so one piece fits one take and a take can hold the start of
  the next one.
- **Grammar.** Eight and a half minutes and above is five sections:
  emerge, build, expose, break, return. Below that is four: emerge, middle,
  break, return.
  Weather decides the four-section middle: a storm score above 0.6 gives
  build, below 0.2 gives emerge, otherwise expose. A five-section piece
  takes its shape from the length, and the score only weights its layers.
- **Durations.** Never drawn independently. The target length is split by
  the form's weights (emerge 1.0, build 1.2, expose 1.0, break 0.45, return
  1.0), then the sections are placed in order from that split. With these
  weights every part lands inside its range (emerge and return 90 to 150 s,
  build 120 to 180 s, expose 90 to 150 s, break 45 to 75 s) and the parts
  sum to the target. The clamp is a guard, not a mechanism.
- **Storm score.** `stormScore = 0.45*(gust/25) + 0.3*(speed/20) +
  0.25*(precip/8)`, clamped to 0 to 1, plus 0.2 when the weather code is 80
  or above, clamped again. A null reading scores 0.5. A pure function of
  one reading, so it is tested without a clock.
- **Snapshot.** The plan is fixed at piece start from the last reading held,
  stale or not, and piece start never waits for the network. A missing
  reading scores 0.5, which composes an expose middle. Layer weights inside
  a section follow the live reading, so the texture moves when the weather
  does while the sections stay put.
- **Layer masks.** Each section has a mix table: break is wind at 0.2 and
  nothing else; expose is one weather voice solo with no pad; return brings
  the pad back under a thinning bed. The mask multiplies: channel level is
  mask x weather target x user gain, so a mask of 0 silences the channel
  whatever the fader says. The strip meter shows mask x weather, before the
  user gain, so the strip reads the composition and the fader reads the
  listener.
- **Expose solo.** The voice with the highest normalised parameter at
  section start: gust/25, speed/20, precip/8, |pressure - 1013|/20, and
  thunder at 1 only when the code is 95 or above. Ties and silence go to
  wind, because every place has wind. A dry place exposes wind, not
  nothing.
- **Silence.** The last 6 s of every break drop to wind only, plus reverb
  tail. A silence is a section, not an absence.
- **Rare events.** One distant bell per piece, in the last two seconds of
  break, so it announces return instead of sitting inside the silence. It
  rides the pad channel and is exempt from the mask. Thunder only in build
  or expose, when the code says so.
- **Chaining.** After return fades over 20 s, a new piece begins. The next
  seed is FNV-1a of `${previousSeed}:${pieceIndex}`, so a session is
  reproducible from the seed in the file name. A recording can capture
  several pieces; the name carries the first one's seed.
- **Place change.** Choosing a place while a piece runs ends that piece and
  begins a new one, crossfaded over 4 s. Key, tempo and material change with
  the place; the running piece never mutates underneath the listener. The
  recording keeps the place it started with in its file name.

The director is visible: the header shows the current section in micro
caps. The listener should be able to tell that a piece is moving.

## Mixer and UI

Seven strips: wind, rain, gust, pressure, thunder, pad, motif. At 390 px
this is 7 x 44 = 308 px of targets inside a 334 px rail, which fits but is
tight; if it does not, thunder folds into gust and the strip count stays
six.

Everything else in the shell stands: bottom sheet, transport, timbre hold
menu, live trace, wake lock, freeze (now also stopping thunder). The timbre
hold menu opens on pad and motif only; the five weather strips are fader,
mute and meter. The persisted mix drops timbre names for the weather
channels and keeps them for pad and motif.

## Recording

Unchanged mechanism. The file name becomes
`vindrose-<place-slug>-<yyyymmdd-hhmm>-<seed8>.wav`, so a take names the
place, the time and the piece seed it started under.

## Verification

- Unit tests: the place profile (mode by latitude, material rules, seed
  determinism), the director (grammar by length, sections inside their
  ranges and summing to the target, weather influence on the four-section
  middle, expose voice choice and its wind fallback, seed chaining, no
  section outside its bounds), the storm score including a null reading,
  the mask multiplication against a fader at 1.5, material tables, the
  pipe's scale snap, event routing, and the existing recorder and session
  suites.
- Browser: a recorded WAV per material, checking the resonant peaks sit at
  the material's ratios; section transitions free of clicks; a place change
  crossfaded over 4 s with no click; the level invariant that no section
  exceeds the master ceiling.
- Ear: the manual checklist gains "a piece has an arc" and "materials are
  distinguishable by ear".

## Failure behaviour

The elevation lookup failing is silent: the seed decides the material. A
lookup that lands after a piece has started applies to the next piece, not
the running one, so a rain bus never changes under a take. The result is
cached with the place and reused. Stale weather keeps the last reading; the
director keeps composing from it, because a piece must not stop when the
API does.

## Calls I made

- Place identity is a seed plus latitude and elevation, not a terrain
  classifier. Calling a point "coast" without a coastline dataset would be a
  guess dressed as data.
- Root stays D in every mode. Continuity across places matters more than
  variety.
- Seven channels, with thunder folding into gust if the phone layout says no.
- Piece lengths of 8 to 10 minutes rather than 8 to 12, because the
  recording cap is 10 and a piece should fit one take. The five-section
  grammar starts at 9 minutes.
- The piece clock runs only while playing, and stop starts a new piece.
- The storm score is a weighted composite of gust, speed and precipitation.
- The section mask multiplies, so a fader cannot undo the composition.
- The motif's rhythm cell repeats A, A, B, A rather than varying per phrase.
- The pressure pipe snaps to the mode, so it cannot beat against the pad.
- A place change starts a new piece over a 4 s crossfade; the running piece
  never mutates.
- Only pad and motif keep timbre pickers. The weather strips are single
  models.
- The seed appears in the file name but has no UI yet.

## Left to the builder

- The exact material ratio tables, once auditioned.
- The layer mask values.
- How the seven strips are laid out on a 360 to 390 px screen.
- Whether the motif is one voice or two (a call and a response).
