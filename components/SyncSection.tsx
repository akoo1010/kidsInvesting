"use client";

import { useState } from "react";
import { useSync } from "@/lib/sync";
import type { SyncStatus } from "@/lib/types";

export function SyncSection() {
  const sync = useSync();
  // No initial-load skeleton — sync.signedInAs is null until auth loads, so
  // the signed-out panel renders right away and the swap (if any) happens
  // within a few ms. A taller skeleton would cause a CLS jump.
  if (sync.signedInAs) {
    return <SignedInPanel />;
  }
  return <SignedOutPanel />;
}

function SignedOutPanel() {
  const sync = useSync();
  const [mode, setMode] = useState<"register" | "signin">("register");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r =
      mode === "register"
        ? await sync.register(handle, password)
        : await sync.signIn(handle, password);
    setBusy(false);
    if (!r.ok) {
      setErr(r.reason ?? "Something went wrong.");
      return;
    }
    setHandle("");
    setPassword("");
  }

  return (
    <section className="card p-5 flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">☁️ Cross-device sync</h2>
        <p className="text-sm text-slate-700">
          Save every Cub&apos;s portfolio to the cloud so it follows the family
          across phones, tablets, and laptops. Optional — the app works
          locally even if you skip this.
        </p>
      </header>

      <div className="flex gap-2 text-sm" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          onClick={() => {
            setMode("register");
            setErr(null);
          }}
          className={`px-3 py-1.5 rounded-lg font-semibold ${
            mode === "register"
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Create family account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => {
            setMode("signin");
            setErr(null);
          }}
          className={`px-3 py-1.5 rounded-lg font-semibold ${
            mode === "signin"
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Sign in to existing
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Family handle</span>
          <input
            className="input"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="smith-family"
            autoComplete="username"
            spellCheck={false}
            disabled={busy}
            required
          />
          <span className="text-xs text-slate-600">
            3–20 characters, lowercase letters / digits / _ / -. Pick something
            you&apos;ll remember.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Sync password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            minLength={6}
            disabled={busy}
            required
          />
          <span className="text-xs text-slate-600">
            At least 6 characters. This is <strong>separate</strong> from the
            local parent password.
          </span>
        </label>

        {err && (
          <div role="alert" className="text-sm text-rose-700">
            {err}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary w-fit"
          disabled={busy || handle.length < 3 || password.length < 6}
        >
          {busy
            ? "Working…"
            : mode === "register"
              ? "Create & start syncing"
              : "Sign in & restore"}
        </button>
      </form>

      <p className="text-xs text-slate-700">
        Signing in on a second device pulls all Cubs from the cloud onto that
        device. Whoever last pushed wins if two devices edit at once.
      </p>
    </section>
  );
}

function SignedInPanel() {
  const sync = useSync();
  const [busy, setBusy] = useState(false);

  async function doSignOut() {
    if (
      !confirm(
        "Sign out of sync? Cubs stay on this device, but new changes won't push to the cloud until you sign back in.",
      )
    ) {
      return;
    }
    setBusy(true);
    await sync.signOut();
    setBusy(false);
  }

  return (
    <section className="card p-5 flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold">
          ☁️ Cross-device sync
        </h2>
        <StatusPill status={sync.status} />
      </header>

      <div className="text-sm text-slate-700">
        Signed in as{" "}
        <strong className="text-slate-900">{sync.signedInAs}</strong>
        {sync.lastSyncedAt && (
          <>
            {" "}· Last synced{" "}
            {new Date(sync.lastSyncedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </>
        )}
      </div>

      {sync.errorMessage && (
        <div
          role="alert"
          className="text-sm rounded-lg px-3 py-2 bg-amber-50 text-amber-900"
        >
          {sync.errorMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => sync.pullNow()}
          className="btn btn-ghost"
          disabled={busy || sync.status === "syncing"}
        >
          🔄 Pull now
        </button>
        <button
          type="button"
          onClick={doSignOut}
          className="btn btn-ghost"
          disabled={busy}
        >
          Sign out of sync
        </button>
      </div>

      <p className="text-xs text-slate-700">
        Changes push automatically about a second after you make them. To pull
        a sibling&apos;s latest changes immediately, tap <strong>Pull now</strong>.
      </p>
    </section>
  );
}

const STATUS_STYLES: Record<SyncStatus, { label: string; className: string }> =
  {
    idle: {
      label: "Idle",
      className: "bg-slate-100 text-slate-700",
    },
    syncing: {
      label: "Syncing…",
      className: "bg-indigo-50 text-indigo-700",
    },
    synced: {
      label: "✓ Synced",
      className: "bg-emerald-50 text-emerald-800",
    },
    offline: {
      label: "Offline",
      className: "bg-amber-50 text-amber-900",
    },
    error: {
      label: "Error",
      className: "bg-rose-50 text-rose-800",
    },
  };

function StatusPill({ status }: { status: SyncStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-slate-200 ${s.className}`}
    >
      {s.label}
    </span>
  );
}
