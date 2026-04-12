// server/api/user.ts
import { upstoxGet as _upstoxGet } from "../shared/upstox"
import { proxyUpstox } from "./_handle"

export async function handleGetProfile(
  _req: Request,
  upstoxGet: (path: string) => Promise<unknown> = _upstoxGet
): Promise<Response> {
  return proxyUpstox(() => upstoxGet("/user/profile"))
}
