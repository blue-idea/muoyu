"use client";

/**
 * 偏好设置子页
 * EARS-2: 打开向导时预填偏好字段，可视化标记偏好选项
 * EARS-3: 重置偏好恢复默认值
 */
import { useEffect, useState, useTransition } from "react";
import {
  getPreferencesAction,
  updatePreferencesAction,
  resetPreferencesAction,
} from "@/app/actions/preferences";
import { DEFAULT_USER_PREFERENCES } from "@/lib/preferences/preference-service";
import type { UserPreferencesJson } from "@/lib/preferences/preference-service";

interface PreferencesFormState {
  favoriteGenres: string;
  preferredProtagonist: string;
  preferredPerspective: string;
  preferredTone: string;
  typicalChapterCount: string;
}

const GENRE_OPTIONS = [
  "都市现实", "奇幻玄幻", "武侠仙侠", "科幻末日", "悬疑推理",
  "浪漫青春", "军事历史", "游戏竞技", "轻小说",
];

const PROTAGONIST_OPTIONS = [
  "单主角", "双主角", "多主角", "无明确主角", "群像",
];

const PERSPECTIVE_OPTIONS = [
  "第一人称", "第三人称限制视角", "第三人称全知视角", "第二人称",
];

const TONE_OPTIONS = [
  "轻松幽默", "严肃深刻", "紧张刺激", "温情治愈", "黑暗压抑", "热血奋斗",
];

export default function PreferencesPage() {
  const [form, setForm] = useState<PreferencesFormState>({
    favoriteGenres: "",
    preferredProtagonist: "",
    preferredPerspective: "",
    preferredTone: "",
    typicalChapterCount: "20",
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      const result = await getPreferencesAction();
      if ("success" in result && result.success && "preferences" in result) {
        const p = result.preferences;
        setForm({
          favoriteGenres: p.favoriteGenres?.join("、") ?? "",
          preferredProtagonist: p.preferredProtagonist ?? "",
          preferredPerspective: p.preferredPerspective ?? "",
          preferredTone: p.preferredTone ?? "",
          typicalChapterCount: String(p.typicalChapterCount ?? 20),
        });
      }
    });
  }, []);

  const handleSave = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const saveResult = await updatePreferencesAction(
        { genre: form.favoriteGenres },
        {
          perspective: form.preferredPerspective,
          tone: form.preferredTone,
          chapterCount: Number(form.typicalChapterCount) || 20,
        }
      );
      if ("success" in saveResult && saveResult.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const err = saveResult as { error: { message: string } };
        setError(err.error?.message ?? "Failed to save preferences");
      }
    });
  };

  const handleReset = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const resetResult = await resetPreferencesAction();
      if ("success" in resetResult && resetResult.success) {
        setForm({
          favoriteGenres: "",
          preferredProtagonist: "",
          preferredPerspective: "",
          preferredTone: "",
          typicalChapterCount: "20",
        });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const err = resetResult as { error: { message: string } };
        setError(err.error?.message ?? "Failed to reset preferences");
      }
    });
  };

  const isMarked = (field: string, currentVal: string) =>
    Boolean(currentVal) && field === currentVal;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">创作偏好</h2>
        <p className="text-sm text-muted-foreground">
          设置你的题材与风格偏好，新建作品时将自动预填
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">题材（可多选）</label>
        <div className="flex flex-wrap gap-2">
          {GENRE_OPTIONS.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => {
                const current = form.favoriteGenres.split("、").filter(Boolean);
                const updated = current.includes(genre)
                  ? current.filter((g) => g !== genre)
                  : [...current, genre];
                setForm((f) => ({ ...f, favoriteGenres: updated.join("、") }));
              }}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                form.favoriteGenres.includes(genre)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {isMarked(genre, form.favoriteGenres) ? "⭐ " : ""}{genre}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">主角模式</label>
        <div className="flex flex-wrap gap-2">
          {PROTAGONIST_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setForm((f) => ({ ...f, preferredProtagonist: opt }))}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                form.preferredProtagonist === opt
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {isMarked(opt, form.preferredProtagonist) ? "⭐ " : ""}{opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">叙事视角</label>
        <div className="flex flex-wrap gap-2">
          {PERSPECTIVE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setForm((f) => ({ ...f, preferredPerspective: opt }))}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                form.preferredPerspective === opt
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {isMarked(opt, form.preferredPerspective) ? "⭐ " : ""}{opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">基调风格</label>
        <div className="flex flex-wrap gap-2">
          {TONE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setForm((f) => ({ ...f, preferredTone: opt }))}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                form.preferredTone === opt
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              {isMarked(opt, form.preferredTone) ? "⭐ " : ""}{opt}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">预期章节数</label>
        <input
          type="number"
          value={form.typicalChapterCount}
          onChange={(e) => setForm((f) => ({ ...f, typicalChapterCount: e.target.value }))}
          className="w-32 px-3 py-1.5 rounded-md border border-border bg-background text-sm"
          min={1}
          max={9999}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">✅ 保存成功</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "保存中..." : "保存偏好"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={isPending}
          className="px-4 py-2 border border-border rounded-md text-sm hover:bg-muted disabled:opacity-50"
        >
          重置为默认
        </button>
      </div>
    </div>
  );
}