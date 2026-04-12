// server/shared/url.ts

/**
 * Appends incoming request query string to an Upstox API path.
 * Returns path unchanged if request has no query params.
 */
export function forwardQuery(basePath: string, req: Request): string {
  const url = new URL(req.url)
  const qs = url.search // includes leading '?' or empty string
  return `${basePath}${qs}`
}
