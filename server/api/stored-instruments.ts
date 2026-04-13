// server/api/stored-instruments.ts — paginated local instrument search
import { searchStoredInstruments, countStoredInstruments } from '../modules/market-data'

// GET /api/v1/instruments/stored?search=&page=1&limit=50
export async function handleGetStoredInstruments(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const search = url.searchParams.get('search') ?? ''
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '50')))

  const { data, total } = searchStoredInstruments(search, page, limit)
  const totalPages = Math.ceil(total / limit)

  return Response.json({
    data,
    total,
    page,
    totalPages,
  })
}

// GET /api/v1/instruments/stored/count
export async function handleGetStoredInstrumentsCount(_req: Request): Promise<Response> {
  const total = countStoredInstruments()
  return Response.json({ total })
}
