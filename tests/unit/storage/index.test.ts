import { afterEach, describe, expect, test, vi } from "vitest";

describe("lib/storage/index", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test("should create R2 storage driver", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "account-id");
    vi.stubEnv("R2_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-key");
    vi.stubEnv("R2_BUCKET", "bucket-name");

    const storage = await import("../../../lib/storage");
    const r2Module = await import("../../../lib/storage/r2-storage-driver");

    const driver = storage.createStorageDriver();

    expect(driver).toBeInstanceOf(r2Module.R2StorageDriver);
  });
});

