/**
 * 首页 / L0 快速入口
 *
 * EARS-1: REQ-003-AC-011 访客首页价值说明+登录注册CTA
 * EARS-2: REQ-003-AC-001 已登录L0首页显示新建/续写/快捷输入入口
 * EARS-4: 未登录用户不可见创作控件
 */
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getProjectService, type ProjectListItem } from "@/lib/projects/project-service";

const MARKETING_FEATURES = [
  { icon: "✨", title: "AI 智能创作", desc: "输入一句话，AI帮你构建完整世界观与情节" },
  { icon: "📚", title: "海量章节", desc: "支持长篇网络小说，章节数量无限制" },
  { icon: "🔄", title: "规划先行", desc: "Phase 2 AI 规划 + Phase 3 自动创作" },
];

export default async function HomePage() {
  const session = await auth();

  // 未登录：展示营销页
  if (!session?.user) {
    return (
      <div className="flex min-h-screen flex-col">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border px-8">
          <h1 className="text-xl font-bold">摸鱼小说</h1>
          <div className="flex gap-3">
            <Link
              href="/auth/sign-in"
              className="px-4 py-2 text-sm hover:bg-muted rounded-md"
            >
              登录
            </Link>
            <Link
              href="/auth/sign-up"
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              注册
            </Link>
          </div>
        </header>

        {/* Hero */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-20">
          <div className="max-w-2xl text-center space-y-6">
            <h2 className="text-4xl font-bold">用 AI 写一部属于你的小说</h2>
            <p className="text-lg text-muted-foreground">
              输入创作意图，AI 帮你完成从世界观构建到章节创作的完整流程
            </p>
            <div className="flex gap-4 justify-center pt-4">
              <Link
                href="/auth/sign-up"
                className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90"
              >
                免费开始创作
              </Link>
              <Link
                href="/auth/sign-in"
                className="px-6 py-3 border border-border rounded-md hover:bg-muted"
              >
                已有账号？登录
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-8 mt-20 max-w-3xl">
            {MARKETING_FEATURES.map((f) => (
              <div key={f.title} className="text-center space-y-2">
                <div className="text-3xl">{f.icon}</div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // 已登录：L0 首页
  const userId = session.user.id as string;
  const service = getProjectService();
  const projects: ProjectListItem[] = await service.getProjectsForDashboard(userId);

  // 找出可以续写的项目
  const writingProject = projects.find((p: ProjectListItem) => p.status === "writing");
  const planningProject = projects.find((p: ProjectListItem) => p.status === "planning");
  const draftProject = projects.find((p: ProjectListItem) => p.status === "draft");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border px-8">
        <h1 className="text-xl font-bold">摸鱼小说</h1>
        <Link
          href="/dashboard"
          className="px-4 py-2 text-sm hover:bg-muted rounded-md"
        >
          我的作品
        </Link>
      </header>

      <main className="flex-1 px-8 py-12 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold mb-8">开始创作</h2>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 新建作品 */}
          <Link
            href="/quick-start"
            className="group border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
          >
            <div className="text-2xl mb-3">✨</div>
            <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
              新建作品
            </h3>
            <p className="text-sm text-muted-foreground">
              输入一句话描述你的故事，AI 帮你构建完整创作计划
            </p>
          </Link>

          {/* 续写进行中 */}
          {writingProject && (
            <Link
              href={`/projects/${writingProject.id}/write`}
              className="group border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
            >
              <div className="text-2xl mb-3">📝</div>
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                继续创作：{writingProject.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {writingProject.chapterCompletedCount ?? 0}/{writingProject.totalChapters ?? "?"} 章已完成
              </p>
            </Link>
          )}

          {/* 规划待确认 */}
          {planningProject && (
            <Link
              href={`/projects/${planningProject.id}/planning`}
              className="group border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
            >
              <div className="text-2xl mb-3">📋</div>
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                确认规划：{planningProject.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {planningProject.planningReady ? "规划已就绪" : "AI 生成中..."}
              </p>
            </Link>
          )}

          {/* 草稿恢复 */}
          {draftProject && (
            <Link
              href={`/projects/${draftProject.id}/wizard`}
              className="group border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
            >
              <div className="text-2xl mb-3">📖</div>
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                完成向导：{draftProject.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                继续你的创作向导配置
              </p>
            </Link>
          )}
        </div>

        {/* 快捷开写 */}
        <div className="mt-8 border-t border-border pt-8">
          <h3 className="font-semibold mb-4">快捷开写</h3>
          <p className="text-sm text-muted-foreground mb-4">
            用一段话描述你的故事，系统帮你提取关键要素
          </p>
          <Link
            href="/quick-start"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
          >
            ✨ 开始快捷开写
          </Link>
        </div>
      </main>
    </div>
  );
}