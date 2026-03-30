import { Request, Response, NextFunction } from 'express'

export function validateBbox(req: Request, res: Response, next: NextFunction) {
  const { bbox } = req.query
  if (!bbox || typeof bbox !== 'string') {
    return res.status(400).json({ error: 'bbox query parameter required (minLon,minLat,maxLon,maxLat)' })
  }
  const parts = bbox.split(',').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) {
    return res.status(400).json({ error: 'bbox must be minLon,minLat,maxLon,maxLat' })
  }
  next()
}
