import { redirect } from "next/navigation";
import NextAuth, { getServerSession, type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

import { readEnvString } from "@/config/env";
import { users } from "@/drizzle/schema/auth";
import { getAuthDb } from "./db";

type AuthProvider = "credentials" | "github" | "google";

type SignInOptions = {
  redirectTo?: string;
  email?: string;
  password?: string;
};

type SignOutOptions = {
  redirectTo?: string;
};

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

const adapter = createAdapter();
const authSecret = readEnvString("AUTH_SECRET", "");

export const authOptions: NextAuthOptions = {
  adapter,
  session: {
    strategy: adapter ? "database" : "jwt",
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
        const email = credentials?.email?.trim().toLowerCase() ?? "";
        const password = credentials?.password ?? "";

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
    async session({ session, user }) {
      if (session.user && user?.id) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};

const nextAuthHandler = NextAuth(authOptions);

export const handlers = {
  GET: nextAuthHandler,
  POST: nextAuthHandler,
};

export async function auth() {
  return getServerSession(authOptions);
}

export async function signIn(provider: AuthProvider, options: SignInOptions = {}) {
  if (provider === "credentials") {
    throw new Error("Credentials sign-in should use /api/auth/callback/credentials.");
  }

  const callbackUrl = readRedirectTo(options.redirectTo, "/dashboard");
  redirect(buildOAuthSignInUrl(provider, callbackUrl));
}

export async function signOut(options: SignOutOptions = {}) {
  const callbackUrl = readRedirectTo(options.redirectTo, "/");
  const query = new URLSearchParams({ callbackUrl });
  redirect(`/api/auth/signout?${query.toString()}`);
}
