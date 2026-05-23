const EMPTY_TEXT = "";

function normalizeValue(value: string | undefined): string {
  if (value === undefined) {
    return EMPTY_TEXT;
  }

  return value.trim();
}

function readProcessEnv(name: string): string | undefined {
  const value = Reflect.get(process.env, name);
  if (typeof value !== "string") {
    return undefined;
  }

  return value;
}

export function readEnvString(name: string, fallback: string): string {
  const normalized = normalizeValue(readProcessEnv(name));
  if (normalized.length === 0) {
    return fallback;
  }

  return normalized;
}

export function readEnvInteger(name: string, fallback: number): number {
  const normalized = normalizeValue(readProcessEnv(name));
  if (normalized.length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for ${name}: ${normalized}`);
  }

  return parsed;
}
