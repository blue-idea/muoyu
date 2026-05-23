"use client";

/**
 * Wizard L1 Page - Core Questions (Q1-Q3)
 *
 * EARS-1: L1 提交时静默更新偏好存储（无需显式保存）
 * EARS-2: 打开向导时预填偏好字段
 * REQ-004: Q1 题材创意、Q2 主角、Q3 核心冲突分步呈现
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useWizardStore } from "@/lib/wizard/wizard-store";
import {
  wizardSaveLayer1,
  wizardUpdateCreationConfig,
} from "@/app/actions/wizard";
import type { WizardAllData } from "@/lib/wizard/wizard-store";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const GENRE_OPTIONS = [
  "都市现实", "奇幻玄幻", "武侠仙侠", "科幻末日", "悬疑推理",
  "浪漫青春", "军事历史", "游戏竞技", "轻小说",
];

const PROTAGONIST_TYPE_OPTIONS = [
  "单主角", "双主角", "多主角", "无明确主角", "群像",
];

const CONFLICT_TYPE_OPTIONS = [
  "人物驱动", "事件驱动", "关系驱动", "成长驱动", "生存驱动", "复仇驱动", "信仰驱动",
];

// ---------------------------------------------------------------------------
// Store shape for hydration from remote
// ---------------------------------------------------------------------------

interface L1Form {
  genre: string;
  premise: string;
  protagonistType: string;
  protagonistProfession: string;
  protagonistCorePersonality: string;
  protagonistKeySupportingCast: string;
  coreConflictType: string;
  coreConflictDriver: string;
}

interface WizardL1ClientProps {
  projectId: string;
  initialData?: {
    genre?: string;
    premise?: string;
    protagonistType?: string;
    protagonistProfession?: string;
    protagonistCorePersonality?: string;
    protagonistKeySupportingCast?: string;
    coreConflictType?: string;
    coreConflictDriver?: string;
  };
}

export function WizardL1Client({
  projectId,
  initialData,
}: WizardL1ClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Local form state
  const [form, setForm] = useState<L1Form>({
    genre: initialData?.genre ?? "",
    premise: initialData?.premise ?? "",
    protagonistType: initialData?.protagonistType ?? "",
    protagonistProfession: initialData?.protagonistProfession ?? "",
    protagonistCorePersonality: initialData?.protagonistCorePersonality ?? "",
    protagonistKeySupportingCast: initialData?.protagonistKeySupportingCast ?? "",
    coreConflictType: initialData?.coreConflictType ?? "",
    coreConflictDriver: initialData?.coreConflictDriver ?? "",
  });

  // Sync form with store (controlled)
  const store = useWizardStore();

  const updateField = <K extends keyof L1Form>(key: K, value: L1Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    store.saveLayer1({ [key]: value });
  };

  const handleNext = () => {
    startTransition(async () => {
      // Save layer1
      const result = await wizardSaveLayer1(form);
      if ("error" in result) {
        alert(result.error.message);
        return;
      }

      // Update creation_config in DB for persistence
      const currentData: WizardAllData = {
        layer1: form,
        layer2: store.layer2,
        layer3: store.layer3,
      };
      await wizardUpdateCreationConfig(projectId, currentData);

      // Navigate to L2
      router.push(`/projects/${projectId}/wizard/l2`);
    });
  };

  return (
    <div className="space-y-8">
      {/* Q1: Genre & Premise */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Q1 — Genre & Creative Premise
        </h2>

        <div className="space-y-2">
          <label className="text-sm font-medium">Genre</label>
          <div className="flex flex-wrap gap-2">
            {GENRE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => updateField("genre", opt)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  form.genre === opt
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {form.genre === opt ? "⭐ " : ""}{opt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Creative Premise
            <span className="ml-1 text-xs font-normal text-zinc-400">
              (brief description of your story)
            </span>
          </label>
          <textarea
            value={form.premise}
            onChange={(e) => updateField("premise", e.target.value)}
            placeholder="A young chef in Shanghai discovers she can taste people's memories through her cooking..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-y"
            rows={3}
          />
        </div>
      </div>

      {/* Q2: Protagonist */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Q2 — Protagonist
        </h2>

        <div className="space-y-2">
          <label className="text-sm font-medium">Protagonist Type</label>
          <div className="flex flex-wrap gap-2">
            {PROTAGONIST_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => updateField("protagonistType", opt)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  form.protagonistType === opt
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {form.protagonistType === opt ? "⭐ " : ""}{opt}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Profession / Identity</label>
            <input
              type="text"
              value={form.protagonistProfession}
              onChange={(e) => updateField("protagonistProfession", e.target.value)}
              placeholder="Corporate lawyer"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Core Personality</label>
            <input
              type="text"
              value={form.protagonistCorePersonality}
              onChange={(e) => updateField("protagonistCorePersonality", e.target.value)}
              placeholder="Ambitious, guarded, secretly compassionate"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Key Supporting Cast</label>
          <input
            type="text"
            value={form.protagonistKeySupportingCast}
            onChange={(e) => updateField("protagonistKeySupportingCast", e.target.value)}
            placeholder="Mentor figure, rival, love interest"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Q3: Core Conflict */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Q3 — Core Conflict
        </h2>

        <div className="space-y-2">
          <label className="text-sm font-medium">Conflict Type</label>
          <div className="flex flex-wrap gap-2">
            {CONFLICT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => updateField("coreConflictType", opt)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  form.coreConflictType === opt
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {form.coreConflictType === opt ? "⭐ " : ""}{opt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Conflict Driver</label>
          <textarea
            value={form.coreConflictDriver}
            onChange={(e) => updateField("coreConflictDriver", e.target.value)}
            placeholder="What forces your protagonist into action? What do they want vs. what stands in their way?"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-y"
            rows={3}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleNext}
          disabled={isPending || !form.genre || !form.protagonistType || !form.coreConflictType}
          className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isPending ? "Saving..." : "Next →"}
        </button>
      </div>
    </div>
  );
}