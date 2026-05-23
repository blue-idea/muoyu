/**
 * Wizard L1 Page - Core Questions (Q1-Q3)
 *
 * EARS-1: L1 提交时静默更新偏好存储（无需显式保存）
 * EARS-2: 打开向导时预填偏好字段
 * REQ-004: Q1 题材创意、Q2 主角、Q3 核心冲突分步呈现
 */

import { WizardL1Client } from "./wizard-l1-client";
import { WizardProgress } from "../wizard-progress";
import { wizardGetData } from "@/app/actions/wizard";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function WizardL1Page({ params }: PageProps) {
  const { projectId } = await params;

  // EARS-2: 加载已保存数据用于预填
  const result = await wizardGetData(projectId);

  let initialData = {};
  if ("success" in result && result.success && result.data) {
    const layer1 = result.data.layer1;
    initialData = {
      genre: layer1.genre,
      premise: layer1.premise,
      protagonistType: layer1.protagonistType,
      protagonistProfession: layer1.protagonistProfession,
      protagonistCorePersonality: layer1.protagonistCorePersonality,
      protagonistKeySupportingCast: layer1.protagonistKeySupportingCast,
      coreConflictType: layer1.coreConflictType,
      coreConflictDriver: layer1.coreConflictDriver,
    };
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Creative Wizard
          </h1>
          <p className="text-sm text-zinc-500">
            Step 1 of 3 — Core elements of your story
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-10">
          <WizardProgress currentStep={1} projectId={projectId} />
        </div>

        {/* Step content */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <WizardL1Client projectId={projectId} initialData={initialData} />
        </div>
      </div>
    </div>
  );
}