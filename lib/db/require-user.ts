export type SessionUser = Readonly<{
  id: string;
}>;

export type AuthSessionLike = {
  user?: {
    id?: string | null;
  } | null;
} | null;

function normalizeUserId(session: AuthSessionLike): string {
  const rawUserId = session?.user?.id;
  if (typeof rawUserId !== "string") {
    return "";
  }

  return rawUserId.trim();
}

export function requireUser(session: AuthSessionLike): SessionUser {
  const userId = normalizeUserId(session);
  if (userId.length === 0) {
    throw new Error("UNAUTHORIZED");
  }

  return { id: userId };
}

