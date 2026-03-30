import { useTripStore } from '../../store/tripStore'
import { useAirplaneStore } from '../../store/airplaneStore'
import LegPolyline from './LegPolyline'

export default function FlightRoutesLayer() {
  const trips = useTripStore(s => s.trips)
  const airplanes = useAirplaneStore(s => s.airplanes)

  return (
    <>
      {trips.flatMap(trip =>
        trip.flights
          .filter(f => f.visibleOnMap)
          .flatMap(flight => {
            const airplane = airplanes.find(a => a.id === flight.airplaneId) || null
            return flight.legs
              .filter(leg => leg.visible !== false)
              .map(leg => (
                <LegPolyline key={leg.id} leg={leg} flightId={flight.id} airplane={airplane ?? undefined} />
              ))
          })
      )}
    </>
  )
}
