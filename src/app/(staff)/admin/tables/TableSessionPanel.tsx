"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Modal } from "@/components/Modal";
import { toast } from "@/components/Toast";
import { formatBaht } from "@/lib/money";
import {
  createIdempotencyKeyHolder,
  createSingleFlightRunner,
  deriveSessionViewState,
  mapTableSessionError,
} from "./tableSessionPanelLogic";
import type { ActiveSessionInfo } from "@/lib/tables";
import type { OpenTableSessionResult, CloseTableSessionResult } from "./actions";

function formatStartedAt(date: Date): string {
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Table Session controls for one table's card in /admin/tables. Renders
 * one of three states derived straight from `activeSession` — no local
 * copy of the session is ever kept in React state, so there is nothing
 * here that can go stale/optimistic: every render shows exactly what the
 * server last returned, and a successful or failed action always ends
 * with `router.refresh()` re-fetching that server state fresh, never an
 * assumed result.
 */
export function TableSessionPanel({
  tableId,
  tableName,
  activeSession,
  openTableSession,
  closeTableSession,
}: {
  tableId: string;
  tableName: string;
  activeSession: ActiveSessionInfo | null;
  openTableSession: (tableId: string, idempotencyKey: string) => Promise<OpenTableSessionResult>;
  closeTableSession: (sessionId: string) => Promise<CloseTableSessionResult>;
}) {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // One idempotency key per "เปิดโต๊ะ/เปิดรอบใหม่" operation, and a
  // single-flight guard so a double-click can never fire two overlapping
  // requests client-side — both survive across renders via refs, neither
  // is itself React state (they're not meant to trigger re-renders).
  const keyHolderRef = useRef(createIdempotencyKeyHolder());
  const runnerRef = useRef(createSingleFlightRunner<OpenTableSessionResult>());

  const viewState = deriveSessionViewState(activeSession);

  async function handleOpen() {
    setIsOpening(true);
    try {
      const key = keyHolderRef.current.getOrCreate();
      await runnerRef.current(() => openTableSession(tableId, key));
      // Operation complete — a future click (a new occupancy round) must
      // generate a brand new key, never reuse this one.
      keyHolderRef.current.clear();
      router.refresh();
    } catch (err) {
      toast(mapTableSessionError(err), "error");
      // Resync with server state even on failure — e.g. a customer placed
      // an order concurrently, so the card must now show "มีออเดอร์ค้าง"
      // instead of silently staying on stale "พร้อมเปิดรอบ"/"กำลังใช้งาน".
      router.refresh();
      // Deliberately not cleared: a retry of this same rejected attempt
      // should reuse the same key (see tableSessionPanelLogic.ts).
    } finally {
      setIsOpening(false);
    }
  }

  async function handleConfirmClose() {
    if (!activeSession) return;
    setIsClosing(true);
    try {
      await closeTableSession(activeSession.id);
      setCloseModalOpen(false);
      router.refresh();
    } catch (err) {
      setCloseModalOpen(false);
      toast(mapTableSessionError(err), "error");
      router.refresh();
    } finally {
      setIsClosing(false);
    }
  }

  if (viewState === "HAS_OPEN_ORDER" && activeSession) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-(--text-muted)">Session</span>
          <Badge tone="warning">มีออเดอร์ค้าง</Badge>
        </div>
        <p className="font-semibold">{formatBaht(activeSession.openOrderTotal)} บาท</p>
        <p className="text-xs text-(--text-muted-2)">
          ต้องชำระเงินหรือยกเลิกออเดอร์ก่อน จึงจะปิดหรือเปิดรอบใหม่ได้
        </p>
        <Button href="/pos" variant="ghost" size="sm" fullWidth>
          ไปที่หน้าออเดอร์ →
        </Button>
      </div>
    );
  }

  if (viewState === "ACTIVE" && activeSession) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-(--text-muted)">Session</span>
          <Badge tone="brand">กำลังใช้งาน</Badge>
        </div>
        <p className="text-xs text-(--text-muted-2)">เริ่มรอบเมื่อ {formatStartedAt(activeSession.startedAt)}</p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            disabled={isOpening}
            aria-label={`เปิดรอบใหม่สำหรับ ${tableName}`}
            onClick={handleOpen}
          >
            {isOpening ? "กำลังเปิด..." : "เปิดรอบใหม่"}
          </Button>
          <Button
            variant="warning"
            size="sm"
            className="flex-1"
            aria-label={`ปิดรอบของ ${tableName}`}
            onClick={() => setCloseModalOpen(true)}
          >
            ปิดรอบ
          </Button>
        </div>

        <Modal open={closeModalOpen} onClose={() => !isClosing && setCloseModalOpen(false)} title="ปิดรอบ" size="sm">
          <p className="text-sm text-(--text-muted)">
            ปิดรอบของ &ldquo;{tableName}&rdquo;? หลังจากปิดแล้ว การสั่งอาหารผ่านรอบนี้จะไม่ถือว่าอยู่ในรอบปัจจุบัน
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={isClosing} onClick={() => setCloseModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button variant="warning" size="sm" disabled={isClosing} onClick={handleConfirmClose}>
              {isClosing ? "กำลังปิด..." : "ปิดรอบ"}
            </Button>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-(--text-muted)">Session</span>
        <Badge tone="success">พร้อมเปิดรอบ</Badge>
      </div>
      <Button
        variant="primary"
        size="sm"
        fullWidth
        disabled={isOpening}
        aria-label={`เปิดโต๊ะ ${tableName}`}
        onClick={handleOpen}
      >
        {isOpening ? "กำลังเปิด..." : "เปิดโต๊ะ"}
      </Button>
    </div>
  );
}
