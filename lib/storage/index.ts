import { getR2StorageConfig } from "../../config/storage";
import { R2StorageDriver } from "./r2-storage-driver";
import type { StorageDriver } from "./types";

export type { StorageDriver } from "./types";
export { R2StorageDriver } from "./r2-storage-driver";

export function createStorageDriver(): StorageDriver {
  return new R2StorageDriver(getR2StorageConfig());
}
