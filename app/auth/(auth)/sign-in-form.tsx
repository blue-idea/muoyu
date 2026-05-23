"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface SignInFormProps {
  callbackUrl?: string;
}

export function SignInForm({ callbackUrl = "/dashboard" }: SignInFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (response.redirected) {
        router.push(response.url);
        return;
      }

      if (!response.ok) {
        const url = new URL(response.url);
        const errorParam = url.searchParams.get("error");
        if (errorParam === "CredentialsSignin") {
          setError("Invalid email or password.");
        } else if (errorParam === "rate_limit") {
          setError("Too many sign-in attempts. Please try again later.");
        } else {
          setError("An unexpected error occurred. Please try again.");
        }
        setIsPending(false);
        return;
      }

      router.push(callbackUrl);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <div className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Your password"
            required
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Signing in..." : "Sign In"}
        </Button>
      </div>
    </form>
  );
}