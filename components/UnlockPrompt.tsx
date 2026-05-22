"use client";

import { useState } from "react";
import { useParentLock } from "@/lib/parentLock";
import { formatDuration } from "@/lib/format";

export function UnlockPrompt({
  onUnlocked,
  onCancel,
  title = "Enter parent password",
  description,
  autoFocus = true,
}: {
  onUnlocked?: () => void;
  onCancel?: () => void;
  title?: string;
  description?: string;
  autoFocus?: boolean;
}) {
  const { unlock, cooldownUntil, attemptsRemaining } = useParentLock();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cooldownMs = cooldownUntil ? cooldownUntil - Date.now() : 0;
  const inCooldown = cooldownMs > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw || inCooldown) return;
    setBusy(true);
    const r = await unlock(pw);
    setBusy(false);
    if (r.ok) {
      setPw("");
      setErr(null);
      onUnlocked?.();
    } else {
      setErr(r.reason ?? "Could not unlock.");
    }
  }

  return (
    <form onSubmit={submit} className="card p-5 flex flex-col gap-3">
      <h2 className="font-bold flex items-center gap-2">🔒 {title}</h2>
      {description && (
        <p className="text-sm text-slate-700">{description}</p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Parent password</span>
        <input
          type="password"
          className="input"
          value={pw}
          autoFocus={autoFocus}
          autoComplete="current-password"
          disabled={inCooldown}
          onChange={(e) => {
            setPw(e.target.value);
            setErr(null);
          }}
        />
      </label>
      {inCooldown && (
        <div
          role="status"
          className="text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-900"
        >
          ⏳ Too many wrong tries. Try again in{" "}
          <strong>{formatDuration(cooldownMs)}</strong>.
        </div>
      )}
      {!inCooldown && err && (
        <div role="alert" className="text-sm text-rose-700">
          {err}
        </div>
      )}
      {!inCooldown && attemptsRemaining < 5 && attemptsRemaining > 0 && !err && (
        <div className="text-xs text-slate-700">
          {attemptsRemaining} tr{attemptsRemaining === 1 ? "y" : "ies"} left
          before a 10-minute lockout.
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !pw || inCooldown}
        >
          Unlock
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
