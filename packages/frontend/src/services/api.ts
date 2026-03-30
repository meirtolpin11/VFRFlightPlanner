import type { Trip, Flight, Leg, Airplane, Airport, Airspace } from '@flight-planner/shared'

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  if (res.status === 204) return null as T
  return res.json()
}

export const api = {
  // Trips
  getTrips: () => req<Trip[]>('/api/v1/trips'),
  createTrip: (data: { name: string; description?: string }) => req<Trip>('/api/v1/trips', { method: 'POST', body: JSON.stringify(data) }),
  updateTrip: (id: string, data: Partial<Trip>) => req<Trip>(`/api/v1/trips/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTrip: (id: string) => req<null>(`/api/v1/trips/${id}`, { method: 'DELETE' }),

  // Flights
  createFlight: (tripId: string, data: { name: string; airplaneId?: string }) =>
    req<Flight>(`/api/v1/trips/${tripId}/flights`, { method: 'POST', body: JSON.stringify(data) }),
  updateFlight: (tripId: string, flightId: string, data: Partial<Flight>) =>
    req<Flight>(`/api/v1/trips/${tripId}/flights/${flightId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFlight: (tripId: string, flightId: string) =>
    req<null>(`/api/v1/trips/${tripId}/flights/${flightId}`, { method: 'DELETE' }),

  // Legs
  createLeg: (flightId: string, data: { departureId: string; arrivalId: string; name?: string; color?: string }) =>
    req<Leg>(`/api/v1/flights/${flightId}/legs`, { method: 'POST', body: JSON.stringify(data) }),
  updateLeg: (flightId: string, legId: string, data: Partial<Leg>) =>
    req<Leg>(`/api/v1/flights/${flightId}/legs/${legId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLeg: (flightId: string, legId: string) =>
    req<null>(`/api/v1/flights/${flightId}/legs/${legId}`, { method: 'DELETE' }),
  updateLegWaypoints: (legId: string, departureId: string, arrivalId: string, intermediates: string[]) =>
    req<Leg>(`/api/v1/legs/${legId}/waypoints`, { method: 'PUT', body: JSON.stringify({ departureId, arrivalId, intermediates }) }),

  // Messages
  getMessages: (legId: string) => req<{ id: string; legId: string; authorName: string; body: string; createdAt: string }[]>(`/api/v1/legs/${legId}/messages`),
  postMessage: (legId: string, authorName: string, body: string) =>
    req(`/api/v1/legs/${legId}/messages`, { method: 'POST', body: JSON.stringify({ authorName, body }) }),
  deleteMessage: (legId: string, messageId: string) =>
    req<null>(`/api/v1/legs/${legId}/messages/${messageId}`, { method: 'DELETE' }),

  // Waypoints
  searchWaypoints: (q: string) => req<import('@flight-planner/shared').Waypoint[]>(`/api/v1/waypoints/search?q=${encodeURIComponent(q)}`),
  createWaypoint: (data: { name: string; lat: number; lon: number; waypointType?: string; notes?: string }) =>
    req<import('@flight-planner/shared').Waypoint>('/api/v1/waypoints', { method: 'POST', body: JSON.stringify(data) }),

  // Airplanes
  getAirplanes: () => req<Airplane[]>('/api/v1/airplanes'),
  createAirplane: (data: Omit<Airplane, 'id' | 'createdAt' | 'updatedAt'>) =>
    req<Airplane>('/api/v1/airplanes', { method: 'POST', body: JSON.stringify(data) }),
  updateAirplane: (id: string, data: Partial<Airplane>) =>
    req<Airplane>(`/api/v1/airplanes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAirplane: (id: string) => req<null>(`/api/v1/airplanes/${id}`, { method: 'DELETE' }),

  // Trip shares
  getTripShares: (tripId: string) => req<{ userId: string; email: string; username: string }[]>(`/api/v1/trips/${tripId}/shares`),
  addTripShare: (tripId: string, email: string) => req<{ userId: string; email: string; username: string }>(`/api/v1/trips/${tripId}/shares`, { method: 'POST', body: JSON.stringify({ email }) }),
  removeTripShare: (tripId: string, userId: string) => req<null>(`/api/v1/trips/${tripId}/shares/${userId}`, { method: 'DELETE' }),

  // Map data
  getAirports: (bbox: string) => req<Airport[]>(`/api/v1/map/airports?bbox=${bbox}`),
  getAirportById: (id: string) => req<Airport>(`/api/v1/map/airports/${id}`),
  getOrCreateAirportWaypoint: (oaipId: string) =>
    req<import('@flight-planner/shared').Waypoint>(`/api/v1/map/airports/${oaipId}/waypoint`, { method: 'POST' }),
  getOrCreateReportingPointWaypoint: (oaipId: string) =>
    req<import('@flight-planner/shared').Waypoint>(`/api/v1/map/reporting-points/${oaipId}/waypoint`, { method: 'POST' }),
  getNavaids: (bbox: string) => req<{ id: string; name: string; ident: string | null; navaidType: number; frequency: number | null; lat: number; lon: number; country: string }[]>(`/api/v1/map/navaids?bbox=${bbox}`),
  getOrCreateNavaidWaypoint: (oaipId: string) =>
    req<import('@flight-planner/shared').Waypoint>(`/api/v1/map/navaids/${oaipId}/waypoint`, { method: 'POST' }),
  getAirspaces: (bbox: string, maxAltFt = 40000) =>
    req<Airspace[]>(`/api/v1/map/airspaces?bbox=${bbox}&max_alt_ft=${maxAltFt}`),
  getReportingPoints: (bbox: string) => req<{ id: string; name: string; compulsory: boolean; lat: number; lon: number; country: string }[]>(`/api/v1/map/reporting-points?bbox=${bbox}`),
}
