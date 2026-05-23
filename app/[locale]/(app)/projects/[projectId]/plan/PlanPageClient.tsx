"use client";

/**
 * L4 规划确认页 - 规划预览与模式选择
 *
 * EARS-1: REQ-009-AC-001 前5章摘要
 * EARS-2: REQ-009-AC-002 全文折叠可展开
 * EARS-3: REQ-009-AC-003 知识库勾选
 * EARS-4: REQ-009-AC-004 serial/parallel + auto/manual 选择
 */
import { useState, useCallback } from "react";

import { useRouter } from "next/navigation";
import { confirmPlan, type PlanPageData } from "@/app/actions/plan";
import type { WritingMode, CreationPace } from "@/drizzle/schema/enums";

interface PlanPageClientProps {
  projectId: string;
  projectTitle: string;
  totalChapters: number;
  outlineContent: string;
  writingPlanContent: string;
  boundKnowledgeDocs: Array<{ id: string; title: string; status: string }>;
  allKnowledgeDocs: Array<{ id: string; title: string; status: string }>;
  summaries: Array<{ chapterNumber: number; title: string; summary: string }>;
}

// ---------------------------------------------------------------------------
// Writing Mode & Creation Pace 选择器组件
// ---------------------------------------------------------------------------

interface ModeSelectorProps {
  label: string;
  description: string;
  options: Array<{ value: string; label: string; sublabel?: string }>;
  value: string;
  onChange: (value: string) => void;
}

function ModeSelector({ label, description, options, value, onChange }: ModeSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">{label}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
              value === opt.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/50"
            }`}
          >
            {opt.label}
            {opt.sublabel && (
              <span className="block text-xs font-normal mt-0.5 opacity-70">{opt.sublabel}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 章节摘要卡片组件
// ---------------------------------------------------------------------------

interface ChapterSummaryCardProps {
  chapterNumber: number;
  title: string;
  summary: string;
}

function ChapterSummaryCard({ chapterNumber, title, summary }: ChapterSummaryCardProps) {
  return (
    <div className="p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
          Chapter {chapterNumber}
        </span>
      </div>
      <h4 className="text-sm font-semibold text-foreground mb-2">{title}</h4>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{summary}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function PlanPageClient({
  projectId,
  projectTitle,
  totalChapters,
  outlineContent,
  boundKnowledgeDocs,
  allKnowledgeDocs,
  summaries,
}: PlanPageClientProps) {
  const router = useRouter();

  // 展开/折叠状态
  const [outlineExpanded, setOutlineExpanded] = useState(false);

  // 写作模式与创作节奏
  const [writingMode, setWritingMode] = useState<WritingMode>("serial");
  const [creationPace, setCreationPace] = useState<CreationPace>("manual");

  // 知识库勾选
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(
    new Set(boundKnowledgeDocs.map((d) => d.id)),
  );

  // 提交状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 切换知识库勾选
  const toggleDoc = useCallback((docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  }, []);

  // 提交确认
  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await confirmPlan({
        projectId,
        writingMode,
        creationPace,
        boundKnowledgeDocIds: Array.from(selectedDocIds),
      });

      if ("error" in result) {
        setError(result.error.message);
        setIsSubmitting(false);
        return;
      }

      router.push(result.redirectUrl);
    } catch {
      setError("Failed to confirm plan. Please try again.");
      setIsSubmitting(false);
    }
  };

  const writingModeOptions = [
    { value: "serial", label: "Serial", sublabel: "One chapter at a time" },
    { value: "parallel", label: "Parallel", sublabel: "Batch writing (auto mode only)" },
  ];

  const creationPaceOptions = [
    { value: "manual", label: "Manual", sublabel: "Trigger chapter by chapter" },
    { value: "auto", label: "Auto", sublabel: "Continuous background writing" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">Confirm Plan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review your story outline and choose a writing mode.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {/* Project Title */}
        <div>
          <h2 className="text-xl font-semibold text-foreground">{projectTitle}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalChapters} chapters planned
          </p>
        </div>

        {/* EARS-1: 前5章摘要 */}
        <section className="space-y-4">
          <h3 className="text-base font-medium text-foreground">Chapter Summaries</h3>
          {summaries.length > 0 ? (
            <div className="grid gap-4">
              {summaries.map((s) => (
                <ChapterSummaryCard
                  key={s.chapterNumber}
                  chapterNumber={s.chapterNumber}
                  title={s.title}
                  summary={s.summary}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No summaries available yet.</p>
          )}
        </section>

        {/* EARS-2: 全文折叠可展开 */}
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => setOutlineExpanded((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <span className={`transition-transform ${outlineExpanded ? "rotate-90" : ""}`}>
              ▶
            </span>
            Full Outline
          </button>
          {outlineExpanded && (
            <div className="p-4 rounded-lg border border-border bg-card">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
                {outlineContent || "Outline content not available."}
              </pre>
            </div>
          )}
        </section>

        {/* EARS-3: 知识库勾选 */}
        {allKnowledgeDocs.length > 0 && (
          <section className="space-y-4">
            <div>
              <h3 className="text-base font-medium text-foreground">Knowledge Base</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select reference documents for this project.
              </p>
            </div>
            <div className="space-y-2">
              {allKnowledgeDocs.map((doc) => (
                <label
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedDocIds.has(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">
                      {doc.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {doc.status === "ready" ? "Ready" : doc.status}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </section>
        )}

        {/* EARS-4: 写作模式选择 */}
        <section className="space-y-6">
          <div className="h-px bg-border" />

          <ModeSelector
            label="Writing Mode"
            description="How chapters are generated"
            options={writingModeOptions}
            value={writingMode}
            onChange={(v) => setWritingMode(v as WritingMode)}
          />

          {/* creationPace=manual 时强制 serial */}
          {creationPace === "manual" && writingMode === "parallel" && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Parallel mode is only available in auto mode. Switching to serial.
            </p>
          )}

          <ModeSelector
            label="Creation Pace"
            description="When and how chapters are generated"
            options={creationPaceOptions}
            value={creationPace}
            onChange={(v) => {
              setCreationPace(v as CreationPace);
              // manual 时强制 serial
              if (v === "manual" && writingMode === "parallel") {
                setWritingMode("serial");
              }
            }}
          />
        </section>

        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Confirm Button */}
        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Confirming..." : "Confirm & Start Writing"}
          </button>
        </div>
      </main>
    </div>
  );
}