"use client";

/**
 * Wizard L2 Page - Deep Customization (Q4-Q8)
 *
 * EARS-1: L2 提交时静默更新偏好存储
 * REQ-005: Q4-Q8 置于可折叠的「高级选项」区域，可跳过
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useWizardStore } from "@/lib/wizard/wizard-store";
import {
  wizardSaveLayer2,
  wizardUpdateCreationConfig,
} from "@/app/actions/wizard";
import type { WizardAllData } from "@/lib/wizard/wizard-store";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const PERSPECTIVE_OPTIONS = [
  "第一人称", "第三人称限制视角", "第三人称全知视角", "第二人称",
];

const TONE_OPTIONS = [
  "轻松幽默", "严肃深刻", "紧张刺激", "温情治愈", "黑暗压抑", "热血奋斗",
];

const AUDIENCE_OPTIONS = [
  "青少年", "大学生", "职场人群", "中年读者", "老年读者", "全年龄",
];

// ---------------------------------------------------------------------------
// Form type
// ---------------------------------------------------------------------------

interface L2Form {
  worldBackground: string;
  worldUniqueRules: string;
  narrativePerspective: string;
  overallTone: string;
  coreTheme: string;
  targetAudience: string;
  styleReferences: string;
  specialRequirements: string;
  chapterCount: number;
}

interface WizardL2ClientProps {
  projectId: string;
  initialData?: Partial<L2Form>;
}

export function WizardL2Client({ projectId, initialData }: WizardL2ClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<L2Form>({
    worldBackground: initialData?.worldBackground ?? "",
    worldUniqueRules: initialData?.worldUniqueRules ?? "",
    narrativePerspective: initialData?.narrativePerspective ?? "",
    overallTone: initialData?.overallTone ?? "",
    coreTheme: initialData?.coreTheme ?? "",
    targetAudience: initialData?.targetAudience ?? "",
    styleReferences: initialData?.styleReferences ?? "",
    specialRequirements: initialData?.specialRequirements ?? "",
    chapterCount: initialData?.chapterCount ?? 20,
  });

  const store = useWizardStore();

  const updateField = <K extends keyof L2Form>(key: K, value: L2Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    store.saveLayer2({ [key]: value });
  };

  const handleNext = () => {
    startTransition(async () => {
      const result = await wizardSaveLayer2(form);
      if ("error" in result) {
        alert(result.error.message);
        return;
      }

      const currentData: WizardAllData = {
        layer1: store.layer1,
        layer2: form,
        layer3: store.layer3,
      };
      await wizardUpdateCreationConfig(projectId, currentData);

      router.push(`/projects/${projectId}/wizard/l3`);
    });
  };

  const handleSkip = () => {
    startTransition(async () => {
      const result = await wizardSaveLayer2(form);
      if ("error" in result) {
        alert(result.error.message);
        return;
      }

      const currentData: WizardAllData = {
        layer1: store.layer1,
        layer2: form,
        layer3: store.layer3,
      };
      await wizardUpdateCreationConfig(projectId, currentData);

      router.push(`/projects/${projectId}/wizard/l3`);
    });
  };

  const handleBack = () => {
    router.push(`/projects/${projectId}/wizard/l1`);
  };

  return (
    <div className="space-y-8">
      {/* Summary of L1 */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-medium text-primary">L1 Summary</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          {store.layer1.genre && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5">
              {store.layer1.genre}
            </span>
          )}
          {store.layer1.protagonistType && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5">
              {store.layer1.protagonistType}
            </span>
          )}
          {store.layer1.coreConflictType && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5">
              {store.layer1.coreConflictType}
            </span>
          )}
        </div>
      </div>

      {/* Q4: Worldbuilding */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Q4 — World Setting
        </h2>
        <div className="space-y-2">
          <label className="text-sm font-medium">World Background</label>
          <textarea
            value={form.worldBackground}
            onChange={(e) => updateField("worldBackground", e.target.value)}
            placeholder="Modern Shanghai, but with a hidden realm of spirit creatures..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-y"
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Unique Rules</label>
          <textarea
            value={form.worldUniqueRules}
            onChange={(e) => updateField("worldUniqueRules", e.target.value)}
            placeholder="Magic has a price: each spell costs a memory..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-y"
            rows={2}
          />
        </div>
      </div>

      {/* Q5: Perspective & Tone */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Q5 — Narrative Perspective & Tone
        </h2>

        <div className="space-y-2">
          <label className="text-sm font-medium">Narrative Perspective</label>
          <div className="flex flex-wrap gap-2">
            {PERSPECTIVE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => updateField("narrativePerspective", opt)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  form.narrativePerspective === opt
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {form.narrativePerspective === opt ? "⭐ " : ""}{opt}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Overall Tone</label>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => updateField("overallTone", opt)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  form.overallTone === opt
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {form.overallTone === opt ? "⭐ " : ""}{opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Q6: Theme */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Q6 — Core Theme
        </h2>
        <div className="space-y-2">
          <textarea
            value={form.coreTheme}
            onChange={(e) => updateField("coreTheme", e.target.value)}
            placeholder="The true cost of power; love as sacrifice; identity vs. belonging"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-y"
            rows={2}
          />
        </div>
      </div>

      {/* Q7: Audience */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Q7 — Target Audience & Style
        </h2>
        <div className="space-y-2">
          <label className="text-sm font-medium">Target Audience</label>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => updateField("targetAudience", opt)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  form.targetAudience === opt
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {form.targetAudience === opt ? "⭐ " : ""}{opt}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Style References</label>
          <input
            type="text"
            value={form.styleReferences}
            onChange={(e) => updateField("styleReferences", e.target.value)}
            placeholder="Similar to 《斗破苍穹》in tone, or inspired by Murakami's prose"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Q8: Chapter Scale */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Q8 — Chapter Scale
        </h2>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Number of Chapters (default: 20, each 3000-5000 words)
          </label>
          <input
            type="number"
            value={form.chapterCount}
            onChange={(e) => updateField("chapterCount", Number(e.target.value) || 20)}
            className="w-32 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            min={1}
            max={999}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Special Requirements</label>
          <textarea
            value={form.specialRequirements}
            onChange={(e) => updateField("specialRequirements", e.target.value)}
            placeholder="Any special structural requirements or notes for the story..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-y"
            rows={2}
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
        >
          ← Back
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isPending}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500"
          >
            Skip L2
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={isPending}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {isPending ? "Saving..." : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}