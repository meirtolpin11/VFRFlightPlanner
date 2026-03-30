// OpenAIP API client — fetches airports and airspaces by country
const BASE_URL = 'https://api.core.openaip.net/api'

interface OpenAipAirport {
  _id: string
  icaoCode?: string
  iataCode?: string
  name: string
  type: number
  geometry: { type: string; coordinates: [number, number] }
  elevation?: { value: number; unit: string }
  country: string
  frequencies?: Array<{ type: number; value: number; name?: string }>
}

interface OpenAipAirspace {
  _id: string
  name: string
  icaoClass: number
  type: number
  upperLimit: { value: number; unit: number; referenceDatum: number }
  lowerLimit: { value: number; unit: number; referenceDatum: number }
  geometry: { type: string; coordinates: number[][][] }
  country: string
}

const FREQUENCY_TYPE_NAMES: Record<number, string> = {
  0: 'APPROACH', 1: 'APRON', 2: 'ARRIVAL', 3: 'CENTER', 4: 'CTAF',
  5: 'DELIVERY', 6: 'DEPARTURE', 7: 'EMERGENCY', 8: 'FLIGHT INFO',
  9: 'GATE', 10: 'GROUND', 11: 'UNICOM', 12: 'INFO', 13: 'MULTICOM',
  14: 'RADAR', 15: 'TOWER', 16: 'ATIS', 17: 'RADIO'
}

const AIRSPACE_CLASS_NAMES: Record<number, string> = {
  0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G'
}

async function fetchWithKey(url: string): Promise<unknown> {
  const apiKey = process.env.OPENAIP_API_KEY
  if (!apiKey) throw new Error('OPENAIP_API_KEY not set')
  const res = await fetch(url, { headers: { 'x-openaip-api-key': apiKey } })
  if (!res.ok) throw new Error(`OpenAIP API error: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function fetchAirportsByCountry(country: string): Promise<OpenAipAirport[]> {
  const url = `${BASE_URL}/airports?country=${country}&limit=1000&page=1`
  const data = await fetchWithKey(url) as { items: OpenAipAirport[] }
  return data.items || []
}

export async function fetchAirspacesByCountry(country: string): Promise<OpenAipAirspace[]> {
  const url = `${BASE_URL}/airspaces?country=${country}&limit=1000&page=1`
  const data = await fetchWithKey(url) as { items: OpenAipAirspace[] }
  return data.items || []
}

interface OpenAipReportingPoint {
  _id: string
  name: string
  compulsory?: boolean
  country: string
  geometry: { type: string; coordinates: [number, number] }
}

export async function fetchReportingPointsByCountry(country: string): Promise<OpenAipReportingPoint[]> {
  const url = `${BASE_URL}/reporting-points?country=${country}&limit=1000&page=1`
  const data = await fetchWithKey(url) as { items: OpenAipReportingPoint[] }
  return data.items || []
}

interface OpenAipNavaid {
  _id: string
  name: string
  type: number
  country: string
  geometry: { type: string; coordinates: [number, number] }
  channel?: string
  frequency?: { value: number; unit: number }
  ident?: string
}

export async function fetchNavaidsByCountry(country: string): Promise<OpenAipNavaid[]> {
  const url = `${BASE_URL}/navaids?country=${country}&limit=1000&page=1`
  const data = await fetchWithKey(url) as { items: OpenAipNavaid[] }
  return data.items || []
}

export { FREQUENCY_TYPE_NAMES, AIRSPACE_CLASS_NAMES, OpenAipAirport, OpenAipAirspace, OpenAipReportingPoint, OpenAipNavaid }
