import { describe, expect, it, vi } from "vitest";
import {
  createIdempotencyKeyHolder,
  createSingleFlightRunner,
  deriveSessionViewState,
  mapTableSessionError,
} from "@/app/(staff)/admin/tables/tableSessionPanelLogic";

describe("deriveSessionViewState", () => {
  it("1. no active session -> READY (shows เปิดโต๊ะ)", () => {
    expect(deriveSessionViewState(null)).toBe("READY");
  });

  it("2. active session, no open order -> ACTIVE (shows open-new/close actions)", () => {
    expect(deriveSessionViewState({ hasOpenOrder: false })).toBe("ACTIVE");
  });

  it("3. active session with an open order -> HAS_OPEN_ORDER (forbidden actions disabled)", () => {
    expect(deriveSessionViewState({ hasOpenOrder: true })).toBe("HAS_OPEN_ORDER");
  });
});

describe("createIdempotencyKeyHolder", () => {
  it("4. generates exactly one key per operation (repeated getOrCreate calls before clear() return the same key)", () => {
    let calls = 0;
    const holder = createIdempotencyKeyHolder(() => `key-${++calls}`);

    const first = holder.getOrCreate();
    const second = holder.getOrCreate();
    const third = holder.getOrCreate();

    expect(first).toBe("key-1");
    expect(second).toBe("key-1");
    expect(third).toBe("key-1");
    expect(calls).toBe(1); // the generator itself was only invoked once
  });

  it("5. a retry (another getOrCreate before clear) reuses the same key", () => {
    const holder = createIdempotencyKeyHolder(() => crypto.randomUUID());
    const original = holder.getOrCreate();

    // Simulates a network-timeout retry of the same operation.
    const retry = holder.getOrCreate();

    expect(retry).toBe(original);
    expect(holder.current()).toBe(original);
  });

  it("after clear(), the next operation generates a brand new key", () => {
    let calls = 0;
    const holder = createIdempotencyKeyHolder(() => `key-${++calls}`);

    const first = holder.getOrCreate();
    holder.clear();
    expect(holder.current()).toBeNull();

    const second = holder.getOrCreate();
    expect(second).not.toBe(first);
    expect(second).toBe("key-2");
  });

  it("defaults to crypto.randomUUID() when no generator is supplied", () => {
    const holder = createIdempotencyKeyHolder();
    const key = holder.getOrCreate();
    // A real UUID v4 has this exact shape.
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe("createSingleFlightRunner", () => {
  it("10. a second call made before the first settles does not invoke fn again — prevents duplicate client requests from a double-click", async () => {
    let invocationCount = 0;
    const run = createSingleFlightRunner<string>();

    let resolveFirst!: (value: string) => void;
    const fn = vi.fn(() => {
      invocationCount++;
      return new Promise<string>((resolve) => {
        resolveFirst = resolve;
      });
    });

    const first = run(() => fn());
    const second = run(() => fn()); // simulates a double-click while the first request is still in flight

    expect(invocationCount).toBe(1); // fn was only actually called once
    resolveFirst("done");

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toBe("done");
    expect(secondResult).toBe("done"); // both callers get the same result
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("allows a new call once the previous one has settled", async () => {
    let invocationCount = 0;
    const run = createSingleFlightRunner<number>();

    const first = await run(async () => {
      invocationCount++;
      return invocationCount;
    });
    const second = await run(async () => {
      invocationCount++;
      return invocationCount;
    });

    expect(first).toBe(1);
    expect(second).toBe(2); // a genuinely new call after the first resolved
    expect(invocationCount).toBe(2);
  });

  it("also single-flights a rejection: a second call while the first is pending shares the same rejection, then a later call can succeed", async () => {
    const run = createSingleFlightRunner<string>();
    let attempt = 0;

    let rejectFirst!: (err: Error) => void;
    const first = run(
      () =>
        new Promise<string>((_resolve, reject) => {
          attempt++;
          rejectFirst = reject;
        })
    );
    const second = run(() => Promise.resolve("should not run")); // fn ignored - still in flight

    rejectFirst(new Error("boom"));
    await expect(first).rejects.toThrow("boom");
    await expect(second).rejects.toThrow("boom");
    expect(attempt).toBe(1);

    // Now that the in-flight call has settled, a new call runs for real.
    const third = await run(async () => "ok");
    expect(third).toBe("ok");
  });
});

describe("mapTableSessionError", () => {
  it("maps the SESSION_HAS_OPEN_ORDER message to the required friendly copy", () => {
    expect(mapTableSessionError(new Error("โต๊ะนี้ยังมีออเดอร์ค้างอยู่"))).toBe(
      "โต๊ะนี้มีออเดอร์ค้างอยู่ ไม่สามารถเปิดหรือปิดรอบได้"
    );
  });

  it("maps TABLE_NOT_FOUND to friendly copy", () => {
    expect(mapTableSessionError(new Error("ไม่พบโต๊ะนี้"))).toBe("ไม่พบโต๊ะนี้ อาจถูกลบไปแล้ว กรุณารีเฟรชหน้านี้");
  });

  it("maps SESSION_NOT_FOUND to friendly copy", () => {
    expect(mapTableSessionError(new Error("ไม่พบ session นี้"))).toBe(
      "ไม่พบรอบนี้ อาจถูกปิดไปแล้ว กรุณารีเฟรชหน้านี้"
    );
  });

  it("maps TABLE_HAS_LEGACY_OPEN_ORDER to its own friendly copy, never the generic fallback", () => {
    const message = "โต๊ะนี้มีออเดอร์ค้างจากรอบก่อน กรุณาชำระเงินหรือยกเลิกออเดอร์ก่อนเปิดรอบใหม่";
    expect(mapTableSessionError(new Error(message))).toBe(message);
  });

  it("falls back to a generic retry message for an unrecognized Error", () => {
    expect(mapTableSessionError(new Error("idempotencyKey ไม่ถูกต้อง"))).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
  });

  it("falls back to a generic retry message for a non-Error/network failure, never swallowing it", () => {
    expect(mapTableSessionError("some network failure")).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    expect(mapTableSessionError(undefined)).toBe("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
  });
});
