import { describe, expect, test } from "vitest";

import {
  MAX_RETRY,
  MAX_WORDS,
  MIN_WORDS,
  QUICK_START_MIN_CHARS,
} from "../../../config/novel";

describe("config/novel", () => {
  test("should expose default novel constraints", () => {
    expect(MIN_WORDS).toBe(3000);
    expect(MAX_WORDS).toBe(5000);
    expect(MAX_RETRY).toBe(3);
    expect(QUICK_START_MIN_CHARS).toBe(20);
  });
});
