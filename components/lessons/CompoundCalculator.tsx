"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { usePortfolio } from "@/lib/portfolio";

export function CompoundCalculator() {
  const { state, currentProfile, markLessonComplete } = usePortfolio();
  const done = !!state.lessonsCompleted?.["compound"];
  const [start, setStart] = useState(100);
  const [monthly, setMonthly] = useState(20);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(7);

  const months = years * 12;
  const monthlyRate = rate / 100 / 12;

  let balance = start;
  for (let i = 0; i < months; i++) {
    balance = balance * (1 + monthlyRate) + monthly;
  }
  const contributed = start + monthly * months;
  const growth = balance - contributed;

  return (
    <div
      className={`card p-5 flex flex-col gap-4 ${done ? "ring-1 ring-emerald-200" : ""}`}
    >
      <header className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-bold text-lg flex items-center gap-2">
            ✨ The magic of compound interest
          </h3>
          <p className="text-sm text-slate-700">
            When your money earns money, and then *that* money earns money too,
            things snowball. Move the sliders and watch.
          </p>
        </div>
        {done && (
          <span
            className="chip !bg-emerald-100 !text-emerald-800"
            aria-label="Lesson completed"
          >
            ✓ Done
          </span>
        )}
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        <Slider
          label="I start with"
          value={start}
          min={0}
          max={5000}
          step={50}
          format={(v) => formatMoney(v)}
          onChange={setStart}
        />
        <Slider
          label="I add each month"
          value={monthly}
          min={0}
          max={500}
          step={5}
          format={(v) => formatMoney(v)}
          onChange={setMonthly}
        />
        <Slider
          label="For this many years"
          value={years}
          min={1}
          max={60}
          step={1}
          format={(v) => `${v} year${v === 1 ? "" : "s"}`}
          onChange={setYears}
        />
        <Slider
          label="Average yearly return"
          value={rate}
          min={0}
          max={15}
          step={0.5}
          format={(v) => `${v}%`}
          onChange={setRate}
        />
      </div>

      <div className="rounded-2xl bg-indigo-50 p-5 flex flex-col gap-2">
        <div className="text-xs uppercase font-semibold text-indigo-700">
          After {years} year{years === 1 ? "" : "s"} you&apos;d have
        </div>
        <div className="text-3xl font-extrabold tabular-nums">
          {formatMoney(balance)}
        </div>
        <div className="text-xs text-slate-700">
          You added <strong>{formatMoney(contributed)}</strong> from your
          pocket. Interest grew that by{" "}
          <strong className="text-emerald-700">
            {formatMoney(growth)}
          </strong>{" "}
          {contributed > 0 && (
            <>(that&apos;s {((growth / contributed) * 100).toFixed(0)}% extra!)</>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-700">
        💡 7% is roughly the long-term average for the U.S. stock market — not
        a guarantee. Real years go up and down.
      </p>
      {currentProfile && !done && (
        <button
          type="button"
          className="btn btn-ghost w-fit text-sm"
          onClick={() => markLessonComplete("compound")}
        >
          ✓ I got it
        </button>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{label}</span>
        <span className="text-indigo-700 font-bold tabular-nums">
          {format(value)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-indigo-600"
        aria-label={label}
      />
    </label>
  );
}
