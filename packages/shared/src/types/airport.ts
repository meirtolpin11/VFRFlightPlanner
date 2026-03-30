export interface AirportFrequency {
  id: string
  frequencyType: string
  frequencyMhz: number
  name?: string
}

export interface Airport {
  id: string
  oaipId: string
  icaoCode?: string
  iataCode?: string
  name: string
  airportType: number
  lat: number
  lon: number
  elevationFt?: number
  country: string
  frequencies: AirportFrequency[]
}
