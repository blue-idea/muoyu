"use client";

/**
 * 章节编辑器客户端组件
 *
 * EARS: REQ-013-AC-001/005/006
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ChapterItem {
  chapterNumber: number;
  title: string;
  filePath: string;
  status: string;
  wordCount?: number | null;
  wordCountPass?: boolean | null;
}

interface EditPageClientProps {
  projectId: string;
  locale: string;
  chapterNumber: number;
  chapterTitle: string;
  initialContent: string;
  chapters: ChapterItem[];
  outlineContent: string;
  characterContent: string;
}

function countChineseCharacters(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const chinesePunctuation = (text.match(/[\u3000-\u303f\uff00-\uffef]/g) || []).length;
  const westernChars = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const westernPunctuation = (text.match(/[.,!?;:'"()\[\]{}—–-]/g) || []).length;
  return chineseChars + chinesePunctuation + westernChars + westernPunctuation;
}

export function EditPageClient({
  projectId,
  locale,
  chapterNumber,
  chapterTitle,
  initialContent,
  chapters,
  outlineContent,
  characterContent,
}: EditPageClientProps) {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    wordCount?: number;
    wordCountPass?: boolean;
    warning?: string | null;
    error?: string;
  } | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const wordCount = countChineseCharacters(content);
  const wordCountPass = wordCount >= 3000 && wordCount <= 5000;

  const handleSave = async (confirmWarning: boolean = false) => {
    setIsSaving(true);
    setSaveResult(null);
    setShowWarning(false);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/chapters/${chapterNumber}/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, confirmWordCountWarning: confirmWarning }),
        },
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSaveResult({ success: false, error: data.error?.message ?? "Failed to save" });
        return;
      }

      if (data.warning && !confirmWarning) {
        setSaveResult(data);
        setShowWarning(true);
        return;
      }

      setSaveResult({ success: true, wordCount: data.wordCount, wordCountPass: data.wordCountPass });
      setShowWarning(false);
    } catch {
      setSaveResult({ success: false, error: "Network error" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black">
      {/* 左侧章节列表 */}
      <aside className="w-64 overflow-auto border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="sticky top-0 border-b border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Chapters</h2>
        </div>
        <nav className="p-2">
          {chapters.map((ch) => (
            <a
              key={ch.chapterNumber}
              href={`/${locale}/projects/${projectId}/edit/${ch.chapterNumber}`}
              className={`block rounded px-3 py-2 text-sm transition-colors ${
                ch.chapterNumber === chapterNumber
                  ? "bg-primary/10 text-primary"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="font-medium">Chapter {ch.chapterNumber}</span>
              <p className="truncate text-xs text-muted-foreground">{ch.title}</p>
              {ch.wordCountPass === false && (
                <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                  字数未达标
                </span>
              )}
            </a>
          ))}
        </nav>
      </aside>

      {/* 主编辑区 */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{chapterTitle}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Editing Mode</p>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  wordCountPass
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                }`}
              >
                {wordCount} chars {!wordCountPass && <span className="ml-1 text-xs">(⚠️ {"too short"})</span>}
              </div>
              <Button onClick={() => handleSave(showWarning)} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>

          {showWarning && saveResult?.warning && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">{saveResult.warning}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowWarning(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => handleSave(true)}>
                  Save Anyway
                </Button>
              </div>
            </div>
          )}

          {saveResult?.error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <p className="text-sm text-red-700 dark:text-red-300">{saveResult.error}</p>
            </div>
          )}

          {saveResult?.success && !showWarning && (
            <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
              <p className="text-sm text-green-700 dark:text-green-300">
                Saved! ({saveResult.wordCount} characters)
              </p>
            </div>
          )}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="h-[600px] w-full resize-none rounded-lg border border-zinc-200 bg-white p-4 font-mono text-sm text-zinc-800 focus:border-primary focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            placeholder="Enter chapter content..."
          />

          <div className="mt-6 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <a
              href={`/${locale}/projects/${projectId}/read`}
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              ← Back to Reader
            </a>
          </div>
        </div>
      </main>

      {/* 右侧参照 */}
      <aside className="w-72 overflow-auto border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Reference</h3>
        </div>
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h4 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Outline</h4>
          <div className="max-h-64 overflow-auto text-xs text-zinc-600 dark:text-zinc-400">
            {outlineContent ? <pre className="whitespace-pre-wrap">{outlineContent}</pre> : <p className="italic text-zinc-400">No outline</p>}
          </div>
        </div>
        <div className="p-4">
          <h4 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Characters</h4>
          <div className="max-h-64 overflow-auto text-xs text-zinc-600 dark:text-zinc-400">
            {characterContent ? <pre className="whitespace-pre-wrap">{characterContent}</pre> : <p className="italic text-zinc-400">No characters</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}