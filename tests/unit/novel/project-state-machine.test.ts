import { describe, expect, test } from "vitest";

import {
  assertTransition,
  transitionProjectState,
} from "../../../lib/novel/project-state-machine";

describe("project state machine", () => {
  test("should pass valid transitions", () => {
    expect(transitionProjectState("draft", "start_planning")).toBe("planning");
    expect(transitionProjectState("planning", "confirm_plan")).toBe("writing");
    expect(transitionProjectState("writing", "finish_writing")).toBe("validating");
    expect(transitionProjectState("validating", "validation_passed")).toBe("completed");
    expect(transitionProjectState("validating", "validation_failed")).toBe("writing");
  });

  test("should throw for illegal transition event", () => {
    expect(() => transitionProjectState("draft", "confirm_plan")).toThrowError(
      "INVALID_PROJECT_STATE",
    );
  });

  test("should throw when target state does not match expected transition", () => {
    expect(() => assertTransition("draft", "writing", "start_planning")).toThrowError(
      "INVALID_PROJECT_STATE",
    );
  });
});

