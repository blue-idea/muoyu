/**
 * NextAuth v5 配置
 * 所有导出均来自 next-auth v5 beta API
 */
import NextAuth from "next-auth";
import type { Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

import { readEnvString } from "@/config/env";
import { users } from "@/drizzle/schema/auth";
import { getAuthDb } from "./db";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

type AuthProvider = "credentials" | "github" | "google";

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function createAdapter() {
  const databaseUrl = readEnvString("DATABASE_URL", "");
  if (databaseUrl.length === 0) {
    return undefined;
  }
  return DrizzleAdapter(getAuthDb());
}

function readRedirectTo(redirectTo: string | undefined, fallback: string): string {
  if (!redirectTo || redirectTo.trim().length === 0) {
    return fallback;
  }
  return redirectTo;
}

function buildOAuthSignInUrl(provider: "github" | "google", callbackUrl: string): string {
  const query = new URLSearchParams({ callbackUrl });
  return `/api/auth/signin/${provider}?${query.toString()}`;
}

// ---------------------------------------------------------------------------
// NextAuth 配置
// ---------------------------------------------------------------------------

const adapter = createAdapter();
const authSecret = readEnvString("AUTH_SECRET", "");

const authOptions = {
  adapter,
  session: {
    strategy: adapter ? "database" as const : "jwt" as const,
  },
  secret: authSecret,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const rawEmail = (credentials as { email?: string } | undefined)?.email;
        const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
        const password = (credentials as { password?: string } | undefined)?.password ?? "";

        if (email.length === 0 || password.length === 0) {
          return null;
        }

        const db = getAuthDb();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.passwordHash) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    GitHub({
      clientId: readEnvString("AUTH_GITHUB_ID", ""),
      clientSecret: readEnvString("AUTH_GITHUB_SECRET", ""),
    }),
    Google({
      clientId: readEnvString("AUTH_GOOGLE_ID", ""),
      clientSecret: readEnvString("AUTH_GOOGLE_SECRET", ""),
    }),
  ],
  callbacks: {
    session({ session, user }: { session: Session; user: { id: string } }): Session {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};

// ---------------------------------------------------------------------------
// 导出（next-auth v5 格式）
// ---------------------------------------------------------------------------

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);

export async function signInProvider(provider: AuthProvider, options: { redirectTo?: string } = {}) {
  if (provider === "credentials") {
    throw new Error("Credentials sign-in should use /api/auth/callback/credentials.");
  }

  const callbackUrl = readRedirectTo(options.redirectTo, "/dashboard");
  const { redirect } = await import("next/navigation");
  redirect(buildOAuthSignInUrl(provider, callbackUrl));
}

export async function signOutProvider(options: { redirectTo?: string } = {}) {
  const callbackUrl = readRedirectTo(options.redirectTo, "/");
  const { redirect } = await import("next/navigation");
  const query = new URLSearchParams({ callbackUrl });
  redirect(`/api/auth/signout?${query.toString()}`);
}