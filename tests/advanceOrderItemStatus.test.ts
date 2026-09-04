import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { advanceOrderItemStatus } from "@/app/(staff)/pos/actions";

const createdOrderIds: string[] = [];

async function createPendingItem() {
  const order = await prisma.order.create({ data: { type: "TAKEAWAY", status: "OPEN" } });
  createdOrderIds.push(order.id);
  const item = await prisma.orderItem.create({
    data: { orderId: order.id, name: `Race Dish ${randomUUID()}`, price: 1000, qty: 1, status: "PENDING" },
  });
  return item;
}

describe("advanceOrderItemStatus", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    createdOrderIds.length = 0;
  });

  it("sequential calls advance PENDING -> PREPARING -> SERVED, then no-op past SERVED", async () => {
    const item = await createPendingItem();

    await advanceOrderItemStatus(item.id);
    expect((await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("PREPARING");

    await advanceOrderItemStatus(item.id);
    expect((await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("SERVED");

    await advanceOrderItemStatus(item.id);
    expect((await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("SERVED");
  });

  it("two concurrent advances from PENDING never skip a step: the item ends at PREPARING, not SERVED", async () => {
    const item = await createPendingItem();

    await Promise.all([advanceOrderItemStatus(item.id), advanceOrderItemStatus(item.id)]);

    const final = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(final.status).toBe("PREPARING");
  });

  it("a stale-read caller can never regress or re-apply a transition the row has already moved past", async () => {
    // This is the test that actually distinguishes the fix from the pre-fix
    // implementation. A same-value re-application of the SAME transition
    // (e.g. two racers both computing PENDING -> PREPARING) is
    // indistinguishable at the final-status level whether or not it's
    // guarded, since both would write the identical value. The genuinely
    // observable case is a *slow* racer whose read happened long before —
    // while the row has since moved two or more steps ahead: an unguarded
    // implementation (the pre-fix `update`, which never checks the row's
    // current status) would blindly apply its stale computation and
    // *regress* the item backwards. The fixed implementation's atomic
    // conditional update must refuse this, since its WHERE clause no
    // longer matches the row's real current status.
    const item = await createPendingItem();

    // Two real, sequential advances bring the row all the way to SERVED —
    // exactly as if two other staff actions had already progressed it
    // while a third, slower caller's read was still in flight.
    await advanceOrderItemStatus(item.id); // PENDING -> PREPARING
    await advanceOrderItemStatus(item.id); // PREPARING -> SERVED
    expect((await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } })).status).toBe("SERVED");

    // Now simulate that slow third caller: its own internal read had
    // captured the item back when it was still PENDING, before either of
    // the two advances above ran. Force advanceOrderItemStatus's internal
    // findUnique to return that stale snapshot for this one call only —
    // everything else (the actual conditional update logic under test)
    // runs unmodified.
    const staleSnapshot = { ...item, status: "PENDING" };
    vi.spyOn(prisma.orderItem, "findUnique").mockImplementationOnce(
      (async () => staleSnapshot) as unknown as typeof prisma.orderItem.findUnique
    );

    await advanceOrderItemStatus(item.id);

    const final = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    // Must still be SERVED. The pre-fix implementation (a plain
    // unconditional `update`) would have blindly written "PREPARING" here
    // (computed from the stale PENDING snapshot), regressing an already-
    // served item backwards — exactly the kind of lost/corrupted state
    // transition this fix exists to prevent.
    expect(final.status).toBe("SERVED");
  });
});
