"use client";

import { useEffect, useState } from "react";
import { usePortfolio } from "@/lib/portfolio";

type Question = {
  id: string;
  prompt: string;
  options: {
    label: string;
    explain: string;
    correct: boolean;
  }[];
};

const QUESTIONS: Question[] = [
  {
    id: "q1",
    prompt: "Which Cub is taking less risk?",
    options: [
      {
        label:
          "🐯 Tiger puts all $10,000 into one video-game company. If that game flops, oof.",
        explain:
          "All your eggs are in one basket. One bad surprise and your money takes a big hit.",
        correct: false,
      },
      {
        label:
          "🦊 Fox spreads $10,000 across a phone maker, a food company, a bank, a chip maker, and a toy maker.",
        explain:
          "Even if one company has a bad year, the others can help cushion the fall. That's diversification.",
        correct: true,
      },
    ],
  },
  {
    id: "q2",
    prompt: "For most investors, “long-term” means…",
    options: [
      {
        label: "A few weeks ⏱️",
        explain: "Way too short — daily price wiggles can be huge.",
        correct: false,
      },
      {
        label: "A few months 📆",
        explain: "Still pretty short. Markets can drop and recover slowly.",
        correct: false,
      },
      {
        label: "Many years 🌳",
        explain:
          "Yes! Real investors usually hold for years, sometimes decades. That's when compounding does its best work.",
        correct: true,
      },
    ],
  },
  {
    id: "q3",
    prompt: "Your favorite stock drops 10% in one day. What's a smart first move?",
    options: [
      {
        label: "Panic-sell everything 😱",
        explain:
          "Selling on a bad day locks in the loss. Most pros say don't react to one scary day.",
        correct: false,
      },
      {
        label:
          "Check if the company is still doing well, then decide 🧠",
        explain:
          "Yep. The price moved, but did the *business* change? Re-check your reasons before doing anything.",
        correct: true,
      },
      {
        label: "Always buy more 💸",
        explain:
          "Sometimes that's right (it's on sale!), but only if you've checked the business is still strong.",
        correct: false,
      },
    ],
  },
];

export function DiversificationQuiz() {
  const { state, currentProfile, markLessonComplete } = usePortfolio();
  const lessonDone = !!state.lessonsCompleted?.["quiz"];
  const [picks, setPicks] = useState<Record<string, number>>({});

  const answered = Object.keys(picks).length;
  const correctCount = QUESTIONS.reduce((acc, q) => {
    const idx = picks[q.id];
    return idx != null && q.options[idx].correct ? acc + 1 : acc;
  }, 0);
  const done = answered === QUESTIONS.length;

  // Auto-mark the quiz lesson done the first time a Cub finishes all
  // questions. Doesn't require getting every answer right — engaging with
  // the explanations is the point.
  useEffect(() => {
    if (done && currentProfile && !lessonDone) {
      markLessonComplete("quiz");
    }
  }, [done, currentProfile, lessonDone, markLessonComplete]);

  return (
    <div
      className={`card p-5 flex flex-col gap-4 ${lessonDone ? "ring-1 ring-emerald-200" : ""}`}
    >
      <header className="flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className="font-bold text-lg flex items-center gap-2">
          🧠 Quick quiz
          {lessonDone && (
            <span
              className="chip !bg-emerald-100 !text-emerald-800 text-xs"
              aria-label="Lesson completed"
            >
              ✓ Done
            </span>
          )}
        </h3>
        <div className="text-xs text-slate-700">
          {answered}/{QUESTIONS.length} answered
          {done && (
            <>
              {" "}· 🏅 {correctCount}/{QUESTIONS.length} right
            </>
          )}
        </div>
      </header>

      <ol className="flex flex-col gap-5">
        {QUESTIONS.map((q, qIdx) => (
          <li key={q.id} className="flex flex-col gap-2">
            <div className="font-semibold text-sm">
              <span className="text-indigo-700 mr-2">{qIdx + 1}.</span>
              {q.prompt}
            </div>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, oIdx) => {
                const picked = picks[q.id];
                const isPicked = picked === oIdx;
                const revealed = picked !== undefined;
                const styles = !revealed
                  ? "border-slate-200 hover:bg-slate-50"
                  : opt.correct
                    ? "border-emerald-300 bg-emerald-50"
                    : isPicked
                      ? "border-rose-300 bg-rose-50"
                      : "border-slate-200 opacity-70";
                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() =>
                      setPicks((p) => ({ ...p, [q.id]: oIdx }))
                    }
                    disabled={revealed}
                    className={`text-left rounded-xl border p-3 text-sm transition-colors ${styles}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="font-semibold">{opt.label}</span>
                      {revealed && opt.correct && (
                        <span className="ml-auto text-emerald-700 font-bold">
                          ✓
                        </span>
                      )}
                      {revealed && isPicked && !opt.correct && (
                        <span className="ml-auto text-rose-700 font-bold">
                          ✗
                        </span>
                      )}
                    </div>
                    {revealed && (isPicked || opt.correct) && (
                      <div
                        className={`mt-2 text-xs ${
                          opt.correct ? "text-emerald-800" : "text-rose-800"
                        }`}
                      >
                        {opt.explain}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {done && (
        <div className="rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900 flex items-center justify-between gap-3 flex-wrap">
          <span>
            {correctCount === QUESTIONS.length
              ? "🏆 Perfect! You've got the basics down."
              : correctCount >= 2
                ? "👏 Nice — you've got most of it."
                : "🌱 Good start — read the explanations and try again."}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setPicks({})}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
