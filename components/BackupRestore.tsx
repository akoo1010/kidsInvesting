"use client";

import { useRef, useState } from "react";
import { usePortfolio } from "@/lib/portfolio";
import { useParentLock } from "@/lib/parentLock";
import {
  type SyncedSnapshot,
  validateSnapshot,
  normalizeBackup,
  type BackupV1,
  type Preview,
  BACKUP_VERSION,
  APP_TAG,
} from "@/lib/snapshot";

export function BackupRestore() {
  const { profiles, portfolios, replaceStore } = usePortfolio();
  const { storedSnapshot, replaceParentLock } = useParentLock();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function download() {
    setError(null);
    setSuccess(null);
    const backup: BackupV1 = {
      version: BACKUP_VERSION,
      app: APP_TAG,
      exportedAt: Date.now(),
      snapshot: {
        portfolios: {
          profiles,
          currentProfileId: profiles[0]?.id ?? null,
          portfolios,
        },
        parentLock: storedSnapshot,
      },
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wall-street-cubs-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setSuccess(
      `Downloaded ${profiles.length} Cub${profiles.length === 1 ? "" : "s"}.`,
    );
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setSuccess(null);
    const file = e.target.files?.[0];
    // Reset so picking the same file twice in a row still fires.
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data = parseBackup(JSON.parse(text));
      setPreview({
        data,
        cubNames: data.snapshot.portfolios.profiles.map((p) => p.name),
        hasPassword: !!data.snapshot.parentLock,
        exportedAt: data.exportedAt,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "That doesn't look like a Wall Street Cubs backup.",
      );
    }
  }

  function confirmImport() {
    if (!preview) return;
    replaceStore(preview.data.snapshot.portfolios);
    replaceParentLock(preview.data.snapshot.parentLock);
    setPreview(null);
    setSuccess(
      `Restored ${preview.cubNames.length} Cub${
        preview.cubNames.length === 1 ? "" : "s"
      } from backup.`,
    );
  }

  function cancelImport() {
    setPreview(null);
  }

  return (
    <section className="card p-5 flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">💾 Backup & restore</h2>
        <p className="text-sm text-slate-700">
          Save every Cub&apos;s portfolio (and the parent password) to a file.
          Restore it on this device or another to bring them back.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="btn btn-primary"
          disabled={profiles.length === 0}
        >
          💾 Download backup
        </button>
        <label className="btn btn-ghost cursor-pointer">
          📂 Restore from file
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="sr-only"
          />
        </label>
      </div>

      {error && (
        <div role="alert" className="text-sm text-rose-700">
          {error}
        </div>
      )}
      {success && !preview && (
        <div role="status" className="text-sm text-emerald-700">
          {success}
        </div>
      )}

      {preview && (
        <div
          role="alertdialog"
          aria-label="Confirm restore"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-col gap-3"
        >
          <div className="font-semibold text-amber-900">
            Replace current state with this backup?
          </div>
          <ul className="text-sm text-amber-900 list-disc pl-5">
            <li>
              Exported{" "}
              {new Date(preview.exportedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </li>
            <li>
              {preview.cubNames.length} Cub
              {preview.cubNames.length === 1 ? "" : "s"}:{" "}
              {preview.cubNames.join(", ") || "(none)"}
            </li>
            <li>
              {preview.hasPassword
                ? "Includes parent password — you'll need the OLD password from when this backup was taken."
                : "No parent password in backup — current password (if any) is removed."}
            </li>
          </ul>
          <div className="text-sm text-amber-900">
            ⚠️ This will <strong>overwrite</strong> the current Cubs and
            password. There&apos;s no undo.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={confirmImport}
              className="btn btn-danger"
            >
              Yes, replace everything
            </button>
            <button
              type="button"
              onClick={cancelImport}
              className="btn btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-700">
        The backup file is plain JSON. The parent password is hashed — but
        anyone with the file can attempt to guess it offline. Treat it like a
        sensitive document.
      </p>
    </section>
  );
}

function isObject(val: unknown): val is Record<string, unknown> {
  return val !== null && typeof val === "object";
}

function parseBackup(raw: unknown): BackupV1 {
  const normalized = normalizeBackup(raw);
  if (!isObject(normalized)) {
    throw new Error("That file isn't a Wall Street Cubs backup.");
  }
  if (normalized.app !== APP_TAG) {
    throw new Error("That file isn't a Wall Street Cubs backup.");
  }
  if (normalized.version !== BACKUP_VERSION) {
    throw new Error(
      `Backup version ${String(normalized.version)} is not supported by this app.`,
    );
  }
  const validation = validateSnapshot(normalized.snapshot);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }
  return {
    version: BACKUP_VERSION,
    app: APP_TAG,
    exportedAt:
      typeof normalized.exportedAt === "number" && Number.isFinite(normalized.exportedAt)
        ? normalized.exportedAt
        : Date.now(),
    snapshot: validation.snapshot,
  };
}
