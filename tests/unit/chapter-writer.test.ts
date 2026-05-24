/**
 * Chapter Writer Unit Tests
 *
 * EARS: REQ-010-AC-001~006
 */

import { describe, it, expect } from "vitest";
import {
  countChineseCharacters,
  isWordCountPass,
  formatChapterNumber,
} from "@/lib/writing/chapter-writer";

// ---------------------------------------------------------------------------
// 字数统计测试
// ---------------------------------------------------------------------------

describe("countChineseCharacters", () => {
  it("should count Chinese characters correctly", () => {
    expect(countChineseCharacters("你好世界")).toBe(4);
    expect(countChineseCharacters("Hello世界")).toBe(7); // 2 Chinese + 5 English letters
  });

  it("should count Chinese punctuation", () => {
    expect(countChineseCharacters("你好，。")).toBe(4); // 2 Chinese + 2 Chinese punctuation (，。)
  });

  it("should count Western characters", () => {
    expect(countChineseCharacters("abc123")).toBe(6);
  });

  it("should handle empty string", () => {
    expect(countChineseCharacters("")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 字数达标测试
// ---------------------------------------------------------------------------

describe("isWordCountPass", () => {
  it("should pass for 3000 chars (min)", () => {
    expect(isWordCountPass(3000)).toBe(true);
  });

  it("should pass for 5000 chars (max)", () => {
    expect(isWordCountPass(5000)).toBe(true);
  });

  it("should pass for 4000 chars (normal)", () => {
    expect(isWordCountPass(4000)).toBe(true);
  });

  it("should fail for 2999 chars (below min)", () => {
    expect(isWordCountPass(2999)).toBe(false);
  });

  it("should fail for 5001 chars (above max)", () => {
    expect(isWordCountPass(5001)).toBe(false);
  });

  it("should fail for 0 chars", () => {
    expect(isWordCountPass(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 章号格式化测试
// ---------------------------------------------------------------------------

describe("formatChapterNumber", () => {
  it("should pad single digit", () => {
    expect(formatChapterNumber(1)).toBe("01");
    expect(formatChapterNumber(5)).toBe("05");
    expect(formatChapterNumber(9)).toBe("09");
  });

  it("should not pad double digits", () => {
    expect(formatChapterNumber(10)).toBe("10");
    expect(formatChapterNumber(99)).toBe("99");
  });

  it("should handle three digits", () => {
    expect(formatChapterNumber(100)).toBe("100");
  });
});