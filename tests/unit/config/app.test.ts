import { describe, expect, test } from "vitest";

import { defaultLocale, locales } from "../../../config/app";

describe("config/app", () => {
  test("should expose default locale and locale list", () => {
    expect(defaultLocale).toBe("zh");
    expect(locales).toEqual(["zh", "en"]);
  });
});
