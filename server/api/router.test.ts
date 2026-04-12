// server/api/router.test.ts
import { test, expect, beforeAll } from "bun:test"
import { addDynamicRoute, matchRoute } from "./_router"

// Register test routes before all tests
beforeAll(() => {
  addDynamicRoute("GET", "/test/items/:id", async (_req, params) => {
    return Response.json({ id: params.id })
  })
  addDynamicRoute("GET", "/test/nested/:a/:b/:c", async (_req, params) => {
    return Response.json(params)
  })
  addDynamicRoute("POST", "/test/items/:id", async (_req, params) => {
    return Response.json({ posted: params.id })
  })
})

test("matchRoute returns null for unknown path", () => {
  const req = new Request("http://localhost/unknown/path")
  expect(matchRoute(req)).toBeNull()
})

test("matchRoute extracts single param", () => {
  const req = new Request("http://localhost/test/items/42")
  const result = matchRoute(req)
  expect(result).not.toBeNull()
  expect(result!.params).toEqual({ id: "42" })
})

test("matchRoute extracts multiple params", () => {
  const req = new Request("http://localhost/test/nested/x/y/z")
  const result = matchRoute(req)
  expect(result).not.toBeNull()
  expect(result!.params).toEqual({ a: "x", b: "y", c: "z" })
})

test("matchRoute respects HTTP method", () => {
  const getReq = new Request("http://localhost/test/items/1")
  const postReq = new Request("http://localhost/test/items/1", { method: "POST" })
  const deleteReq = new Request("http://localhost/test/items/1", { method: "DELETE" })

  expect(matchRoute(getReq)).not.toBeNull()
  expect(matchRoute(postReq)).not.toBeNull()
  expect(matchRoute(deleteReq)).toBeNull()
})

test("matchRoute decodes URI components", () => {
  const req = new Request("http://localhost/test/items/NSE_EQ%7CINE002A01018")
  const result = matchRoute(req)
  expect(result).not.toBeNull()
  expect(result!.params.id).toBe("NSE_EQ|INE002A01018")
})

test("matchRoute handler returns correct response", async () => {
  const req = new Request("http://localhost/test/items/99")
  const result = matchRoute(req)
  const res = await result!.handler(req, result!.params)
  expect(await res.json()).toEqual({ id: "99" })
})
