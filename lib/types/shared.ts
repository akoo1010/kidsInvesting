export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; reason: string };
