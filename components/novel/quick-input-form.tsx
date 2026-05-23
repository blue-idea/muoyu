"use client";

/**
 * Inline Quick Input Form (for L0 dashboard)
 *
 * Shown on the dashboard for logged-in users as the "快捷输入" entry point.
 * Submits directly to the extract API and redirects to /quick-start on success.
 *
 * EARS-1: REQ-003-AC-001 已登录用户 L0 首页显示快捷输入
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuickInputFormProps {
  className?: string;
}

export function QuickInputForm({ className }: QuickInputFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length < 5) return;

    startTransition(async () => {
      const res = await fetch("/api/quick-start/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed }),
      });

      if (res.ok) {
        router.push("/quick-start");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={className}
    >
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Quick input: describe your story idea..."
          className="flex-1"
          maxLength={500}
          aria-label="Quick story description"
        />
        <Button
          type="submit"
          disabled={isPending || value.trim().length < 5}
          variant="secondary"
          size="sm"
        >
          {isPending ? "..." : "Go"}
        </Button>
      </div>
    </form>
  );
}