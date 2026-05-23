import { readEnvString } from "./env";

export type R2StorageConfig = Readonly<{
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  region: string;
}>;

function readRequiredEnvString(name: string): string {
  const value = readEnvString(name, "");
  if (value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function resolveDefaultEndpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function getR2StorageConfig(): R2StorageConfig {
  const accountId = readRequiredEnvString("R2_ACCOUNT_ID");
  const accessKeyId = readRequiredEnvString("R2_ACCESS_KEY_ID");
  const secretAccessKey = readRequiredEnvString("R2_SECRET_ACCESS_KEY");
  const bucket = readRequiredEnvString("R2_BUCKET");

  const endpoint = readEnvString("R2_ENDPOINT", resolveDefaultEndpoint(accountId));
  const region = readEnvString("R2_REGION", "auto");

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    region,
  };
}

