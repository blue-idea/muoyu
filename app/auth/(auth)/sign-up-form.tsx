"use client";

import { useState } from "react";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function SignUpForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    // Client-side validation
    if (!name) {
      setError("Name is required.");
      setIsPending(false);
      return;
    }
    if (!email || !password) {
      setError("Email and password are required.");
      setIsPending(false);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setIsPending(false);
      return;
    }
    // eslint-disable-next-line security/detect-possible-timing-attacks
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsPending(false);
      return;
    }

    // Server action handles registration and redirect on success
    const { registerAction } = await import("./actions");
    const result = await registerAction({}, formData);

    if (result?.error) {
      setError(result.error === "rateLimited"
        ? "Too many requests. Please try again later."
        : result.error);
      setIsPending(false);
    }
    // On success, registerAction will redirect, so no state update needed
  }

  return (
    <Form action={handleSubmit}>
      <div className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Display Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Your name"
            required
            autoComplete="name"
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            required
            autoComplete="new-password"
            minLength={8}
            disabled={isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="Repeat your password"
            required
            autoComplete="new-password"
            disabled={isPending}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Creating account..." : "Create Account"}
        </Button>
      </div>
    </Form>
  );
}