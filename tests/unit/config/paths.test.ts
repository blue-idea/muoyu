import { describe, expect, test } from "vitest";

import {
  OUTLINE_FILE_NAME,
  PLANNING_FILE_NAME,
  PROFILE_FILE_NAME,
} from "../../../config/paths";

describe("config/paths", () => {
  test("should expose canonical workspace file names", () => {
    expect(PROFILE_FILE_NAME).toBe("00-人物档案.md");
    expect(OUTLINE_FILE_NAME).toBe("01-大纲.md");
    expect(PLANNING_FILE_NAME).toBe("02-写作计划.json");
  });
});
