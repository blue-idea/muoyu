import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
  throw new Error("DATABASE_URL is required for drizzle-kit.");
}

export default defineConfig({
  out: "./drizzle/migrations",
  schema: "./drizzle/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
