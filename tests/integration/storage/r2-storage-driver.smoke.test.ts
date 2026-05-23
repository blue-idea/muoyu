import { describe, expect, test } from "vitest";

import { createStorageDriver } from "../../../lib/storage";

function isNonEmptyEnv(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasRequiredR2Env(): boolean {
  return (
    isNonEmptyEnv(process.env.R2_ACCOUNT_ID) &&
    isNonEmptyEnv(process.env.R2_ACCESS_KEY_ID) &&
    isNonEmptyEnv(process.env.R2_SECRET_ACCESS_KEY) &&
    isNonEmptyEnv(process.env.R2_BUCKET)
  );
}

async function waitUntil(
  condition: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs: number,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const matched = await condition();
    if (matched) {
      return;
    }

    await new Promise<void>((resolveDelay) => {
      setTimeout(resolveDelay, intervalMs);
    });
  }

  throw new Error("Condition was not met before timeout");
}

const isSmokeTestEnabled = process.env.R2_SMOKE_TEST_ENABLED === "true";
const canRunSmokeTest = isSmokeTestEnabled && hasRequiredR2Env();

describe.skipIf(!canRunSmokeTest)("R2StorageDriver smoke integration", () => {
  test("should read/write/list/delete objects against real R2 bucket", async () => {
    const driver = createStorageDriver();
    const randomSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const prefix = `smoke-tests/${randomSuffix}/`;
    const markdownKey = `${prefix}00-characters.md`;
    const binaryKey = `${prefix}sample.bin`;
    const markdownContent = "# smoke test";
    const binaryContent = new Uint8Array([11, 22, 33, 44]);

    await driver.writeText(markdownKey, markdownContent);
    await driver.writeBytes(binaryKey, binaryContent, "application/octet-stream");

    const markdownText = await driver.readText(markdownKey);
    expect(markdownText).toBe(markdownContent);

    const binaryBytes = await driver.readBytes(binaryKey);
    expect(binaryBytes).toEqual(binaryContent);

    expect(await driver.exists(markdownKey)).toBe(true);
    expect(await driver.exists(binaryKey)).toBe(true);

    const listedKeys = await driver.list(prefix);
    expect(listedKeys).toEqual(expect.arrayContaining(["00-characters.md", "sample.bin"]));

    await driver.deletePrefix(prefix);

    await waitUntil(
      async () => {
        const remains = await driver.list(prefix);
        return remains.length === 0;
      },
      10_000,
      300,
    );
  });
});
