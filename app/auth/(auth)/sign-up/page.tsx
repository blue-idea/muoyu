import Link from "next/link";
import { Metadata } from "next";
import { SignUpForm } from "../sign-up-form";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your account",
};

/**
 * 注册页。
 * EARS-1: 注册/登录页对访客可访问。
 */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Create an Account</h1>
          <p className="text-sm text-muted-foreground">
            Join to start creating your novel
          </p>
        </div>

        <SignUpForm />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="underline underline-offset-4 hover:text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}