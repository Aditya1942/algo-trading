# Client UI (Vite + shadcn/ui)

Guidance for working in `client/`. Monorepo commands and server API rules live in the repo root [CLAUDE.md](../CLAUDE.md).

## Stack

- **Vite** + **React** + **TypeScript**
- **Tailwind CSS v4** via `@tailwindcss/vite` (no separate `tailwind.config` — theme tokens live in [src/index.css](src/index.css))
- **shadcn/ui** (Radix Nova preset): components are copied into [src/components/ui/](src/components/ui/), not installed as an opaque package
- **Icons:** `lucide-react`
- **Import alias:** `@/` → `src/` (see [components.json](components.json) and [tsconfig.app.json](tsconfig.app.json))

## Commands

Run from `client/` (or use root `bun run client` / `bun run dev`):

```bash
bun install
bun run dev      # Vite dev server (port 3000)
bun run build
bun run lint
```

Add shadcn primitives (preferred over copying from the registry):

```bash
bunx shadcn@latest add <component> -y
```

Initialize was done with:

```bash
bunx shadcn@latest init -t vite -b radix -y -p nova
```

## Usage rules

1. **Imports:** UI primitives from `@/components/ui/<name>`, helpers from `@/lib/utils` (`cn` for class merging).
2. **Do not** paste large blocks from the shadcn website into random files — use the CLI so versions and dependencies stay consistent.
3. **Styling:** Prefer Tailwind utilities and `cn()`. Color and radius come from CSS variables in `index.css` (`bg-background`, `text-muted-foreground`, etc.).
4. **Tooltips:** `SidebarMenuButton` tooltips and other Radix tooltips need [TooltipProvider](src/components/ui/tooltip.tsx) — it wraps the app in [src/main.tsx](src/main.tsx).

## App shell layout

The dashboard shell is [src/components/layout/AppShell.tsx](src/components/layout/AppShell.tsx):

- **`SidebarProvider`** — state for collapse / mobile sheet.
- **`Sidebar`** with `collapsible="icon"` — desktop rail + mobile slide-over (Sheet).
- **`SidebarInset`** — top **header** (`SidebarTrigger` + title) and scrollable **main** area (`children`).

New pages should render **inside** `AppShell` (or be composed as routes that use the same shell). Wire navigation by replacing placeholder `SidebarMenuButton` entries with real links when you add a router.

## ESLint

Generated UI files may export both components and helpers (e.g. `buttonVariants`, `useSidebar`). [eslint.config.js](eslint.config.js) disables `react-refresh/only-export-components` under `src/components/ui/` so shadcn files lint cleanly.
