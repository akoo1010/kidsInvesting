// Server-only family repository. Default impl is a JSON file under
// `WSC_DATA_DIR` (env) or `./data`. Single source of truth for both family
// records and active sessions. Designed to be swapped for Postgres in
// production — just re-implement FamilyRepository.
import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { ENV } from "@/lib/constants";
import type { SyncedSnapshot } from "@/lib/snapshot";

export type FamilyRecord = {
  id: string; // user-picked handle, lowercase a-z0-9_-
  passwordHash: string; // hex
  passwordSalt: string; // hex
  state: SyncedSnapshot | null; // the synced JSON blob (portfolios + parentLock)
  stateUpdatedAt: number;
  createdAt: number;
};

export type SessionRecord = {
  token: string;
  familyId: string;
  createdAt: number;
  lastUsedAt: number;
};

type DbShape = {
  families: FamilyRecord[];
  sessions: SessionRecord[];
};

const EMPTY: DbShape = { families: [], sessions: [] };

export interface FamilyRepository {
  getFamilyById(id: string): Promise<FamilyRecord | null>;
  createFamily(rec: FamilyRecord): Promise<void>;
  updateFamilyState(
    id: string,
    state: SyncedSnapshot | null,
    stateUpdatedAt: number,
  ): Promise<void>;
  createSession(rec: SessionRecord): Promise<void>;
  getSession(token: string): Promise<SessionRecord | null>;
  deleteSession(token: string): Promise<void>;
  touchSession(token: string, now: number): Promise<void>;
}

function dataDir(): string {
  return process.env[ENV.dataDir] ?? path.join(process.cwd(), "data");
}

function dataFile(): string {
  return path.join(dataDir(), "families.json");
}

let writeQueue: Promise<void> = Promise.resolve();
let cache: DbShape | null = null;

async function load(): Promise<DbShape> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(dataFile(), "utf8");
    const parsed = JSON.parse(raw) as DbShape;
    cache = {
      families: parsed.families ?? [],
      sessions: parsed.sessions ?? [],
    };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT"
    ) {
      cache = { ...EMPTY };
    } else {
      throw err;
    }
  }
  return cache!;
}

async function save(db: DbShape): Promise<void> {
  cache = db;
  // Serialize writes so concurrent requests don't race over the file. Each
  // mutation reads cache, mutates, then queues a write-through to disk.
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(dataDir(), { recursive: true });
    const tmp = dataFile() + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, dataFile());
  });
  return writeQueue;
}

class JsonFileRepository implements FamilyRepository {
  async getFamilyById(id: string): Promise<FamilyRecord | null> {
    const db = await load();
    return db.families.find((f) => f.id === id) ?? null;
  }

  async createFamily(rec: FamilyRecord): Promise<void> {
    const db = await load();
    if (db.families.some((f) => f.id === rec.id)) {
      throw new Error("family-exists");
    }
    const next: DbShape = {
      families: [...db.families, rec],
      sessions: db.sessions,
    };
    await save(next);
  }

  async updateFamilyState(
    id: string,
    state: SyncedSnapshot | null,
    stateUpdatedAt: number,
  ): Promise<void> {
    const db = await load();
    const idx = db.families.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error("family-not-found");
    const families = db.families.slice();
    families[idx] = { ...families[idx], state, stateUpdatedAt };
    await save({ families, sessions: db.sessions });
  }

  async createSession(rec: SessionRecord): Promise<void> {
    const db = await load();
    await save({
      families: db.families,
      sessions: [...db.sessions, rec],
    });
  }

  async getSession(token: string): Promise<SessionRecord | null> {
    const db = await load();
    return db.sessions.find((s) => s.token === token) ?? null;
  }

  async deleteSession(token: string): Promise<void> {
    const db = await load();
    await save({
      families: db.families,
      sessions: db.sessions.filter((s) => s.token !== token),
    });
  }

  async touchSession(token: string, now: number): Promise<void> {
    const db = await load();
    const idx = db.sessions.findIndex((s) => s.token === token);
    if (idx === -1) return;
    const sessions = db.sessions.slice();
    sessions[idx] = { ...sessions[idx], lastUsedAt: now };
    await save({ families: db.families, sessions });
  }
}

let pool: Pool | null = null;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

export class PostgresRepository implements FamilyRepository {
  async getFamilyById(id: string): Promise<FamilyRecord | null> {
    const p = getPool();
    const { rows } = await p.query(
      `SELECT id, password_hash, password_salt, state, state_updated_at, created_at
       FROM families WHERE id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    return {
      id: rows[0].id,
      passwordHash: rows[0].password_hash,
      passwordSalt: rows[0].password_salt,
      state: rows[0].state,
      stateUpdatedAt: Number(rows[0].state_updated_at),
      createdAt: Number(rows[0].created_at),
    };
  }

  async createFamily(rec: FamilyRecord): Promise<void> {
    try {
      const p = getPool();
      await p.query(
        `INSERT INTO families(id, password_hash, password_salt, state, state_updated_at, created_at)
         VALUES($1, $2, $3, $4, $5, $6)`,
        [
          rec.id,
          rec.passwordHash,
          rec.passwordSalt,
          rec.state,
          rec.stateUpdatedAt,
          rec.createdAt,
        ],
      );
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err && err.code === "23505") {
        throw new Error("family-exists");
      }
      throw err;
    }
  }

  async updateFamilyState(
    id: string,
    state: SyncedSnapshot | null,
    stateUpdatedAt: number,
  ): Promise<void> {
    const p = getPool();
    const r = await p.query(
      `UPDATE families SET state = $2, state_updated_at = $3 WHERE id = $1`,
      [id, state, stateUpdatedAt],
    );
    if (r.rowCount === 0) throw new Error("family-not-found");
  }

  async createSession(rec: SessionRecord): Promise<void> {
    const p = getPool();
    await p.query(
      `INSERT INTO sessions(token, family_id, created_at, last_used_at)
       VALUES($1, $2, $3, $4)`,
      [rec.token, rec.familyId, rec.createdAt, rec.lastUsedAt],
    );
  }

  async getSession(token: string): Promise<SessionRecord | null> {
    const p = getPool();
    const { rows } = await p.query(
      `SELECT token, family_id, created_at, last_used_at FROM sessions WHERE token = $1`,
      [token],
    );
    if (!rows[0]) return null;
    return {
      token: rows[0].token,
      familyId: rows[0].family_id,
      createdAt: Number(rows[0].created_at),
      lastUsedAt: Number(rows[0].last_used_at),
    };
  }

  async deleteSession(token: string): Promise<void> {
    const p = getPool();
    await p.query(`DELETE FROM sessions WHERE token = $1`, [token]);
  }

  async touchSession(token: string, now: number): Promise<void> {
    const p = getPool();
    await p.query(
      `UPDATE sessions SET last_used_at = $2 WHERE token = $1`,
      [token, now],
    );
  }
}

let repoInstance: FamilyRepository | null = null;

export function getRepository(): FamilyRepository {
  if (!repoInstance) {
    repoInstance = process.env.DATABASE_URL
      ? new PostgresRepository()
      : new JsonFileRepository();
  }
  return repoInstance;
}
