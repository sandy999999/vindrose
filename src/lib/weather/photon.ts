export interface Place {
  name: string
  lat: number
  lon: number
  country: string | null
}

interface PhotonFeature {
  properties?: {
    name?: string
    city?: string
    country?: string
  }
  geometry?: {
    coordinates?: number[]
  }
}

interface PhotonResponse {
  features?: PhotonFeature[]
}

function toPlace(feature: PhotonFeature): Place | null {
  const coordinates = feature.geometry?.coordinates
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null
  const lon = coordinates[0]
  const lat = coordinates[1]
  if (typeof lon !== 'number' || typeof lat !== 'number') return null
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null

  const properties = feature.properties ?? {}
  const name = properties.name ?? properties.city ?? `${lat.toFixed(1)},${lon.toFixed(1)}`

  return { name, lat, lon, country: properties.country ?? null }
}

function parse(body: unknown): Place[] {
  if (typeof body !== 'object' || body === null) return []
  const features = (body as PhotonResponse).features
  if (!Array.isArray(features)) return []
  return features.map(toPlace).filter((place): place is Place => place !== null)
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<Place[]> {
  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', '6')
  url.searchParams.set('lang', 'en')

  const response = await fetchImpl(url, { signal })
  if (!response.ok) return []
  return parse(await response.json())
}

export async function reversePlace(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Place | null> {
  const url = new URL('https://photon.komoot.io/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('lang', 'en')

  const response = await fetchImpl(url)
  if (!response.ok) return null
  return parse(await response.json())[0] ?? null
}
