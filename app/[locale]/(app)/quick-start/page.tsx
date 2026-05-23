/**
 * 快捷开写页面
 *
 * EARS-3: 快捷提取结果页二选一
 * EARS-4: 全空仅向导（无 novelName 先 L3）
 */
import { auth } from "@/lib/auth/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function QuickStartPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/sign-in?callbackUrl=/quick-start");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Quick Start
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Describe your story in a few sentences. We will extract the key
            elements and let you choose your path forward.
          </p>
        </div>

        {/* 描述输入表单 */}
        <form action="/quick-start" method="get" className="space-y-6">
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium mb-2 text-zinc-700 dark:text-zinc-300"
            >
              Your story description (min 20 characters)
            </label>
            <textarea
              id="description"
              name="description"
              rows={5}
              minLength={20}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm text-zinc-900 dark:text-zinc-50"
              placeholder="e.g. I want to write a story about a programmer who travels back to ancient China and becomes an official..."
            />
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90"
          >
            ✨ Extract & Continue
          </button>
        </form>

        {/* 提示信息 */}
        <div className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          <p>Or continue with full wizard setup</p>
          <Link
            href="/dashboard"
            className="mt-2 inline-block text-primary hover:underline"
          >
            Go to Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}