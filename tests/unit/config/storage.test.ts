import { afterEach, describe, expect, test, vi } from "vitest";

describe("config/storage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test("should default to local driver", async () => {
    const storageConfig = await import("../../../config/storage");

    expect(storageConfig.STORAGE_DRIVER).toBe("local");
    expect(storageConfig.getStorageDriver()).toBe("local");
  });

  test("should support r2 driver", async () => {
    vi.stubEnv("STORAGE_DRIVER", "r2");
    const storageConfig = await import("../../../config/storage");

    expect(storageConfig.STORAGE_DRIVER).toBe("r2");
    expect(storageConfig.getStorageDriver()).toBe("r2");
  });

  test("should throw when storage driver is invalid", async () => {
    vi.stubEnv("STORAGE_DRIVER", "memory");
    const storageConfig = await import("../../../config/storage");

    expect(() => storageConfig.getStorageDriver()).toThrowError(
      "Invalid STORAGE_DRIVER value: memory",
    );
  });
});
