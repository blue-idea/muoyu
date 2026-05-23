"use client";

/**
 * 设置页 - 统一导航
 *
 * EARS-5: 设置页统一导航，子页切换不丢失表单状态
 * 「创作偏好」与「AI 模型」两个子页
 *
 * 未登录用户访问偏好设置 → 跳转登录页（由服务端 auth() 处理）
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = "preferences" | "ai-model";

const TABS: { id: Tab; label: string; href: string }[] = [
  { id: "preferences", label: "创作偏好", href: "/settings/preferences" },
  { id: "ai-model", label: "AI 模型", href: "/settings/ai-model" },
];

export default function SettingsPage() {
  const pathname = usePathname();
  const activeTab: Tab = pathname.includes("ai-model") ? "ai-model" : "preferences";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="flex h-14 items-center border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Settings</h1>
      </header>

      <div className="flex flex-1">
        <nav className="w-56 border-r border-zinc-200 bg-white py-6 dark:border-zinc-800 dark:bg-zinc-950">
          <ul className="flex flex-col gap-1 px-3">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <Link
                    href={tab.href}
                    className={`
                      flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors
                      ${
                        isActive
                          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                      }
                    `}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="flex-1 p-6">
          <div className="mx-auto max-w-2xl">
            <p className="text-sm text-zinc-500">
              Select a subpage from the sidebar to manage your preferences and AI model settings.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}