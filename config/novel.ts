import { readEnvInteger } from "./env";

export const MIN_WORDS = readEnvInteger("NOVEL_MIN_WORDS", 3000);
export const MAX_WORDS = readEnvInteger("NOVEL_MAX_WORDS", 5000);
export const MAX_RETRY = readEnvInteger("NOVEL_MAX_RETRY", 3);
export const QUICK_START_MIN_CHARS = readEnvInteger(
  "QUICK_START_MIN_CHARS",
  20,
);
