import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtemp, readdir, utimes, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("app-logger", () => {
  let dir: string
  let mod: typeof import("./app-logger")

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "applog-"))
    process.env.APP_LOG_DIR = dir
    mod = await import("./app-logger")
  })

  afterAll(() => {
    delete process.env.APP_LOG_DIR
  })

  test("recv appends >> line to daily file", async () => {
    await mod.appLogger.recv("TestClass", "hello")
    await mod.flushLogs()
    const files = await readdir(dir)
    expect(files.some((f) => f.startsWith("app_") && f.endsWith(".log"))).toBe(true)
    const logFile = files.find((f) => f.startsWith("app_") && f.endsWith(".log"))!
    const text = await Bun.file(join(dir, logFile)).text()
    expect(text).toContain(">>")
    expect(text).toContain("TestClass")
    expect(text).toContain("hello")
  })

  test("symbols match Neome-style constants", () => {
    expect(mod.LOG_RECV).toBe(">>")
    expect(mod.LOG_SEND).toBe("<<")
    expect(mod.LOG_WTF).toBe("!!")
  })

  test("cleanupOldLogs removes files older than retention", async () => {
    process.env.APP_LOG_RETENTION_DAYS = "2"
    const stale = join(dir, "app_1999-01-01.log")
    await writeFile(stale, "old\n")
    const ancient = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    await utimes(stale, ancient, ancient)
    await mod.cleanupOldLogs()
    const files = await readdir(dir)
    expect(files.includes("app_1999-01-01.log")).toBe(false)
  })
})
