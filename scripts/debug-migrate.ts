import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  try {
    await migrate(db, { migrationsFolder: "./db/migrations" });
    console.log("migrations applied");
  } catch (e) {
    console.error("migration failed:");
    console.error(e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
