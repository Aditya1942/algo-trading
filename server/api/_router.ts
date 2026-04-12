// server/api/_router.ts — dynamic route matcher for path-param routes

type RouteHandler = (req: Request, params: Record<string, string>) => Promise<Response>

type RouteEntry = {
  method: string
  pattern: RegExp
  paramNames: string[]
  handler: RouteHandler
}

const routes: RouteEntry[] = []

/**
 * Register a dynamic route pattern.
 * Pattern uses `:param` syntax, e.g. `/api/v1/upstox/market/holidays/:date`
 */
export function addDynamicRoute(
  method: string,
  path: string,
  handler: RouteHandler
): void {
  const paramNames: string[] = []
  const regexStr = path.replace(/:([^/]+)/g, (_match, name) => {
    paramNames.push(name)
    return "([^/]+)"
  })
  routes.push({
    method: method.toUpperCase(),
    pattern: new RegExp(`^${regexStr}$`),
    paramNames,
    handler,
  })
}

/**
 * Match a request against registered dynamic routes.
 * Returns handler + extracted params, or null if no match.
 */
export function matchRoute(
  req: Request
): { handler: RouteHandler; params: Record<string, string> } | null {
  const url = new URL(req.url)
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  for (const route of routes) {
    if (route.method !== method) continue
    const m = pathname.match(route.pattern)
    if (!m) continue
    const params: Record<string, string> = {}
    for (let i = 0; i < route.paramNames.length; i++) {
      params[route.paramNames[i]] = decodeURIComponent(m[i + 1])
    }
    return { handler: route.handler, params }
  }
  return null
}
