// server/shared/upstox.test.ts

// Set required env vars BEFORE any imports
process.env.UPSTOX_CLIENT_ID = "test_client_id"
process.env.UPSTOX_CLIENT_SECRET = "test_client_secret"

import { test, expect, mock } from "bun:test"
import { UpstoxError } from "./types"

test("upstoxGet returns parsed JSON on success", async () => {
  const mockFetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: { name: "Test User" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  )
  const mockGetValidToken = mock(() => Promise.resolve("test_access_token"))

  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch as typeof fetch

  // Dynamic import after mocking
  const { upstoxGet } = await import("./upstox")
  const result = await upstoxGet("/user/profile", mockGetValidToken)

  expect(result).toEqual({ data: { name: "Test User" } })
  expect(mockFetch).toHaveBeenCalledTimes(1)
  const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
  expect(callArgs[0]).toBe("https://api.upstox.com/v2/user/profile")
  expect((callArgs[1]?.headers as Record<string, string>)["Authorization"]).toBe(
    "Bearer test_access_token"
  )

  globalThis.fetch = originalFetch
})

test("upstoxGet throws UpstoxError on non-2xx response", async () => {
  const mockFetch = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    )
  )
  const mockGetValidToken = mock(() => Promise.resolve("bad_token"))
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockFetch as typeof fetch

  const { upstoxGet } = await import("./upstox")

  await expect(upstoxGet("/user/profile", mockGetValidToken)).rejects.toBeInstanceOf(UpstoxError)

  globalThis.fetch = originalFetch
})
