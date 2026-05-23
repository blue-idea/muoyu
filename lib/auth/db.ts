import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { readEnvString } from "../../config/env";
import type { NodePgClient } from "drizzle-orm/node-postgres/session";

function createAuthDatabase(connectionString: string) {
  const pool = new Pool({
    connectionString,
  });

  return drizzle({ client: pool as NodePgClient });
}

export type AuthDatabase = ReturnType<typeof createAuthDatabase>;

let cachedAuthDatabase: AuthDatabase | null = null;

function readRequiredDatabaseUrl(): string {
  const databaseUrl = readEnvString("DATABASE_URL", "");
  if (databaseUrl.length === 0) {
    throw new Error("Missing required environment variable: DATABASE_URL");
  }

  return databaseUrl;
}

export function getAuthDb(): AuthDatabase {
  if (cachedAuthDatabase !== null) {
    return cachedAuthDatabase;
  }

  cachedAuthDatabase = createAuthDatabase(readRequiredDatabaseUrl());
  return cachedAuthDatabase;
}