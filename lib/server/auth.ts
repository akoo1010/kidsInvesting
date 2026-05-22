// Server-only auth primitives. scrypt password hashing, random session
// tokens, handle/password validation. Constants and validation rules live
// in `lib/constants.ts` so they can't drift between client and server.
import {
  scrypt as _scrypt,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { SYNC } from "@/lib/constants";

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 64;

// A precomputed dummy hash used during login when the handle doesn't exist.
// Running scrypt against this keeps the total response time roughly equal
// to the success path so an attacker can't enumerate handles by timing.
const DUMMY_SALT = Buffer.from(
  "00000000000000000000000000000000",
  "hex",
);
let dummyHashPromise: Promise<Buffer> | null = null;
function dummyHash(): Promise<Buffer> {
  if (!dummyHashPromise) {
    dummyHashPromise = scrypt(
      "never-matches-any-real-password",
      DUMMY_SALT,
      KEY_LEN,
    );
  }
  return dummyHashPromise;
}

export async function hashPassword(
  password: string,
): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LEN);
  return { hash: derived.toString("hex"), salt: salt.toString("hex") };
}

async function verifyPassword(
  password: string,
  hashHex: string,
  saltHex: string,
): Promise<boolean> {
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scrypt(
      password,
      Buffer.from(saltHex, "hex"),
      KEY_LEN,
    );
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  } catch {
    return false;
  }
}

// Always perform a scrypt computation regardless of whether the user
// exists, so an attacker can't distinguish "no such handle" from "bad
// password" via timing.
export async function constantTimeVerify(
  password: string,
  record: { passwordHash: string; passwordSalt: string } | null,
): Promise<boolean> {
  if (!record) {
    await dummyHash(); // burn scrypt time
    return false;
  }
  return verifyPassword(password, record.passwordHash, record.passwordSalt);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function normalizeHandle(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (!SYNC.handleRegex.test(trimmed)) return null;
  return trimmed;
}

export function isValidPassword(pw: unknown): pw is string {
  return (
    typeof pw === "string" &&
    pw.length >= SYNC.minPasswordLen &&
    pw.length <= SYNC.maxPasswordLen
  );
}
