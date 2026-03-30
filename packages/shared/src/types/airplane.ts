export interface Airplane {
  id: string
  name: string
  registration?: string
  cruiseTasKts: number
  fuelConsumption: number
  fuelUnit: 'gal' | 'L'
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface CreateAirplaneInput {
  name: string
  registration?: string
  cruiseTasKts: number
  fuelConsumption: number
  fuelUnit: 'gal' | 'L'
  notes?: string
}
