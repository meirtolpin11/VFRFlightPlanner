import type { Leg, LegStats, Airplane, Flight, Trip } from '@flight-planner/shared'

export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065 // Earth radius in NM
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number) { return deg * Math.PI / 180 }

export function calculateLegStats(leg: Leg, airplane?: Airplane | null): LegStats {
  const waypoints = [leg.departure, ...leg.intermediates, leg.arrival]
  let distanceNm = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    distanceNm += haversineNm(waypoints[i].lat, waypoints[i].lon, waypoints[i + 1].lat, waypoints[i + 1].lon)
  }
  const eteMinutes = airplane ? (distanceNm / airplane.cruiseTasKts) * 60 : 0
  const fuelBurn = airplane ? (eteMinutes / 60) * airplane.fuelConsumption : 0
  return {
    distanceNm: Math.round(distanceNm * 10) / 10,
    eteMinutes: Math.round(eteMinutes),
    fuelBurn: Math.round(fuelBurn * 10) / 10,
    fuelUnit: airplane?.fuelUnit || 'gal',
  }
}

/**
 * Given a leg's current waypoints and a new point, return the intermediates array
 * with the new waypoint ID inserted at the position that minimises extra distance.
 */
export function insertAtOptimalPosition(
  allWaypoints: { id: string; lat: number; lon: number }[],
  newId: string,
  newLat: number,
  newLon: number
): string[] {
  let bestIdx = allWaypoints.length - 1 // default: just before arrival
  let bestCost = Infinity
  for (let i = 0; i < allWaypoints.length - 1; i++) {
    const a = allWaypoints[i], b = allWaypoints[i + 1]
    const cost =
      haversineNm(a.lat, a.lon, newLat, newLon) +
      haversineNm(newLat, newLon, b.lat, b.lon) -
      haversineNm(a.lat, a.lon, b.lat, b.lon)
    if (cost < bestCost) { bestCost = cost; bestIdx = i + 1 }
  }
  // Insert newId at bestIdx into the full array then strip dep/arr
  const all = [...allWaypoints.slice(0, bestIdx), { id: newId, lat: newLat, lon: newLon }, ...allWaypoints.slice(bestIdx)]
  return all.slice(1, -1).map(w => w.id)
}

export function formatEte(minutes: number): string {
  if (!minutes) return '--'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

export function calculateFlightEte(flight: Pick<Flight, 'legs'>, airplane?: Airplane | null): number {
  return flight.legs.reduce((sum, leg) => sum + calculateLegStats(leg, airplane).eteMinutes, 0)
}

export function calculateTripEte(trip: Pick<Trip, 'flights'>, airplaneMap: Record<string, Airplane>): number {
  return trip.flights.reduce((sum, flight) => {
    const airplane = flight.airplaneId ? airplaneMap[flight.airplaneId] : undefined
    return sum + calculateFlightEte(flight, airplane)
  }, 0)
}
