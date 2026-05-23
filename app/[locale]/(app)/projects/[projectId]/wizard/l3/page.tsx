/**
 * Wizard L3 Page - Title Generation
 *
 * REQ-006: 标题候选生成 + 用户选择/自定义
 * EARS-2: L3 完成后创建 project 并跳转 L4
 */

import { WizardL3Client } from "./wizard-l3-client";
import { WizardProgress } from "../wizard-progress";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function WizardL3Page({ params }: PageProps) {
  const { projectId } = await params;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Creative Wizard
          </h1>
          <p className="text-sm text-zinc-500">
            Step 3 of 3 — Name your novel
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-10">
          <WizardProgress currentStep={3} projectId={projectId} />
        </div>

        {/* Step content */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <WizardL3Client projectId={projectId} />
        </div>
      </div>
    </div>
  );
}