/**
 * Wizard L2 Page - Deep Customization
 *
 * REQ-005: Q4-Q8 高级选项，可跳过
 * EARS-1: L2 提交时静默更新偏好存储
 */

import { WizardL2Client } from "./wizard-l2-client";
import { WizardProgress } from "../wizard-progress";
import { wizardGetData } from "@/app/actions/wizard";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function WizardL2Page({ params }: PageProps) {
  const { projectId } = await params;

  const result = await wizardGetData(projectId);

  let initialData = {};
  if ("success" in result && result.success && result.data) {
    const layer2 = result.data.layer2;
    initialData = {
      worldBackground: layer2.worldBackground,
      worldUniqueRules: layer2.worldUniqueRules,
      narrativePerspective: layer2.narrativePerspective,
      overallTone: layer2.overallTone,
      coreTheme: layer2.coreTheme,
      targetAudience: layer2.targetAudience,
      styleReferences: layer2.styleReferences,
      specialRequirements: layer2.specialRequirements,
      chapterCount: layer2.chapterCount,
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
            Step 2 of 3 — Deep customization (optional)
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-10">
          <WizardProgress currentStep={2} projectId={projectId} />
        </div>

        {/* Step content */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <WizardL2Client projectId={projectId} initialData={initialData} />
        </div>
      </div>
    </div>
  );
}