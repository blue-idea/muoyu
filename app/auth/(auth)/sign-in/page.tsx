import Link from "next/link";
import { Metadata } from "next";
import { signIn } from "@/lib/auth/auth";
import { Button } from "@/components/ui/button";
import { SignInForm } from "../sign-in-form";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your account",
};

/**
 * 登录页。
 * EARS-1: 注册/登录页对访客可访问。
 * EARS-4: 速率限制时显示错误文案（非阻塞 Toast）。
 */
export default async function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access your account
          </p>
        </div>

        {/* GitHub OAuth */}
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/dashboard" });
          }}
        >
          <Button variant="outline" className="w-full" type="submit">
            Continue with GitHub
          </Button>
        </form>

        {/* Google OAuth */}
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <Button variant="outline" className="w-full" type="submit">
            Continue with Google
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with email
            </span>
          </div>
        </div>

        {/* Credentials 表单（客户端组件处理错误展示） */}
        <SignInForm />

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/auth/sign-up" className="underline underline-offset-4 hover:text-primary">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}