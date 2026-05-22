"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AVAILABLE_EMOJIS, usePortfolio } from "@/lib/portfolio";
import { useParentLock } from "@/lib/parentLock";
import { PasswordSetup } from "@/components/PasswordSetup";
import { UnlockPrompt } from "@/components/UnlockPrompt";
import { AvatarPicker } from "@/components/AvatarPicker";

export function ProfileGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    ready: portfolioReady,
    profiles,
    currentProfile,
    switchProfile,
    createProfile,
  } = usePortfolio();
  const {
    ready: lockReady,
    hasPassword,
    isUnlocked,
  } = useParentLock();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(AVAILABLE_EMOJIS[0]);
  const [error, setError] = useState<string | null>(null);

  // The /admin route handles its own password setup, unlock, and "no Cubs"
  // states. Letting it through the gate keeps it reachable for parents who
  // haven't picked a Cub yet (e.g. after deleting the last one).
  if (pathname?.startsWith("/admin")) {
    return <>{children}</>;
  }

  if (!portfolioReady || !lockReady) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div
          className="card p-6 animate-pulse w-72 h-32"
          aria-label="Loading"
          role="status"
        />
      </div>
    );
  }

  // Once a kid is playing on an active profile, the gate is transparent.
  if (currentProfile) {
    return <>{children}</>;
  }

  // First-run: no parent password set yet.
  if (!hasPassword) {
    return (
      <div className="flex-1 w-full max-w-xl mx-auto py-10">
        <PasswordSetup />
      </div>
    );
  }

  // Password set but locked — need parent to unlock before picking a Cub.
  if (!isUnlocked) {
    return (
      <div className="flex-1 w-full max-w-xl mx-auto py-10 flex flex-col gap-4">
        <header className="text-center flex flex-col gap-2">
          <div className="text-5xl">🔒</div>
          <h1 className="text-2xl font-extrabold">Parent only</h1>
          <p className="text-slate-700">
            Enter the parent password to pick or create a Cub.
          </p>
        </header>
        <UnlockPrompt
          title="Unlock to manage Cubs"
          description="Buying, selling, and exploring stocks are always open. Switching or creating Cubs is parent-only."
        />
      </div>
    );
  }

  // Unlocked & no current profile → show picker.
  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const created = createProfile(name, emoji);
    if (!created) {
      setError("Pick a name with at least one letter.");
      return;
    }
    setName("");
    setEmoji(AVAILABLE_EMOJIS[0]);
    setError(null);
    setShowCreate(false);
  }

  const noProfiles = profiles.length === 0;

  return (
    <div className="flex-1 w-full max-w-2xl mx-auto py-10 flex flex-col gap-6">
      <header className="text-center flex flex-col gap-2">
        <div className="text-5xl">🐻</div>
        <h1 className="text-3xl font-extrabold">Who&apos;s playing?</h1>
        <p className="text-slate-700">
          {noProfiles
            ? "Create a Cub to start a $10,000 pretend portfolio."
            : "Pick your Cub to keep practicing — or add a new one."}
        </p>
      </header>

      {!noProfiles && !showCreate && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {profiles.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => switchProfile(p.id)}
                className="card w-full p-5 flex items-center gap-4 hover:shadow-md transition-shadow text-left"
              >
                <span className="text-4xl" aria-hidden="true">
                  {p.emoji}
                </span>
                <span className="flex-1">
                  <span className="block font-bold text-lg">{p.name}</span>
                  <span className="block text-xs text-slate-600">
                    Cub since{" "}
                    {new Date(p.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </span>
                <span aria-hidden="true" className="text-slate-500">
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="btn btn-primary w-full sm:w-fit sm:mx-auto"
        >
          ➕ Add a new Cub
        </button>
      )}

      {showCreate && (
        <form onSubmit={handleCreate} className="card p-6 flex flex-col gap-4">
          <h2 className="font-bold text-lg">Create a new Cub</h2>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Pick a name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="e.g. Sam, Mia"
              autoFocus
            />
          </label>

          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="font-semibold">Pick an avatar</legend>
            <AvatarPicker value={emoji} onChange={setEmoji} size="md" />
          </fieldset>

          {error && (
            <div role="alert" className="text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary">
              Start playing
            </button>
            {!noProfiles && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setShowCreate(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      <p className="text-center text-xs text-slate-600">
        Cubs are saved on this device only. Switching, renaming, or resetting a
        Cub needs the parent password.
      </p>
    </div>
  );
}
