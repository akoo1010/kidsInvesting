"use client";

import { useState } from "react";
import type { Goal } from "@/lib/types";
import { formatMoney } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;

export function GoalCard({
  goal,
  totalValue,
  onSet,
  onClear,
}: {
  goal: Goal | null | undefined;
  // Null until every price has loaded, so an estimate never shows progress.
  totalValue: number | null;
  onSet: (target: number, deadlineMs: number | null) => void;
  onClear: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(
    goal ? String(goal.target) : "11000",
  );
  // Goal deadlines round-trip as YYYY-MM-DD UTC midnight so the date input
  // displays the same day the user picked regardless of timezone.
  const [deadline, setDeadline] = useState<string>(
    goal?.deadline
      ? new Date(goal.deadline).toISOString().slice(0, 10)
      : "",
  );

  function save(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(target);
    if (!Number.isFinite(n) || n <= 0) return;
    const deadlineMs = deadline
      ? Date.UTC(
          Number(deadline.slice(0, 4)),
          Number(deadline.slice(5, 7)) - 1,
          Number(deadline.slice(8, 10)),
          23,
          59,
          59,
        )
      : null;
    onSet(n, deadlineMs);
    setEditing(false);
  }

  if (!goal && !editing) {
    return (
      <div className="card p-5 flex flex-col gap-2">
        <h2 className="font-bold">🎯 Set a goal</h2>
        <p className="text-sm text-slate-700">
          Pick a target — it&apos;s easier to stay focused when you know what
          you&apos;re aiming for.
        </p>
        <button
          className="btn btn-primary w-fit"
          onClick={() => setEditing(true)}
        >
          Set my goal
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <form onSubmit={save} className="card p-5 flex flex-col gap-3">
        <h2 className="font-bold">🎯 {goal ? "Edit goal" : "Set a goal"}</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Target value ($)</span>
          <input
            type="number"
            min="1"
            step="100"
            className="input"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">By (optional)</span>
          <input
            type="date"
            className="input"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary">
            Save goal
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          {goal && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                onClear();
                setEditing(false);
              }}
            >
              Remove goal
            </button>
          )}
        </div>
      </form>
    );
  }

  if (!goal) return null;

  const pct =
    totalValue === null
      ? 0
      : Math.max(0, Math.min(100, (totalValue / goal.target) * 100));
  const reached = totalValue !== null && totalValue >= goal.target;
  const daysLeft =
    goal.deadline != null
      ? Math.ceil((goal.deadline - Date.now()) / DAY_MS)
      : null;

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-bold">🎯 Your goal</h2>
        <button
          className="text-xs font-semibold text-indigo-700 hover:underline"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
      </div>
      <div className="text-sm text-slate-700">
        Reach{" "}
        <strong className="text-slate-900">{formatMoney(goal.target)}</strong>
        {goal.deadline ? (
          <>
            {" "}by{" "}
            <strong className="text-slate-900">
              {new Date(goal.deadline).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
            </strong>
          </>
        ) : null}
        .
      </div>
      <div
        className="h-3 w-full bg-slate-100 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Goal progress"
      >
        <div
          className={`h-full ${reached ? "bg-emerald-600" : "bg-indigo-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-700">
        <span>
          {totalValue === null
            ? "Waiting for prices…"
            : `${formatMoney(totalValue)} of ${formatMoney(goal.target)} (${pct.toFixed(0)}%)`}
        </span>
        {daysLeft !== null && !reached && (
          <span>
            {daysLeft > 0
              ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
              : daysLeft === 0
                ? "Last day!"
                : `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} past`}
          </span>
        )}
        {reached && (
          <span className="font-semibold text-emerald-700">Goal reached! 🏆</span>
        )}
      </div>
    </div>
  );
}
