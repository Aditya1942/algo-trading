# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See root `CLAUDE.md` for full project context and architecture.

**REST routes:** Register JSON API handlers under `/api/v1/` (OAuth callbacks such as `/auth/callback` stay at the server root).

## Commands (from server/)

```bash
bun --hot run index.ts    # dev server with hot reload
bun test                  # run all tests
bun test path/to/file.test.ts  # single test file
bun install               # install deps
```

## Bun-First Rules

All code must use Bun APIs — never Node/npm/vite equivalents:

| Use | Not |
|-----|-----|
| `Bun.serve()` | express |
| `bun:sqlite` | better-sqlite3 |
| `Bun.file` | fs.readFile/writeFile |
| `Bun.$\`cmd\`` | execa |
| `bun test` | jest / vitest |
| `bun build` | webpack / esbuild / vite |

Bun loads `.env` automatically — no dotenv.

Frontend: serve HTML files via `Bun.serve()` routes. HTML files import `.tsx` directly; Bun bundles automatically.
