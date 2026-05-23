"use server";

import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { getAuthDb } from "@/lib/auth/db";
import { users } from "@/drizzle/schema/auth";
import { signIn } from "@/lib/auth/auth";

/**
 * Server Action：处理凭据登录。
 *
 * EARS-3 / EARS-5：登录成功后通过 Database Session 建立用户归属关系。
 * 注意：此函数在 redirect 前不会返回，因此 caller 需在 try/catch 中处理。
 */
export async function signInAction(
  prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/dashboard");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (err) {
    const msg = String(err);
    if (msg.includes("CredentialsSignin") || msg.includes("Invalid credentials")) {
      return { error: "Invalid email or password." };
    }
    if (msg.includes("rate") || msg.includes("RateLimit")) {
      return { error: "rateLimited" };
    }
    return { error: "An unexpected error occurred. Please try again." };
  }

  // 如果 signIn 没有抛出异常（通常 redirect 会抛出），返回成功
  return {};
}

/**
 * Server Action：处理 GitHub OAuth 登录。
 */
export async function signInWithGitHubAction(callbackUrl = "/dashboard") {
  await signIn("github", { redirectTo: callbackUrl });
}

/**
 * Server Action：处理 Google OAuth 登录。
 */
export async function signInWithGoogleAction(callbackUrl = "/dashboard") {
  await signIn("google", { redirectTo: callbackUrl });
}

/**
 * Server Action：处理用户注册（Credentials 方式）。
 *
 * EARS-5 / EARS-6:
 * - 注册后建立 userId 与作品归属关系（Database Session）
 * - 密码使用 bcrypt 哈希存储于 users.password_hash
 */
export async function registerAction(
  prevState: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (!name) {
    return { error: "Name is required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  // 密码确认：bcrypt 已做恒定时间比较，此处仅为表单一致性校验
  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const db = getAuthDb();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    return { error: "An account with this email already exists." };
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await db
      .insert(users)
      .values({
        name: name || null,
        email,
        passwordHash,
      });
  } catch (err) {
    console.error("[registerAction] DB error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }

  redirect("/dashboard");
}