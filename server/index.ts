import { Database } from "bun:sqlite";

// Init DB
const db = new Database("algo.db");
db.run(`
  CREATE TABLE IF NOT EXISTS health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checked_at TEXT NOT NULL
  )
`);

Bun.serve({
  port: 3000,
  routes: {
    "/": () => Response.json({ message: "Hello World", status: "ok" }),

    "/health": {
      GET: () => {
        db.run(`INSERT INTO health (checked_at) VALUES (datetime('now'))`);
        const row = db.query("SELECT COUNT(*) as count FROM health").get() as { count: number };
        return Response.json({ healthy: true, checks: row.count });
      },
    },
  },
  development: true,
});

console.log("Server running on http://localhost:3000");
