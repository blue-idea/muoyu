export type StorageObjectList = string[];

export interface StorageDriver {
  readText(key: string): Promise<string>;
  writeText(key: string, body: string): Promise<void>;
  readBytes(key: string): Promise<Uint8Array>;
  writeBytes(key: string, body: Uint8Array, contentType?: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix: string): Promise<StorageObjectList>;
  deletePrefix(prefix: string): Promise<void>;
}

