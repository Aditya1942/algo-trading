// server/api/_handle.ts
import { AuthError, UpstoxError } from "../shared/types"

export async function proxyUpstox(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await fn())
  } catch (err) {
    if (err instanceof AuthError)
      return Response.json({ error: err.code, message: err.message }, { status: 401 })
    if (err instanceof UpstoxError)
      return Response.json(err.body, { status: err.status })
    return Response.json({ error: "unknown" }, { status: 500 })
  }
}
