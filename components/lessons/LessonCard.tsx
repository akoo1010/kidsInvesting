"use client";

import { usePortfolio } from "@/lib/portfolio";

export function LessonCard({
  id,
  emoji,
  title,
  body,
  callout,
}: {
  id: string;
  emoji: string;
  title: string;
  body: React.ReactNode;
  callout: string;
}) {
  const { state, currentProfile, markLessonComplete } = usePortfolio();
  const done = !!state.lessonsCompleted?.[id];

  return (
    <article
      className={`card p-5 flex flex-col gap-3 ${done ? "ring-1 ring-emerald-200" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          {emoji}
        </span>
        <h3 className="font-bold text-lg flex-1">{title}</h3>
        {done && (
          <span
            className="chip !bg-emerald-100 !text-emerald-800"
            aria-label="Lesson completed"
          >
            ✓ Done
          </span>
        )}
      </div>
      <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
      <div className="text-xs font-semibold text-indigo-800 bg-indigo-50 rounded-lg px-3 py-2">
        💡 {callout}
      </div>
      {currentProfile && !done && (
        <button
          type="button"
          className="btn btn-ghost w-fit text-sm"
          onClick={() => markLessonComplete(id)}
        >
          ✓ I got it
        </button>
      )}
    </article>
  );
}
