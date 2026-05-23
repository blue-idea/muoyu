import type { ProjectStatus } from "../../drizzle/schema/enums";

export type ProjectStateEvent =
  | "start_planning"
  | "confirm_plan"
  | "finish_writing"
  | "validation_failed"
  | "validation_passed";

function formatInvalidTransitionMessage(from: ProjectStatus, event: ProjectStateEvent): string {
  return `INVALID_PROJECT_STATE: cannot apply event "${event}" from state "${from}"`;
}

function formatUnexpectedTargetMessage(
  from: ProjectStatus,
  to: ProjectStatus,
  event: ProjectStateEvent,
  expected: ProjectStatus,
): string {
  return `INVALID_PROJECT_STATE: transition "${from}" --(${event})--> "${expected}" expected, got "${to}"`;
}

export function transitionProjectState(from: ProjectStatus, event: ProjectStateEvent): ProjectStatus {
  switch (from) {
    case "draft":
      if (event === "start_planning") {
        return "planning";
      }
      break;
    case "planning":
      if (event === "confirm_plan") {
        return "writing";
      }
      break;
    case "writing":
      if (event === "finish_writing") {
        return "validating";
      }
      break;
    case "validating":
      if (event === "validation_failed") {
        return "writing";
      }
      if (event === "validation_passed") {
        return "completed";
      }
      break;
    case "completed":
      break;
    default:
      break;
  }

  throw new Error(formatInvalidTransitionMessage(from, event));
}

export function assertTransition(
  from: ProjectStatus,
  to: ProjectStatus,
  event: ProjectStateEvent,
): ProjectStatus {
  const expected = transitionProjectState(from, event);
  if (expected !== to) {
    throw new Error(formatUnexpectedTargetMessage(from, to, event, expected));
  }

  return to;
}

