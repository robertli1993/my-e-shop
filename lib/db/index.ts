import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { initializeDatabase } from "./init";
import * as schema from "./schema";

type Store = {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: Database.Database;
};

const globalForDb = globalThis as typeof globalThis & {
  __northlineStore?: Store;
};

function createStore(): Store {
  const configured = process.env.DATABASE_PATH?.trim();
  const file = configured
    ? path.resolve(/* turbopackIgnore: true */ process.cwd(), configured)
    : path.join(process.cwd(), "data", "northline.db");

  fs.mkdirSync(path.dirname(file), { recursive: true });

  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = DELETE");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  initializeDatabase(sqlite);

  return {
    db: drizzle(sqlite, { schema }),
    sqlite,
  };
}

const store = globalForDb.__northlineStore ?? createStore();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__northlineStore = store;
}

export const db = store.db;
export const sqlite = store.sqlite;
export { schema };
