"use client";

/**
 * 在线阅读器客户端组件
 *
 * EARS: REQ-012-AC-001 目录 + MD 正文加载
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ChapterItem {
  chapterNumber: number;
  title: string;
  wordCount?: number;
  wordCountPass?: boolean;
}

interface ReadPageClientProps {
  projectId: string;
  locale: string;
  chapters: ChapterItem[];
  initialChapter: number;
}

export function ReadPageClient({
  projectId,
  locale,
  chapters,
  initialChapter,
}: ReadPageClientProps) {
  const [activeChapter, setActiveChapter] = useState(initialChapter);
  const [chapterContent, setChapterContent] = useState("");
  const [loading, setLoading] = useState(false);

  // 加载章节内容
  useEffect(() => {
    const loadChapter = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/chapters/${activeChapter}/content`,
        );
        const data = await res.json();
        setChapterContent(data.content || "");
      } catch {
        setChapterContent("");
      } finally {
        setLoading(false);
      }
    };

    loadChapter();
  }, [projectId, activeChapter]);

  const currentChapter = chapters.find(
    (ch) => ch.chapterNumber === activeChapter,
  );

  return (
    <div className="flex h-screen">
      {/* 左侧目录 */}
      <aside className="w-64 overflow-auto border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="sticky top-0 border-b border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Chapters
          </h2>
        </div>
        <nav className="p-2">
          {chapters.map((ch) => (
            <button
              key={ch.chapterNumber}
              onClick={() => setActiveChapter(ch.chapterNumber)}
              className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                ch.chapterNumber === activeChapter
                  ? "bg-primary/10 text-primary"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="font-medium">Chapter {ch.chapterNumber}</span>
              <p className="truncate text-xs text-muted-foreground">
                {ch.title}
              </p>
            </button>
          ))}
        </nav>
      </aside>

      {/* 主阅读区 */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-6 py-12">
          {loading ? (
            <div className="text-center text-muted-foreground">Loading...</div>
          ) : (
            <>
              {/* 章节标题 */}
              <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {currentChapter?.title || `Chapter ${activeChapter}`}
              </h1>

              {/* 章节内容 */}
              <div className="prose dark:prose-invert">
                {chapterContent.split("\n").map((line, i) => (
                  <p key={i} className="mb-4 leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>

              {/* 章末导航 */}
              <div className="mt-12 flex justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
                <Button
                  variant="outline"
                  onClick={() => setActiveChapter(activeChapter - 1)}
                  disabled={activeChapter <= 1}
                >
                  ← Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveChapter(activeChapter + 1)}
                  disabled={activeChapter >= chapters.length}
                >
                  Next →
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}