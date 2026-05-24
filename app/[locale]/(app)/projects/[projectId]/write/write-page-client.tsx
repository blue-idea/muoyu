"use client";

/**
 * WritePage Client Component
 *
 * EARS: REQ-010-AC-010~014
 */

import { useState, useEffect } from "react";
import { generateChapter } from "@/app/actions/writing";

interface Chapter {
  chapterNumber: number;
  title: string;
  status: string;
  wordCount?: number | null;
  wordCountPass?: boolean | null;
}

interface WritingPlan {
  creationPace: string;
  writingMode: string;
  chapters: Chapter[];
}

interface WritePageClientProps {
  projectId: string;
}

export function WritePageClient({ projectId }: WritePageClientProps) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [writingPlan, setWritingPlan] = useState<WritingPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewChapter, setPreviewChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}/writing-plan`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setChapters(data.writingPlan?.chapters ?? []);
        setWritingPlan(data.writingPlan ?? null);
      } catch {
        // ignore network errors
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  const currentChapter = chapters
    .filter((c) => c.status === "pending" || c.status === "failed")
    .sort((a, b) => a.chapterNumber - b.chapterNumber)[0];

  async function handleGenerate(chapterNumber: number) {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await generateChapter({ projectId, chapterNumber });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setChapters((prev) =>
        prev.map((c) =>
          c.chapterNumber === chapterNumber
            ? { ...c, status: result.wordCountPass ? "completed" : "failed", wordCount: result.wordCount, wordCountPass: result.wordCountPass }
            : c,
        ),
      );
      const updated = chapters.find((c) => c.chapterNumber === chapterNumber);
      if (updated) {
        setPreviewChapter({
          ...updated,
          wordCount: result.wordCount,
          wordCountPass: result.wordCountPass,
          status: result.wordCountPass ? "completed" : "failed",
        });
      }
    } catch {
      setError("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">Writing Progress</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manual mode — generate chapters one at a time
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {writingPlan && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
            <span className="text-xs font-medium px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              MANUAL
            </span>
            <span className="text-sm text-muted-foreground">
              Chapters are generated one at a time. You control the pace.
            </span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          {chapters.map((chapter) => {
            const isCurrent = currentChapter?.chapterNumber === chapter.chapterNumber;
            const canGenerate = isCurrent && (chapter.status === "pending" || chapter.status === "failed");
            const isCompleted = chapter.status === "completed";
            const isPreviewing = previewChapter?.chapterNumber === chapter.chapterNumber;

            return (
              <div key={chapter.chapterNumber} className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                      Chapter {chapter.chapterNumber}
                    </span>
                    <span className="text-sm font-medium text-foreground">{chapter.title}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      chapter.status === "completed"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : chapter.status === "failed"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}>
                      {chapter.status}
                    </span>
                    {chapter.wordCount != null && (
                      <span className="text-xs text-muted-foreground">{chapter.wordCount} words</span>
                    )}
                    {canGenerate ? (
                      <button
                        type="button"
                        onClick={() => handleGenerate(chapter.chapterNumber)}
                        disabled={isGenerating}
                        className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {isGenerating ? "Generating..." : "Generate Chapter"}
                      </button>
                    ) : isCompleted ? (
                      <button
                        type="button"
                        onClick={() => setPreviewChapter(chapter)}
                        className="px-4 py-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
                      >
                        Preview
                      </button>
                    ) : null}
                  </div>
                </div>

                {isPreviewing && (
                  <div className="mt-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
                    <p className="text-sm text-foreground">
                      Chapter {previewChapter.chapterNumber} — {previewChapter.wordCount ?? 0} words
                      {previewChapter.wordCountPass !== undefined && (
                        <span className="ml-2 text-xs">
                          {previewChapter.wordCountPass ? "✅ Word count passed" : "❌ Word count failed"}
                        </span>
                      )}
                    </p>
                    {previewChapter.status === "completed" && !isGenerating && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Click the next chapter when ready to continue.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
