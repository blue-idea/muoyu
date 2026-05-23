import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { readEnvString } from "../../config/env";
import * as schema from "../../drizzle/schema";

function createDatabase(connectionString: string) {
  const pool = new Pool({
    connectionString,
  });

  return drizzle({
    client: pool,
    schema,
  });
}

export type Database = ReturnType<typeof createDatabase>;

let cachedDatabase: Database | null = null;

function readRequiredDatabaseUrl(): string {
  const databaseUrl = readEnvString("DATABASE_URL", "");
  if (databaseUrl.length === 0) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  return databaseUrl;
}

export function getDb(): Database {
  if (cachedDatabase !== null) {
    return cachedDatabase;
  }

  cachedDatabase = createDatabase(readRequiredDatabaseUrl());
  return cachedDatabase;
}

