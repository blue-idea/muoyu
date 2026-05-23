"use client";

/**
 * Quick Start Form
 *
 * EARS-3: REQ-003-AC-003 提交描述 → 调用 extract → 展示提取结果
 * EARS-3: REQ-003-AC-004 提取结果页二选一
 * EARS-4: REQ-003-AC-007 全空/失败 → 仅"进入完整向导"按钮
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { ExtractedFields, QuickStartPath } from "@/lib/quickstart/quickstart-service";

interface ExtractResult {
  rawDescription: string;
  fields: ExtractedFields;
  success: boolean;
}

// ---------------------------------------------------------------------------
// Phase: "input" | "result"
// ---------------------------------------------------------------------------

type Phase = "input" | "result";

export function QuickStartForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [phase, setPhase] = useState<Phase>("input");
  const [description, setDescription] = useState("");
  const [extractResult, setExtractResult] = useState<ExtractResult | null>(null);
  const [editedFields, setEditedFields] = useState<ExtractedFields | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Submit description → extract
  // ---------------------------------------------------------------------------

  async function handleSubmitDescription(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!description.trim() || description.trim().length < 5) {
      setError("Please enter at least 5 characters describing your story.");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/quick-start/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      if (!res.ok) {
        setError("Extraction failed. Please try again.");
        return;
      }

      const data = await res.json() as { success: boolean; fields: ExtractedFields };
      const result: ExtractResult = {
        rawDescription: description,
        fields: data.fields,
        success: data.success,
      };

      setExtractResult(result);
      setEditedFields({ ...data.fields });
      setPhase("result");
    });
  }

  // ---------------------------------------------------------------------------
  // Edit extracted field
  // ---------------------------------------------------------------------------

  function handleFieldChange(key: keyof ExtractedFields, value: string) {
    setEditedFields((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  // ---------------------------------------------------------------------------
  // Choose path
  // ---------------------------------------------------------------------------

  function canSkipToPlanning(): boolean {
    if (!extractResult) return false;
    const { fields } = extractResult;
    return Boolean(fields.genre || fields.protagonistType || fields.coreConflictType);
  }

  function handleChoosePath(path: QuickStartPath) {
    if (!editedFields || !extractResult) return;

    startTransition(async () => {
      // Create a draft project with the confirmed fields
      const res = await fetch("/api/quick-start/create-from-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: editedFields,
          path,
          rawDescription: extractResult.rawDescription,
        }),
      });

      if (!res.ok) {
        setError("Failed to create project. Please try again.");
        return;
      }

      const data = await res.json() as { redirectUrl: string };
      router.push(data.redirectUrl);
    });
  }

  // ---------------------------------------------------------------------------
  // Render: Input Phase
  // ---------------------------------------------------------------------------

  if (phase === "input") {
    return (
      <form
        onSubmit={handleSubmitDescription}
        className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="space-y-2">
          <Label htmlFor="description" className="text-base font-medium">
            Describe your novel idea
          </Label>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            In a few sentences, tell us the genre, protagonist, conflict, and setting.
            Minimum 20 characters recommended.
          </p>
          <textarea
            id="description"
            className="min-h-40 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
            placeholder="Example: An urban fantasy where a coffee shop barista discovers she is the last descendant of an ancient order of dragon guardians..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
          <p className="text-xs text-zinc-400">
            {description.length}/500 characters
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || description.trim().length < 5}>
            {isPending ? "Extracting..." : "Extract Key Elements"}
          </Button>
        </div>
      </form>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Result Phase
  // ---------------------------------------------------------------------------

  if (phase === "result" && editedFields) {
    const showSkipToPlanning = canSkipToPlanning();

    return (
      <div className="space-y-6">
        {/* Extracted Fields */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Extracted Elements
          </h2>
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            Review and edit the extracted fields. Your changes will be saved.
          </p>

          <div className="space-y-4">
            <FieldEditor
              label="Genre"
              value={editedFields.genre}
              onChange={(v) => handleFieldChange("genre", v)}
              placeholder="e.g. Urban Fantasy, Sci-Fi, Romance..."
            />
            <FieldEditor
              label="Premise / Plot Summary"
              value={editedFields.premise}
              onChange={(v) => handleFieldChange("premise", v)}
              placeholder="Brief summary of the story premise..."
            />
            <FieldEditor
              label="Protagonist Type"
              value={editedFields.protagonistType}
              onChange={(v) => handleFieldChange("protagonistType", v)}
              placeholder="e.g. Student, Doctor, Assassin..."
            />
            <FieldEditor
              label="Protagonist Profession"
              value={editedFields.protagonistProfession}
              onChange={(v) => handleFieldChange("protagonistProfession", v)}
              placeholder="e.g. Engineer, Lawyer, Teacher..."
            />
            <FieldEditor
              label="Core Conflict"
              value={editedFields.coreConflictType}
              onChange={(v) => handleFieldChange("coreConflictType", v)}
              placeholder="e.g. Revenge, Growth, Romance, Mystery..."
            />
          </div>
        </div>

        {/* Path Choice */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Choose Your Path
          </h2>

          {error && (
            <p className="mb-4 text-sm text-red-500" role="alert">
              {error}
            </p>
          )}

          <div className={`flex flex-col gap-3 ${showSkipToPlanning ? "sm:flex-row" : ""}`}>
            {/* Full Wizard option — always shown */}
            <Button
              onClick={() => handleChoosePath("full-wizard")}
              disabled={isPending}
              className={`flex-1 ${!showSkipToPlanning ? "w-full" : ""}`}
              variant={!showSkipToPlanning ? "default" : "outline"}
            >
              {isPending ? "Processing..." : "Enter Full Wizard"}
            </Button>

            {/* Skip to Planning — only if extraction had useful data */}
            {showSkipToPlanning && (
              <Button
                onClick={() => handleChoosePath("skip-to-planning")}
                disabled={isPending}
                className="flex-1"
                variant="default"
              >
                Skip to Planning
              </Button>
            )}
          </div>

          {showSkipToPlanning && (
            <p className="mt-3 text-xs text-zinc-400">
              You can also use the extracted fields to go through the full wizard step by
              step, or skip ahead directly to planning if you are confident about your
              story elements.
            </p>
          )}

          {!showSkipToPlanning && (
            <p className="mt-3 text-xs text-zinc-400">
              Not enough elements extracted. Please go through the full wizard to fill
              in the required details.
            </p>
          )}
        </div>

        {/* Back to edit description */}
        <button
          type="button"
          onClick={() => {
            setPhase("input");
            setExtractResult(null);
            setEditedFields(null);
            setError(null);
          }}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← Edit description
        </button>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Field Editor Component
// ---------------------------------------------------------------------------

interface FieldEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function FieldEditor({ label, value, onChange, placeholder }: FieldEditorProps) {
  return (
    <div className="space-y-1">
      <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}