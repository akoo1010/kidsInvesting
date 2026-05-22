"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AVAILABLE_EMOJIS,
  usePortfolio,
} from "@/lib/portfolio";
import type { CubProfile as Profile } from "@/lib/types";
import { STARTING_CASH_AMOUNT } from "@/lib/constants";
import { useParentLock } from "@/lib/parentLock";
import { PasswordSetup } from "@/components/PasswordSetup";
import { UnlockPrompt } from "@/components/UnlockPrompt";
import { BackupRestore } from "@/components/BackupRestore";
import { SyncSection } from "@/components/SyncSection";
import { formatMoney } from "@/lib/format";
import { AvatarPicker } from "@/components/AvatarPicker";

export function AdminView() {
  const {
    ready: portfolioReady,
    profiles,
    currentProfile,
    createProfile,
    deleteProfile,
    renameProfile,
    switchProfile,
    resetProfile,
  } = usePortfolio();
  const {
    ready: lockReady,
    hasPassword,
    isUnlocked,
    lock,
  } = useParentLock();

  // First-render default is "set up a password" — same outcome as
  // !portfolioReady || !lockReady || !hasPassword. Avoids a short skeleton
  // that would jump to a much taller form (CLS).
  if (!portfolioReady || !lockReady || !hasPassword) {
    return (
      <div className="flex flex-col gap-4">
        <header className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold">Parent admin</h1>
        </header>
        <PasswordSetup />
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="flex flex-col gap-4 max-w-xl">
        <header className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold">🔒 Parent admin</h1>
        </header>
        <UnlockPrompt
          title="Enter parent password to manage Cubs"
          description="Switching Cubs, creating new ones, renaming, deleting, and resetting portfolios all require unlocking."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          🔓 Parent admin
        </h1>
        <button onClick={lock} className="btn btn-ghost">
          🔒 Lock now
        </button>
      </header>

      <p className="text-sm text-slate-700">
        Unlock auto-expires after 5 minutes. While unlocked you can switch,
        create, rename, delete, and reset Cubs.
      </p>

      <CubsSection
        profiles={profiles}
        currentProfileId={currentProfile?.id ?? null}
        onSwitch={switchProfile}
        onRename={renameProfile}
        onDelete={deleteProfile}
        onReset={resetProfile}
      />

      <CreateCubSection onCreate={createProfile} />

      <ChangePasswordSection />

      <SyncSection />

      <BackupRestore />

      <p className="text-xs text-slate-600">
        <Link href="/portfolio" className="text-indigo-700 hover:underline">
          ← Back to the kid view
        </Link>
      </p>
    </div>
  );
}

function CubsSection({
  profiles,
  currentProfileId,
  onSwitch,
  onRename,
  onDelete,
  onReset,
}: {
  profiles: Profile[];
  currentProfileId: string | null;
  onSwitch: (id: string) => void;
  onRename: (id: string, name: string, emoji: string) => void;
  onDelete: (id: string) => void;
  onReset: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">Cubs</h2>
      {profiles.length === 0 ? (
        <div className="card p-6 text-slate-700 text-sm">
          No Cubs yet. Create one below.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {profiles.map((p) => (
            <CubRow
              key={p.id}
              profile={p}
              isCurrent={p.id === currentProfileId}
              onSwitch={() => onSwitch(p.id)}
              onSave={(name, emoji) => onRename(p.id, name, emoji)}
              onDelete={() => onDelete(p.id)}
              onReset={() => onReset(p.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CubRow({
  profile,
  isCurrent,
  onSwitch,
  onSave,
  onDelete,
  onReset,
}: {
  profile: Profile;
  isCurrent: boolean;
  onSwitch: () => void;
  onSave: (name: string, emoji: string) => void;
  onDelete: () => void;
  onReset: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [emoji, setEmoji] = useState(profile.emoji);

  return (
    <li className="card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <span
          className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-3xl"
          aria-hidden="true"
        >
          {profile.emoji}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-lg">{profile.name}</span>
            {isCurrent && (
              <span className="chip !bg-emerald-100 !text-emerald-800">
                Active
              </span>
            )}
          </div>
          <div className="text-xs text-slate-600">
            Cub since{" "}
            {new Date(profile.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            · Starts with {formatMoney(STARTING_CASH_AMOUNT)}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isCurrent && (
          <button onClick={onSwitch} className="btn btn-ghost">
            🔄 Switch to this Cub
          </button>
        )}
        <button
          onClick={() => setEditing((v) => !v)}
          className="btn btn-ghost"
        >
          {editing ? "Close" : "✏️ Edit"}
        </button>
        <button
          onClick={() => {
            if (
              confirm(
                `Reset ${profile.name}'s portfolio back to ${formatMoney(STARTING_CASH_AMOUNT)} and clear all trades?`,
              )
            ) {
              onReset();
            }
          }}
          className="btn btn-ghost"
        >
          ♻️ Reset portfolio
        </button>
        <button
          onClick={() => {
            if (
              confirm(
                `Delete ${profile.name}? This erases their portfolio and trades for good.`,
              )
            ) {
              onDelete();
            }
          }}
          className="btn btn-danger"
        >
          🗑️ Delete
        </button>
      </div>

      {editing && (
        <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Name</span>
            <input
              className="input"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="font-semibold">Avatar</legend>
            <AvatarPicker
              value={emoji}
              onChange={setEmoji}
              ariaLabel={`Avatar for ${profile.name}`}
              size="sm"
            />
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-primary"
              disabled={name.trim().length === 0}
              onClick={() => {
                onSave(name, emoji);
                setEditing(false);
              }}
            >
              Save
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setName(profile.name);
                setEmoji(profile.emoji);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function CreateCubSection({
  onCreate,
}: {
  onCreate: (name: string, emoji: string) => Profile | null;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(AVAILABLE_EMOJIS[0]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const created = onCreate(name, emoji);
    if (!created) {
      setError("Pick a name with at least one letter.");
      return;
    }
    setName("");
    setEmoji(AVAILABLE_EMOJIS[0]);
    setError(null);
    setMsg(`Created ${created.name}.`);
  }

  return (
    <section className="card p-5 flex flex-col gap-4">
      <h2 className="text-lg font-bold">Add a new Cub</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Name</span>
          <input
            className="input"
            value={name}
            maxLength={20}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
              setMsg(null);
            }}
            placeholder="e.g. Sam, Mia"
          />
        </label>
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="font-semibold">Avatar</legend>
          <AvatarPicker value={emoji} onChange={setEmoji} size="sm" />
        </fieldset>
        {error && (
          <div role="alert" className="text-sm text-rose-700">
            {error}
          </div>
        )}
        {msg && (
          <div role="status" className="text-sm text-emerald-700">
            {msg}
          </div>
        )}
        <button type="submit" className="btn btn-primary w-fit">
          Create Cub
        </button>
      </form>
    </section>
  );
}

function ChangePasswordSection() {
  const { changePassword } = useParentLock();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== newPw2) {
      setErr("New passwords don't match.");
      return;
    }
    setBusy(true);
    const r = await changePassword(oldPw, newPw);
    setBusy(false);
    if (r.ok) {
      setOldPw("");
      setNewPw("");
      setNewPw2("");
      setErr(null);
      setMsg("Password updated.");
    } else {
      setErr(r.reason ?? "Could not change password.");
      setMsg(null);
    }
  }

  return (
    <section className="card p-5 flex flex-col gap-4">
      <h2 className="text-lg font-bold">Change parent password</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Current password</span>
          <input
            type="password"
            className="input"
            value={oldPw}
            autoComplete="current-password"
            onChange={(e) => {
              setOldPw(e.target.value);
              setErr(null);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">New password</span>
          <input
            type="password"
            className="input"
            value={newPw}
            autoComplete="new-password"
            minLength={4}
            onChange={(e) => {
              setNewPw(e.target.value);
              setErr(null);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Confirm new password</span>
          <input
            type="password"
            className="input"
            value={newPw2}
            autoComplete="new-password"
            minLength={4}
            onChange={(e) => {
              setNewPw2(e.target.value);
              setErr(null);
            }}
          />
        </label>
        {err && (
          <div role="alert" className="text-sm text-rose-700">
            {err}
          </div>
        )}
        {msg && (
          <div role="status" className="text-sm text-emerald-700">
            {msg}
          </div>
        )}
        <button
          type="submit"
          className="btn btn-primary w-fit"
          disabled={busy || !oldPw || newPw.length < 4 || newPw2.length < 4}
        >
          Update password
        </button>
      </form>
    </section>
  );
}
