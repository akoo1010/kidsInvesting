"use client";

import type { Mood } from "@/lib/mood";

const TONE_CLASSES: Record<Mood["tone"], string> = {
  good: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  ok: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  bad: "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
  idle: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
};

export function MoodBadge({
  mood,
  size = "md",
}: {
  mood: Mood;
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  const sign =
    mood.pct == null ? "" : mood.pct >= 0 ? "+" : "";
  const tooltip =
    mood.pct == null
      ? "No holdings yet — buy something to start your day"
      : `Today: ${sign}${mood.pct.toFixed(2)}%`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${
        TONE_CLASSES[mood.tone]
      } ${sm ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"}`}
      title={tooltip}
      aria-label={`Mood: ${mood.label}. ${tooltip}`}
    >
      <span aria-hidden="true">{mood.emoji}</span>
      <span>{mood.label}</span>
    </span>
  );
}
