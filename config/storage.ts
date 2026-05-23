import { readEnvString } from "./env";

export type StorageDriverName = "local" | "r2";

export const STORAGE_DRIVER = readEnvString("STORAGE_DRIVER", "local");

function isStorageDriverName(value: string): value is StorageDriverName {
  return value === "local" || value === "r2";
}

export function getStorageDriver(): StorageDriverName {
  if (!isStorageDriverName(STORAGE_DRIVER)) {
    throw new Error(`Invalid STORAGE_DRIVER value: ${STORAGE_DRIVER}`);
  }

  return STORAGE_DRIVER;
}
