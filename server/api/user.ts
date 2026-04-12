// server/api/user.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { AuthError, UpstoxError } from "../shared/types"

export async function handleGetProfile(
  _req: Request,
  upstoxGet: typeof _upstoxGet = _upstoxGet
): Promise<Response> {
  try {
    const data = await upstoxGet("/user/profile")
    return Response.json(data)
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.code, message: err.message }, { status: 401 })
    }
    if (err instanceof UpstoxError) {
      return Response.json(err.body, { status: err.status })
    }
    return Response.json({ error: "unknown" }, { status: 500 })
  }
}
