/**
 * Wizard Progress Indicator
 *
 * 显示 L1/L2/L3 进度指示器
 */
import Link from "next/link";

interface WizardProgressProps {
  currentStep: 1 | 2 | 3;
  projectId: string;
}

const STEPS = [
  { step: 1, label: "L1 Core", description: "Genre & Protagonist" },
  { step: 2, label: "L2 Depth", description: "World & Characters" },
  { step: 3, label: "L3 Title", description: "Name Your Novel" },
] as const;

export function WizardProgress({ currentStep, projectId }: WizardProgressProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((s, i) => {
        const isCompleted = s.step < currentStep;
        const isCurrent = s.step === currentStep;
        const isLast = i === STEPS.length - 1;

        return (
          <div key={s.step} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <Link
                href={`/projects/${projectId}/wizard/l${s.step}`}
                className={`
                  flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all
                  ${
                    isCompleted
                      ? "border-primary bg-primary text-primary-foreground cursor-pointer"
                      : isCurrent
                        ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "border-zinc-300 bg-white text-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-500"
                  }
                `}
              >
                {isCompleted ? "✓" : s.step}
              </Link>
              <span
                className={`mt-1 text-xs font-medium ${
                  isCurrent ? "text-primary" : isCompleted ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-400"
                }`}
              >
                {s.label}
              </span>
              <span className="text-xs text-zinc-400">{s.description}</span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={`mb-6 ml-2 mr-2 h-0.5 w-12 ${
                  isCompleted ? "bg-primary" : "bg-zinc-200 dark:bg-zinc-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}