// Pure, DOM/React-free helpers for TableSessionPanel.tsx — independently
// unit-testable without a rendering library, matching the pattern already
// established in src/app/(staff)/pos/checkoutLogic.ts.

export type SessionViewState = "READY" | "ACTIVE" | "HAS_OPEN_ORDER";

/** Derives which of the three UI states a table's session data represents. */
export function deriveSessionViewState(activeSession: { hasOpenOrder: boolean } | null): SessionViewState {
  if (!activeSession) return "READY";
  return activeSession.hasOpenOrder ? "HAS_OPEN_ORDER" : "ACTIVE";
}

/**
 * Holds one idempotency key per logical "open this table" operation: the
 * same key survives repeated retries of that operation (network timeout,
 * an explicit retry), and clear() must be called once the operation truly
 * succeeds so the next click starts a fresh one — a rejected attempt
 * deliberately does NOT clear the key, since retrying the same rejected
 * request with the same key is still correct and safe (it either resolves
 * to whatever that key already produced, or re-evaluates the same
 * preconditions fresh if nothing was ever created under it).
 *
 * No React dependency — a component wraps a single instance of this in a
 * ref, so it survives across renders without itself being render state.
 */
export function createIdempotencyKeyHolder(generate: () => string = () => crypto.randomUUID()) {
  let key: string | null = null;
  return {
    getOrCreate(): string {
      key ??= generate();
      return key;
    },
    clear(): void {
      key = null;
    },
    current(): string | null {
      return key;
    },
  };
}

/**
 * Ensures only one call to `fn` is ever in flight at a time: a second call
 * made while the first hasn't settled returns the exact same promise
 * instead of invoking `fn` again. This is a client-side courtesy on top of
 * the UI's disabled-button state, never a substitute for the server's own
 * guarantees — the Table row lock and the persisted idempotency key are
 * what actually make concurrent/duplicate requests safe at the DB level.
 */
export function createSingleFlightRunner<T>() {
  let inFlight: Promise<T> | null = null;
  return function run(fn: () => Promise<T>): Promise<T> {
    if (inFlight) return inFlight;
    const promise = fn().finally(() => {
      if (inFlight === promise) inFlight = null;
    });
    inFlight = promise;
    return promise;
  };
}

/**
 * Maps a thrown openTableSession/closeTableSession error to staff-facing
 * Thai copy. Matches on the exact message text these actions throw, not on
 * TableSessionError's `.code` — a custom Error subclass's extra properties
 * are not guaranteed to survive serialization across the Next.js Server
 * Action boundary, only `.message` reliably does (the same reasoning
 * already applied to payOrder's errors in
 * src/app/(staff)/pos/checkoutLogic.ts's mapPayOrderError, verified working
 * in that phase's manual browser testing). Anything unrecognized (including
 * a non-Error/network failure) falls back to a generic retry message — this
 * function always returns a string, so an error is never swallowed silently.
 */
export function mapTableSessionError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (message === "โต๊ะนี้ยังมีออเดอร์ค้างอยู่") {
    return "โต๊ะนี้มีออเดอร์ค้างอยู่ ไม่สามารถเปิดหรือปิดรอบได้";
  }
  if (message === "ไม่พบโต๊ะนี้") {
    return "ไม่พบโต๊ะนี้ อาจถูกลบไปแล้ว กรุณารีเฟรชหน้านี้";
  }
  if (message === "ไม่พบ session นี้") {
    return "ไม่พบรอบนี้ อาจถูกปิดไปแล้ว กรุณารีเฟรชหน้านี้";
  }
  if (message === "โต๊ะนี้มีออเดอร์ค้างจากรอบก่อน กรุณาชำระเงินหรือยกเลิกออเดอร์ก่อนเปิดรอบใหม่") {
    // Already staff-friendly and actionable as written by the server —
    // passed through as-is rather than collapsed into the generic fallback.
    return message;
  }
  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}
