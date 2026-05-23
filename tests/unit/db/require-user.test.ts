import { describe, expect, test } from "vitest";

import { requireUser } from "../../../lib/db/require-user";

describe("requireUser", () => {
  test("should return user id when session is valid", () => {
    const user = requireUser({
      user: {
        id: "user-001",
      },
    });

    expect(user).toEqual({ id: "user-001" });
  });

  test("should throw unauthorized when session is missing", () => {
    expect(() => requireUser(null)).toThrowError("UNAUTHORIZED");
  });

  test("should throw unauthorized when user id is blank", () => {
    expect(() =>
      requireUser({
        user: {
          id: "   ",
        },
      }),
    ).toThrowError("UNAUTHORIZED");
  });
});

