"use client";

/**
 * Wizard L3 Page - Title Generation
 *
 * EARS-2: L3 完成后创建 project 并跳转 L4
 * REQ-006: 标题候选生成 + 用户选择/自定义
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useWizardStore } from "@/lib/wizard/wizard-store";
import { wizardSaveLayer3 } from "@/app/actions/wizard";

// ---------------------------------------------------------------------------
// Options for quick title patterns
// ---------------------------------------------------------------------------

const TITLE_PATTERNS = [
  "「{keyword}」系列",
  "{keyword}的奇幻旅程",
  "当{keyword}遇上{keyword2}",
  "第{N}次{keyword}",
  "{keyword}：重生之门",
  "我在{keyword}当{N}的日子",
];

const PLACEHOLDER_KEYWORDS = [
  "星辰", "暗影", "黎明", "裂隙", "永恒", "微光", "深渊", "残章",
];

// ---------------------------------------------------------------------------
// L3 Form type
// ---------------------------------------------------------------------------

interface L3Form {
  selectedTitle: string;
  candidates: string[];
  customTitle: string;
}

interface WizardL3ClientProps {
  projectId: string;
}

export function WizardL3Client({ projectId }: WizardL3ClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [form, setForm] = useState<L3Form>({
    selectedTitle: "",
    candidates: [],
    customTitle: "",
  });

  const store = useWizardStore();

  const generateCandidates = async () => {
    setIsGenerating(true);
    // Simple client-side generation for now
    // In production this would call an LLM via a server action
    await new Promise((r) => setTimeout(r, 800));

    const keyword1 = PLACEHOLDER_KEYWORDS[Math.floor(Math.random() * PLACEHOLDER_KEYWORDS.length)];
    const keyword2 = PLACEHOLDER_KEYWORDS[Math.floor(Math.random() * PLACEHOLDER_KEYWORDS.length)];
    const num = Math.floor(Math.random() * 9) + 2;

    const generated = [
      `${keyword1}之翼`,
      `${keyword1}与${keyword2}的交响曲`,
      `当我找回${keyword1}`,
      `${keyword1}：命运的轮回`,
      `在${keyword1}的彼岸`,
    ];

    setForm((f) => ({ ...f, candidates: generated }));
    setIsGenerating(false);
  };

  const handleSelectTitle = (title: string) => {
    setForm((f) => ({ ...f, selectedTitle: title, customTitle: title }));
  };

  const handleCustomTitleChange = (val: string) => {
    setForm((f) => ({ ...f, selectedTitle: val, customTitle: val }));
  };

  const handleComplete = () => {
    startTransition(async () => {
      const title = form.selectedTitle || form.customTitle.trim();
      if (!title) {
        alert("Please select or enter a title.");
        return;
      }

      const result = await wizardSaveLayer3({
        selectedTitle: title,
        candidates: form.candidates,
        layer1Data: store.layer1,
        layer2Data: store.layer2,
      });

      if ("error" in result) {
        alert(result.error.message);
        return;
      }

      router.push(result.redirectUrl);
    });
  };

  const handleBack = () => {
    router.push(`/projects/${projectId}/wizard/l2`);
  };

  return (
    <div className="space-y-8">
      {/* Summary of L1 + L2 */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-medium text-primary">Story Summary</p>
        <div className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
          <p>
            <span className="font-medium">Genre:</span> {store.layer1.genre || "—"}
          </p>
          <p>
            <span className="font-medium">Protagonist:</span>{" "}
            {store.layer1.protagonistType || "—"}
          </p>
          <p>
            <span className="font-medium">Chapters:</span>{" "}
            {store.layer2.chapterCount || 20}
          </p>
        </div>
      </div>

      {/* Title input */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Name Your Novel
        </h2>

        <div className="space-y-2">
          <label className="text-sm font-medium">Custom Title</label>
          <input
            type="text"
            value={form.customTitle}
            onChange={(e) => handleCustomTitleChange(e.target.value)}
            placeholder="Enter your novel title..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Candidate list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Or Select a Candidate</label>
          <button
            type="button"
            onClick={generateCandidates}
            disabled={isGenerating}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "🎲 Generate New Candidates"}
          </button>
        </div>

        {form.candidates.length > 0 ? (
          <div className="space-y-2">
            {form.candidates.map((title) => (
              <button
                key={title}
                type="button"
                onClick={() => handleSelectTitle(title)}
                className={`w-full rounded-lg border px-4 py-2.5 text-left text-sm transition-all ${
                  form.selectedTitle === title
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {title}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
            Click &quot;Generate&quot; to create title candidates based on your story
          </div>
        )}
      </div>

      {/* Selected preview */}
      {form.selectedTitle && (
        <div className="rounded-lg border border-primary bg-primary/5 p-4 text-center">
          <p className="text-xs text-zinc-500">Selected Title</p>
          <p className="text-xl font-bold text-primary">{form.selectedTitle}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleComplete}
          disabled={isPending || !form.selectedTitle}
          className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Creating Project..." : "Complete →"}
        </button>
      </div>
    </div>
  );
}