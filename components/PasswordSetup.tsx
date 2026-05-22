"use client";

import { useState } from "react";
import { useParentLock } from "@/lib/parentLock";

export function PasswordSetup({ onDone }: { onDone?: () => void }) {
  const { setPassword } = useParentLock();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy(true);
    const r = await setPassword(pw);
    setBusy(false);
    if (r.ok) {
      setPw("");
      setPw2("");
      onDone?.();
    } else {
      setErr(r.reason ?? "Could not save password.");
    }
  }

  return (
    <form onSubmit={submit} className="card p-6 flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          👋 Welcome — parent setup
        </h2>
        <p className="text-sm text-slate-700">
          Pick a password so kids can play, but only you can create, switch,
          rename, delete, or reset Cubs. At least 4 characters.
        </p>
      </header>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">New parent password</span>
        <input
          type="password"
          className="input"
          value={pw}
          autoComplete="new-password"
          minLength={4}
          onChange={(e) => {
            setPw(e.target.value);
            setErr(null);
          }}
          autoFocus
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Confirm password</span>
        <input
          type="password"
          className="input"
          value={pw2}
          autoComplete="new-password"
          minLength={4}
          onChange={(e) => {
            setPw2(e.target.value);
            setErr(null);
          }}
        />
      </label>

      {err && (
        <div role="alert" className="text-sm text-rose-700">
          {err}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary w-fit"
        disabled={busy || pw.length < 4 || pw2.length < 4}
      >
        Save password
      </button>

      <p className="text-xs text-slate-600">
        The password is stored on this device only (hashed, never sent
        anywhere). If forgotten, clear the site&apos;s storage in your browser to
        reset.
      </p>
    </form>
  );
}
