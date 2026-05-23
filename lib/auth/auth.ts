import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import bcrypt from "bcrypt";

import { getAuthDb } from "./db";
import { users } from "@/drizzle/schema/auth";
import { eq } from "drizzle-orm";
import { readEnvString } from "@/config/env";

const authSecret = readEnvString("AUTH_SECRET", "");

/**
 * 延迟初始化 DrizzleAdapter，避免 build 时因缺少 DATABASE_URL 而失败。
 * 通过 getter 函数动态获取，build 阶段不会触发。
 */
let _adapter: ReturnType<typeof DrizzleAdapter> | null = null;

function getAdapter() {
  if (!_adapter) {
    _adapter = DrizzleAdapter(getAuthDb());
  }
  return _adapter;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: {
    // 使用 adapter getter 而非直接传 DrizzleAdapter 实例
    // 内部 NextAuth 会在需要时访问这些属性
    __useFactory() {
      return getAdapter();
    },
    // 以下属性在需要时动态获取
    getAdapter() {
      return Promise.resolve(getAdapter());
    },
  } as unknown as ReturnType<typeof DrizzleAdapter>,
  session: {
    strategy: "database",
  },
  secret: authSecret,
  providers: [
    // EARS-6: 覆盖 — bcrypt 验证密码，存 users.password_hash
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

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
      if (user && session.user) {
        // user is cast to our augmented User type which includes id
        session.user.id = (user as { id: string }).id;
      }
      return session;
    },
  },
});