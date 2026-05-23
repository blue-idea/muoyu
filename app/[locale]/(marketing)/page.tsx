/**
 * Marketing Home Page (Guest / Visitor)
 *
 * EARS-1: REQ-003-AC-011 访客首页展示产品价值说明 + 登录/注册 CTA
 * EARS-5: 访客不可见创作控件（E2E 测试点）
 *
 * 此页面为 (marketing) 路由组，对所有访客公开，无需登录。
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Feature list
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    title: "AI-Powered Story Generation",
    description:
      "Describe your story in a few sentences and let the AI extract key elements — genre, protagonist, conflict — to kickstart your novel.",
  },
  {
    title: "Structured Planning",
    description:
      "From character profiles to chapter outlines and writing plans, the system generates a complete blueprint before a single word of your novel is written.",
  },
  {
    title: "Guided or Unguided Creation",
    description:
      "Go step-by-step through the wizard, or skip ahead to planning. You control how much — or how little — guidance you need.",
  },
  {
    title: "Auto or Manual Writing",
    description:
      "Automatic serial writing lets you watch chapters unfold continuously. Manual mode gives you full control, one chapter at a time.",
  },
  {
    title: "Quality Validation",
    description:
      "Every chapter is validated for word count, tension, and structure before being marked complete. Problematic chapters are automatically rewritten.",
  },
  {
    title: "Export to Multiple Formats",
    description:
      "Export your finished novel as Markdown, plain text, PDF, or EPUB — ready for publishing or sharing.",
  },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function MarketingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      {/* Navigation Bar */}
      <header className="border-b border-zinc-200 bg-white py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4">
          {/* Logo / Brand */}
          <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Moyu Novel
          </span>

          {/* Auth CTA */}
          <nav className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-24 text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
            Write Your Novel
            <br />
            <span className="text-zinc-500">with AI by Your Side</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Describe your story in a few sentences, extract the key elements, and
            let the system generate character profiles, chapter outlines, and
            writing plans — then write chapter by chapter with AI assistance.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/sign-up">
              <Button size="lg" className="min-w-48">
                Start Writing Free
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="outline" size="lg" className="min-w-48">
                Sign In
              </Button>
            </Link>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="border-t border-zinc-200 bg-white py-24 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Everything You Need to Write a Novel
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800"
                >
                  <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-t border-zinc-200 py-24 dark:border-zinc-800">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              How It Works
            </h2>
            <ol className="space-y-8">
              {[
                {
                  step: "1",
                  title: "Describe Your Story",
                  desc: "Enter a few sentences about the novel you want to write — genre, protagonist, conflict, setting.",
                },
                {
                  step: "2",
                  title: "Extract & Choose Your Path",
                  desc: "The AI extracts key elements. You choose: enter the full wizard for detailed setup, or skip straight to planning.",
                },
                {
                  step: "3",
                  title: "Review the Plan",
                  desc: "The system generates character profiles, chapter outlines, and a writing plan. You confirm before writing begins.",
                },
                {
                  step: "4",
                  title: "Write & Validate",
                  desc: "Automatic or manual writing produces chapters that are validated for quality. Export when complete.",
                },
              ].map((item) => (
                <li key={item.step} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-bold text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
                    {item.step}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-zinc-600 dark:text-zinc-400">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t border-zinc-200 bg-zinc-100 py-24 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto max-w-5xl px-4 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Ready to Start Your Novel?
            </h2>
            <p className="mb-8 text-zinc-600 dark:text-zinc-400">
              No credit card required. Free to try.
            </p>
            <Link href="/sign-up">
              <Button size="lg">Create Your First Project</Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-6 dark:border-zinc-800">
        <p className="text-center text-sm text-zinc-500">
          © {new Date().getFullYear()} Moyu Novel. All rights reserved.
        </p>
      </footer>
    </div>
  );
}