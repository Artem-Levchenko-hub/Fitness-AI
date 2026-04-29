import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn?: ReturnType<typeof postgres>;
};

const conn =
  globalForDb.conn ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    max: 10,
  });

if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema, casing: "snake_case" });

export type Db = typeof db;
