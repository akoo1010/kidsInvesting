"use client";

import { ACHIEVEMENTS } from "@/lib/achievements";

export function AchievementGrid({
  earned,
}: {
  earned: Record<string, number> | undefined;
}) {
  const earnedMap = earned ?? {};
  const earnedCount = Object.keys(earnedMap).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold">Achievements</h2>
        <div className="text-xs text-slate-700">
          {earnedCount} / {ACHIEVEMENTS.length} earned
        </div>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {ACHIEVEMENTS.map((a) => {
          const at = earnedMap[a.id];
          const got = !!at;
          return (
            <li
              key={a.id}
              className={`card p-4 flex flex-col gap-1 ${got ? "" : "opacity-60"}`}
              aria-label={`${got ? "Earned" : "Locked"} achievement: ${a.title}`}
            >
              <div className="text-2xl" aria-hidden="true">
                {got ? a.emoji : "🔒"}
              </div>
              <div className="font-bold text-sm">{a.title}</div>
              <div className="text-xs text-slate-700">{a.description}</div>
              {got && (
                <div className="text-xs text-emerald-700 font-semibold mt-1">
                  Earned{" "}
                  {new Date(at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
