// server/api/orders.ts
import {
  upstoxGet as _upstoxGet,
  upstoxPost as _upstoxPost,
  upstoxPut as _upstoxPut,
  upstoxDelete as _upstoxDelete,
} from "../shared/upstox"
import { forwardQuery } from "../shared/url"
import { proxyUpstox } from "./_handle"

// --- POST /api/v1/upstox/order/place ---
export async function handlePlaceOrder(
  req: Request,
  upstoxPost: typeof _upstoxPost = _upstoxPost
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxPost("/order/place", body))
}

// --- POST /api/v1/upstox/v3/order/place ---
export async function handlePlaceOrderV3(
  req: Request,
  upstoxPost: typeof _upstoxPost = _upstoxPost
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxPost("/order/place", body, undefined, { version: 3 }))
}

// --- PUT /api/v1/upstox/order/modify ---
export async function handleModifyOrder(
  req: Request,
  upstoxPut: typeof _upstoxPut = _upstoxPut
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxPut("/order/modify", body))
}

// --- PUT /api/v1/upstox/v3/order/modify ---
export async function handleModifyOrderV3(
  req: Request,
  upstoxPut: typeof _upstoxPut = _upstoxPut
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxPut("/order/modify", body, undefined, { version: 3 }))
}

// --- DELETE /api/v1/upstox/order/cancel ---
export async function handleCancelOrder(
  req: Request,
  upstoxDelete: typeof _upstoxDelete = _upstoxDelete
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxDelete(forwardQuery("/order/cancel", req))
  )
}

// --- DELETE /api/v1/upstox/v3/order/cancel ---
export async function handleCancelOrderV3(
  req: Request,
  upstoxDelete: typeof _upstoxDelete = _upstoxDelete
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxDelete(forwardQuery("/order/cancel", req), undefined, undefined, { version: 3 })
  )
}

// --- GET /api/v1/upstox/order/book ---
export async function handleGetOrderBook(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/order/retrieve-all"))
}

// --- GET /api/v1/upstox/order/details ---
export async function handleGetOrderDetails(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/order/details", req))
  )
}

// --- GET /api/v1/upstox/order/history ---
export async function handleGetOrderHistory(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/order/history"))
}

// --- GET /api/v1/upstox/order/trades ---
export async function handleGetOrderTrades(
  req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() =>
    upstoxGet(forwardQuery("/order/trades", req))
  )
}

// --- GET /api/v1/upstox/order/trades/today ---
export async function handleGetTradesToday(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/order/trades/get-trades-for-day"))
}

// --- POST /api/v1/upstox/order/multi/place ---
export async function handleMultiPlaceOrder(
  req: Request,
  upstoxPost: typeof _upstoxPost = _upstoxPost
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxPost("/order/multi/place", body))
}

// --- DELETE /api/v1/upstox/order/multi/cancel ---
export async function handleMultiCancelOrder(
  req: Request,
  upstoxDelete: typeof _upstoxDelete = _upstoxDelete
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxDelete("/order/multi/cancel", body))
}

// --- POST /api/v1/upstox/order/positions/exit ---
export async function handleExitPositions(
  req: Request,
  upstoxPost: typeof _upstoxPost = _upstoxPost
): Promise<Response> {
  const body = await req.json()
  return proxyUpstox(() => upstoxPost("/order/positions/exit", body))
}
