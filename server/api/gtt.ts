// server/api/gtt.ts
import {
  upstoxGet as _upstoxGet,
  upstoxPost as _upstoxPost,
  upstoxPut as _upstoxPut,
  upstoxDelete as _upstoxDelete,
} from "../shared/upstox"
import { forwardQuery } from "../shared/url"
import { proxyUpstox } from "./_handle"

// --- POST /api/v1/upstox/v3/order/gtt/place ---
export async function handlePlaceGtt(
  req: Request,
  upstoxPost: typeof _upstoxPost = _upstoxPost
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxPost("/order/gtt/place", body, undefined, { version: 3 }))
}

// --- PUT /api/v1/upstox/v3/order/gtt/modify ---
export async function handleModifyGtt(
  req: Request,
  upstoxPut: typeof _upstoxPut = _upstoxPut
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxPut("/order/gtt/modify", body, undefined, { version: 3 }))
}

// --- DELETE /api/v1/upstox/v3/order/gtt/cancel ---
export async function handleCancelGtt(
  req: Request,
  upstoxDelete: typeof _upstoxDelete = _upstoxDelete
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxDelete(forwardQuery("/order/gtt/cancel", req), undefined, undefined, { version: 3 })
  )
}

// --- GET /api/v1/upstox/v3/order/gtt ---
export async function handleGetGttOrders(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/order/gtt", req), undefined, { version: 3 })
  )
}
