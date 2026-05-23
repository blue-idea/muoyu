import { afterEach, describe, expect, test, vi } from "vitest";

describe("config/storage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test("should read required R2 env with default endpoint and region", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "account-id");
    vi.stubEnv("R2_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-key");
    vi.stubEnv("R2_BUCKET", "bucket-name");

    const storageConfig = await import("../../../config/storage");

    expect(storageConfig.getR2StorageConfig()).toEqual({
      accountId: "account-id",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      bucket: "bucket-name",
      endpoint: "https://account-id.r2.cloudflarestorage.com",
      region: "auto",
    });
  });

  test("should allow overriding endpoint and region", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "account-id");
    vi.stubEnv("R2_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-key");
    vi.stubEnv("R2_BUCKET", "bucket-name");
    vi.stubEnv("R2_ENDPOINT", "https://custom-r2.example.com");
    vi.stubEnv("R2_REGION", "us-east-1");

    const storageConfig = await import("../../../config/storage");

    expect(storageConfig.getR2StorageConfig()).toEqual({
      accountId: "account-id",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      bucket: "bucket-name",
      endpoint: "https://custom-r2.example.com",
      region: "us-east-1",
    });
  });

  test("should throw when required env is missing", async () => {
    vi.stubEnv("R2_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-key");
    vi.stubEnv("R2_BUCKET", "bucket-name");

    const storageConfig = await import("../../../config/storage");

    expect(() => storageConfig.getR2StorageConfig()).toThrowError(
      "Missing required environment variable: R2_ACCOUNT_ID",
    );
  });
});
