# Vindrose manual ear checklist

The automated suite covers mapping, events, state and the recorder, but it
cannot judge how the result sounds. Run this list with headphones before a
release. Mark each line pass or fail with the place and date used.

Setup: `npm run dev`, open the printed URL, pick a place, press play.

- [ ] **Calm inland against stormy coast.** Choose an inland place with light
      wind (for example a town on the Swedish east coast on a quiet day) and
      note the bed: few gusts, thin rain, steady pressure. Then choose an
      exposed coastal station (for example Käringön or Stavanger) on a windy
      day. The two must be clearly different in density, brightness and
      movement, not just louder.
- [ ] **A piece has an arc.** Start playback and leave the tab alone. The
      sections must be audible without reading the header: the bed enters,
      builds, one weather voice plays exposed alone with the pad out, a near
      silence breaks it, then the pad returns. A piece that sounds the same
      at minute two and minute eight is a fail.
- [ ] **Materials are distinguishable by ear.** On a rainy day, listen to one
      place, then pick a place on another material (lowland wood against
      highland stone, or water against glass). The same rain must land
      differently: the pitch of the impacts and their decay change, not just
      the volume.
- [ ] **The expose solo is the strongest weather voice.** In the expose
      section exactly one weather voice plays at full level and the pad is
      silent. It must be the voice the weather is strongest in (gust on a
      windy day, rain on a wet one). An exposed voice that is quiet, or a pad
      that keeps running, is a fail.
- [ ] **The bell marks the return.** Just before the pad returns after the
      break, a single bell rings. It must be clearly a bell, exactly once,
      and land before the pad rather than under it.
- [ ] **A place change is heard as a new piece.** Pick a second place while
      playing. Over about four seconds the sound crossfades into a new piece
      with a new tempo, mode and material. A retune of the same piece, where
      the phrasing and chord cycle stay put, is a fail.
- [ ] **The seven strips fit on a 390 px phone.** In a mobile viewport, open
      the sheet and confirm wind, rain, gust, pressure, thunder, pad and
      motif each get a fader, a meter and a label with nothing clipped. Only
      pad and motif show a timbre label.
- [ ] **No pitch jumps on a reading update.** Watch the pressure, humidity and
      temperature channels when the five-minute poll lands. Tonal channels
      glide; one semitone steps are allowed, a leap or a click is a fail.
- [ ] **No clicks on transitions.** Listen closely while: starting playback,
      pausing, switching place (the 2.5 s retune), starting a recording, and
      stopping one. Any click, pop or gap is a fail. A timbre switch must fade
      over about half a second with no volume hole.
- [ ] **Timbre choices are different but related.** Cycle pad and motif
      through their three timbres while playing. Each must be recognisably
      itself and none may be harsh at the default fader position. The five
      weather strips must show no timbre label.
- [ ] **Threshold events are audible.** Wait for a weather update that
      changes the integer temperature (one shimmer note), the wind sector
      (a short sweep across the stereo field) or the rain state (a burst of
      grains). Each gesture must be distinct from the bed and must not
      double up with a gust burst. `freeze` must silence all of them.
- [ ] **Recording duration matches elapsed time.** Record for exactly 30
      seconds by the transport clock, stop, and check the downloaded WAV is
      30 s within about 0.1 s. Repeat with the 10-minute cap: playback stops on
      its own and the toast reports the limit.
- [ ] **Offline keeps the bed.** With playback running, switch the network
      off (or block `api.open-meteo.com` in devtools), then pick a new place.
      The existing bed keeps playing, the header shows the stale note, and the
      app recovers when the network returns.
- [ ] **Phone in hand.** On a real phone: the map deck fits under the notch,
      the sheet's bottom controls clear the home indicator, playback keeps the
      screen awake, and long-pressing a timbre label opens the menu without
      the browser's context menu.

Notes and places used:

-
