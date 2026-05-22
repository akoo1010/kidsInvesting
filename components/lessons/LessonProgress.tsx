"use client";

import { usePortfolio } from "@/lib/portfolio";
import { LESSON_COUNT, LESSONS } from "@/lib/lessons";

export function LessonProgress() {
  const { ready, state, currentProfile, resetLessonProgress } = usePortfolio();
  const completed = state.lessonsCompleted ?? {};
  const doneCount = LESSONS.filter((l) => l.id in completed).length;
  const pct = LESSON_COUNT === 0 ? 0 : (doneCount / LESSON_COUNT) * 100;
  const allDone = doneCount === LESSON_COUNT && doneCount > 0;

  if (!ready || !currentProfile) {
    return (
      <div className="card p-5 flex flex-col gap-2">
        <h2 className="font-bold">📈 Investing 101</h2>
        <p className="text-sm text-slate-700">
          Pick a Cub to track your lesson progress.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h2 className="font-bold">📈 Investing 101 progress</h2>
        <div className="text-xs text-slate-700">
          {doneCount} / {LESSON_COUNT} done
        </div>
      </div>
      <div
        className="h-3 w-full bg-slate-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Lesson progress"
      >
        <div
          className={`h-full transition-all ${allDone ? "bg-emerald-600" : "bg-indigo-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-slate-700">
        <span>
          {allDone
            ? "🎓 You've finished every lesson — nice work!"
            : doneCount === 0
              ? "Mark each lesson done as you go."
              : "Keep going — almost there."}
        </span>
        {doneCount > 0 && (
          <button
            type="button"
            className="text-indigo-700 hover:underline font-semibold"
            onClick={() => {
              if (confirm("Reset lesson progress for this Cub?")) {
                resetLessonProgress();
              }
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
