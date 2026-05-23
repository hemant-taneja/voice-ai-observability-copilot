import { Request, Response, NextFunction, RequestHandler } from 'express'
import { db } from '../db/index'

export function ghlAuth(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const locationId =
      (req.query.locationId as string) ||
      (req.headers['x-ghl-location'] as string)

    if (!locationId) {
      res.status(401).json({ error: 'Missing locationId', code: 'UNAUTHORIZED' })
      return
    }

    const { rows } = await db.query<{ location_id: string }>(
      'SELECT location_id FROM locations WHERE location_id = $1',
      [locationId]
    )

    if (!rows.length) {
      res.status(401).json({ error: 'Location not registered', code: 'UNAUTHORIZED' })
      return
    }

    next()
  }
}
