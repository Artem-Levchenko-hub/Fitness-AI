import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required for drizzle-kit. " +
      "Set it in .env.local (Supabase project → Settings → Database → Connection string).",
  );
}

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
});
