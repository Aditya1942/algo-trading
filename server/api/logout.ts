// server/api/logout.ts
import { clearToken } from "../modules/auth/db"

export async function handleLogout(): Promise<Response> {
  clearToken()
  return Response.json({ success: true })
}
