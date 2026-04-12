// server/shared/app-logger.ts
// File-based app logging: >> incoming, << outgoing, !! errors (matches Neome AppLog conventions)

import { appendFile, mkdir, readdir, stat, unlink } from "node:fs/promises"
import { join } from "node:path"

/** Incoming / received (HTTP request) */
export const LOG_RECV = ">>"
/** Outgoing / sent (HTTP response) */
export const LOG_SEND = "<<"
/** Error or crash */
export const LOG_WTF = "!!"

const DEFAULT_RETENTION_DAYS = 2
const LOG_PREFIX = "app_"
const LOG_EXT = ".log"
const MAX_BODY_LOG = 4096
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000

function logDir(): string {
  return process.env.APP_LOG_DIR ?? join(import.meta.dir, "..", "logs")
}

function retentionDays(): number {
  const n = Number(process.env.APP_LOG_RETENTION_DAYS)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_RETENTION_DAYS
}

function nowLine(): string {
  return new Date().toISOString()
}

function padClass(cls: string, max = 25): string {
  return cls.length > max ? cls.slice(0, max) : cls.padEnd(max)
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ""}`
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function redactHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  h.forEach((v, k) => {
    const low = k.toLowerCase()
    if (low === "authorization" || low === "cookie") out[k] = "<redacted>"
    else out[k] = v
  })
  return out
}

async function readBodyLimited(req: Request, max: number): Promise<string> {
  try {
    const t = await req.text()
    return t.length > max ? `${t.slice(0, max)}…` : t
  } catch {
    return "<unreadable>"
  }
}

let writeQueue: Promise<void> = Promise.resolve()

/** Await pending file writes (tests / shutdown). */
export function flushLogs(): Promise<void> {
  return writeQueue
}

function enqueueWrite(filePath: string, line: string): void {
  const payload = `${line}\n`
  writeQueue = writeQueue.then(() => appendFile(filePath, payload, "utf8")).catch((err) => {
    console.error("[app-logger] write failed:", err)
  })
}

function currentLogFilePath(): string {
  const day = new Date().toISOString().slice(0, 10)
  return join(logDir(), `${LOG_PREFIX}${day}${LOG_EXT}`)
}

async function appendLine(symbol: string, message: string): Promise<void> {
  const dir = logDir()
  await mkdir(dir, { recursive: true })
  const line = `${symbol} ${nowLine()} | ${message}`
  enqueueWrite(currentLogFilePath(), line)
}

export async function cleanupOldLogs(): Promise<void> {
  const dir = logDir()
  const days = retentionDays()
  const maxAgeMs = days * 24 * 60 * 60 * 1000
  const cutoff = Date.now() - maxAgeMs
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (!name.startsWith(LOG_PREFIX) || !name.endsWith(LOG_EXT)) continue
    const full = join(dir, name)
    try {
      const s = await stat(full)
      if (s.mtimeMs < cutoff) await unlink(full)
    } catch {
      /* ignore */
    }
  }
}

let cleanupTimer: ReturnType<typeof setInterval> | undefined

function scheduleCleanup(): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    void cleanupOldLogs()
  }, CLEANUP_INTERVAL_MS)
  if (typeof cleanupTimer.unref === "function") cleanupTimer.unref()
}

void cleanupOldLogs().then(scheduleCleanup)

/** Log HTTP request (incoming). */
export async function logHttpRequest(req: Request): Promise<void> {
  const url = new URL(req.url)
  const path = `${url.pathname}${url.search}`
  const headers = redactHeaders(req.headers)
  const hasBody = !["GET", "HEAD"].includes(req.method)
  const body = hasBody ? await readBodyLimited(req.clone(), MAX_BODY_LOG) : ""
  const bodyPart = body ? ` | body=${body}` : ""
  await appendLine(
    LOG_RECV,
    `${req.method} ${path} | headers=${JSON.stringify(headers)}${bodyPart}`,
  )
}

/** Log HTTP response (outgoing). */
export async function logHttpResponse(req: Request, res: Response, durationMs: number): Promise<void> {
  const url = new URL(req.url)
  const path = `${url.pathname}${url.search}`
  let body = ""
  try {
    const ct = res.headers.get("content-type") ?? ""
    if (ct.includes("json") || ct.includes("text") || ct.includes("xml")) {
      body = await readBodyLimited(res.clone(), MAX_BODY_LOG)
    } else {
      body = `<${ct || "no content-type"}>`
    }
  } catch {
    body = "<unreadable>"
  }
  await appendLine(
    LOG_SEND,
    `${req.method} ${path} | ${res.status} ${res.statusText} | ${durationMs.toFixed(1)}ms | body=${body}`,
  )
}

/** Log error or crash. */
export async function logWtf(cls: string, message?: string, err?: unknown): Promise<void> {
  const errPart = err !== undefined ? ` | ${stringifyError(err)}` : ""
  await appendLine(LOG_WTF, `${padClass(cls)} | ${message ?? ""}${errPart}`)
}

export const appLogger = {
  /** `>>` — use for incoming-style events */
  recv: (cls: string, message: string) => appendLine(LOG_RECV, `${padClass(cls)} | ${message}`),
  /** `<<` — use for outgoing-style events */
  send: (cls: string, message: string) => appendLine(LOG_SEND, `${padClass(cls)} | ${message}`),
  /** `!!` — errors / crashes */
  wtf: logWtf,
  cleanup: cleanupOldLogs,
}

/**
 * Wrap a route handler: logs >> request, << response, and !! on thrown errors (rethrows).
 */
export function withHttpLogging(
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    await logHttpRequest(req)
    const t0 = performance.now()
    try {
      const res = await handler(req)
      await logHttpResponse(req, res, performance.now() - t0)
      return res
    } catch (err) {
      await logWtf("HttpHandler", "request handler threw", err)
      throw err
    }
  }
}
