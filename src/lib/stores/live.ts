import { AudioEngine } from '../audio/engine'
import { Recorder } from '../audio/recorder'
import { fetchWeather } from '../weather/openMeteo'
import { loadLastPlace, loadMix, saveLastPlace, saveMix } from './persistence'
import { Session } from './session'

let instance: Session | null = null

export function getSession(): Session {
  if (instance) return instance

  const ctx = new AudioContext()
  const engine = new AudioEngine(ctx)
  instance = new Session({
    engine,
    weather: (lat, lon) => fetchWeather(lat, lon),
    createRecorder: () => Recorder.create(ctx, engine.tap),
    savePlace: saveLastPlace,
    loadPlace: loadLastPlace,
    saveMix,
    loadMix,
  })
  return instance
}
