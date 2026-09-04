# POS Engineering History

This document records what has actually been implemented, audited, verified,
committed, and pushed in this repository, reconstructed from Git history and
the current source — not from conversation memory. Where history cannot be
verified from Git/code/tests, this document says so explicitly rather than
guessing.

## 1. Project baseline

- **Repository**: Next.js (App Router) + Prisma/PostgreSQL restaurant POS
  (Thai-language UI) — QR-code table ordering for customers, a staff POS
  board, admin screens (menu/stock/tables/reports).
- **Branch**: `claude/pos-webapp-free-ncrttp`
- **Last pushed commit (HEAD of `origin/claude/pos-webapp-free-ncrttp`)**:
  `26c35e7315ade84420c2f3d015b7be33d9dd4c61` — `fix: harden order item status
  concurrency`
- **Remote synchronization**: local `HEAD` matches `origin` exactly at the
  time of writing (`git status -sb` reports no ahead/behind divergence).
- **Working tree state at the time this document was written**: **not
  clean** — there are uncommitted, locally-verified changes on top of
  `26c35e7` implementing a fix labeled P1-2 in this document (see §5 and
  §12). This document distinguishes that uncommitted work from the pushed
  history throughout; it does not present it as committed or pushed.
- **Date**: 2026-09-04 (system clock at time of writing; matches the commit
  dates recorded in §3).
- **Overall project status**: The core order/payment/table-session data
  layer is stable and has extensive automated regression coverage (173
  passing tests at `26c35e7`, across 16 test files). Recent work has been a
  series of narrow, audited concurrency/UX hardening fixes to the staff POS
  screen, not new features.

## 2. Executive summary

The project began (`533e88c` onward, outside the scope of the detailed audit
work below) as a QR-ordering POS app and went through several rounds of
visual redesign and feature build-out (payment/checkout, reports, table
sessions with per-round QR tokens, stock tracking). This document's detailed
coverage starts from the commit checkpoint `97ba9ac` (`test: verify table
session lifecycle end to end`), which this session used as the confirmed
"known-good" baseline before starting a sequence of narrowly-scoped audit →
fix cycles:

1. A UX audit-and-fix pass on the customer ordering page (`c410657`).
2. A UX audit-and-fix pass on the staff POS/admin screens (`11258ce`).
3. A strict read-only concurrency/race-condition audit of the staff POS
   workflow, followed by three rounds of iterative, user-directed hardening
   of exactly two of its findings in `PosBoard.tsx`/`NewOrderClient.tsx`
   (`7b4f9a1`).
4. A second, broader production audit (Table Session/QR lifecycle,
   concurrency, data integrity) that surfaced three further findings
   (P1-1, P1-2, P2-1) plus one maintainability note (P3-1); P1-1 was fixed,
   tested, and pushed (`26c35e7`).
5. P1-2 has since been implemented and verified locally (this session) but
   is **not yet committed or pushed** — see §5 and §12.

Every fix in this history follows the same pattern: audit first (often as
an explicitly read-only pass), get scope approval, implement the smallest
change consistent with the codebase's existing conventions (row-level
locks, atomic conditional updates, idempotency keys), add or update a
regression test, then run the full verification suite before committing.

## 3. Chronological change history

| Commit | Date (UTC) | Change | Files | Verification | Remote |
|---|---|---|---|---|---|
| `97ba9ac` | (baseline; not independently dated in this audit — see note) | `test: verify table session lifecycle end to end` — used as the confirmed clean starting checkpoint for this session's work | `tests/tableSessionLifecycleEndToEnd.test.ts` (+197 lines, new file) | Evidence not available in repository for the verification run performed at the time of this commit | Pushed (present in `origin/claude/pos-webapp-free-ncrttp` history) |
| `c410657` | 2026-09-04 09:26:52 +0000 | `fix: polish customer order ux` — cart-flash fix, 44px touch targets, `prefers-reduced-motion`, category icons | `src/app/globals.css`, `src/app/order/[token]/CartFlowSheet.tsx`, `src/app/order/[token]/FoodCard.tsx`, `src/app/order/[token]/OrderClient.tsx`, `src/app/order/[token]/illustrations.tsx` | Reported in-session as passing lint/build/typecheck at commit time; not independently re-run for this document (current HEAD's suite was re-run — see §11) | Pushed |
| `11258ce` | 2026-09-04 09:41:50 +0000 | `fix: polish staff pos ux` — open-order amount + link on `/admin/tables`, "พร้อมเก็บเงิน" ready-for-payment badge on `/pos` | `src/app/(staff)/admin/tables/TableSessionPanel.tsx`, `src/app/(staff)/pos/PosBoard.tsx`, `src/lib/tables.ts` | Same as above | Pushed |
| `7b4f9a1` | 2026-09-04 11:19:56 +0000 | `fix: harden staff pos workflow ux` — per-item advance lock, poll-confirmed release, polling sequence guard, walk-in order error handling | `src/app/(staff)/pos/PosBoard.tsx`, `src/app/(staff)/pos/new/NewOrderClient.tsx` | tsc/lint/170 tests passing, reported in-session at commit time | Pushed |
| `26c35e7` | 2026-09-04 11:45:44 +0000 | `fix: harden order item status concurrency` — atomic conditional update for `advanceOrderItemStatus`, closing a confirmed lost-update race | `src/app/(staff)/pos/actions.ts`, `tests/advanceOrderItemStatus.test.ts` (new) | Re-verified for this document: 173/173 tests, tsc clean, lint clean, build clean, `git diff --check` clean | Pushed |
| *(uncommitted)* | in progress, this session | P1-2 fix — `addItemToOrder` result contract (`{ added: boolean }`) | `src/app/(staff)/pos/actions.ts`, `src/app/(staff)/pos/PosBoard.tsx`, `tests/payOrder.test.ts` (modified), `tests/addItemToOrder.test.ts` (new) | Re-verified for this document: 177/177 tests, tsc clean, lint clean, build clean, `git diff --check` clean | **Not committed, not pushed** |

Note on `97ba9ac`'s date: `git log` for this commit was not queried for an
exact timestamp beyond confirming it precedes `c410657`; treat its date as
`Evidence not available in repository` for this document rather than
inferring one.

## 4. Detailed implementation history

### `c410657` — fix: polish customer order ux

**Problem**: An audit of the customer-facing `/order/[token]` flow found:
cart totals could flash `0 รายการ / ฿0` for a frame during submission; some
tap targets were smaller than the project's own 44px standard; no
`prefers-reduced-motion` support existed anywhere in the app; category icons
were emoji rather than themed SVG icons.

**What changed** (verified directly in the commit diff):
- **Cart flash fix**: `CartFlowSheet.tsx` now takes a `snapshot` of
  `{ count, subtotal }` the instant the user confirms submission
  (`setSnapshot({ count: liveCount, subtotal: liveSubtotal })`), and the
  confirm/sending/success screens read `snapshot?.count ?? liveCount` /
  `snapshot?.subtotal ?? liveSubtotal` instead of live `entries` — because
  the parent clears the cart (`setCartEntries([])`) the moment `placeOrder`
  succeeds, which happens before this sheet's own step transitions to
  `"success"`.
- **44px touch targets**: quantity +/− buttons in `CartFlowSheet.tsx` and
  `FoodCard.tsx` changed from `w-9 h-9`/`w-8 h-8` to `w-11 h-11` (44px at the
  default Tailwind scale).
- **`prefers-reduced-motion`**: added to `src/app/globals.css` — a global
  media query collapsing all `animation-duration`, `animation-iteration-count`,
  `transition-duration` to near-zero and forcing `scroll-behavior: auto`
  when the user has this preference set.
- **Category icons**: `OrderClient.tsx`'s `categoryEmoji()` (returned raw
  emoji strings) was replaced with a `CategoryIcon` component rendering
  themed SVG icons (`RiceCategoryIcon`, `NoodleCategoryIcon`,
  `DrinkCategoryIcon`, `DessertCategoryIcon`, `SnackCategoryIcon`) newly
  added to `illustrations.tsx`.

**Still present at HEAD**: Not re-verified file-by-file for this document,
but no subsequent commit in this history touches `CartFlowSheet.tsx`,
`FoodCard.tsx`, or the reduced-motion CSS block, so there is no evidence of
regression.

**Tests**: No dedicated automated test was added for this commit (these are
visual/UX changes); verification at the time was lint/build/typecheck plus
(per this session's own account, not independently re-verifiable from Git
alone) manual/browser checks.

### `11258ce` — fix: polish staff pos ux

**Problem**: An audit of staff POS screens found two workflow-friction
issues: (1) `/admin/tables`'s "มีออเดอร์ค้าง" (open-order) card state showed
no amount and no way to navigate to the order; (2) `/pos` order cards did
not distinguish "still cooking" from "fully served, ready to collect
payment."

**What changed** (verified directly in the commit diff):
- **`openOrderTotal`**: `src/lib/tables.ts`'s `ActiveSessionInfo` type
  gained an `openOrderTotal: number` field (satang). `getTablesWithSessions()`'s
  query was extended to select each OPEN order's items
  (`{ price, qty, status }`) and compute
  `openOrder.items.filter(i => i.status !== "CANCELLED").reduce((sum, i) => sum + i.price * i.qty, 0)`,
  `0` when there is no open order.
- **`/admin/tables` open-order amount + direct navigation**:
  `TableSessionPanel.tsx`'s `HAS_OPEN_ORDER` branch now renders
  `{formatBaht(activeSession.openOrderTotal)} บาท` and a
  `<Button href="/pos" variant="ghost" size="sm" fullWidth>ไปที่หน้าออเดอร์ →</Button>`
  linking directly to the POS board.
- **"พร้อมเก็บเงิน" (ready-for-payment) badge**: `PosBoard.tsx` gained a pure
  helper `isReadyForPayment(items) => items.length > 0 && items.every(i =>
  i.status === "SERVED")`, and each order card now shows
  `<Badge tone="success">พร้อมเก็บเงิน</Badge>` when true (and not already
  flagged "ใหม่"/new).

**Still present at HEAD**: Confirmed — `isReadyForPayment` and the
`openOrderTotal` field/computation are both present, unmodified in
substance, in the current `PosBoard.tsx` and `src/lib/tables.ts` (verified
by direct read during this session).

**Tests**: No dedicated automated test was added in this commit.

### `7b4f9a1` — fix: harden staff pos workflow ux

**Problem this addressed**: A strict, read-only concurrency audit of the
staff POS board (conducted as a separate, no-file-modification pass, per
this session's own account) identified — among other findings — that
`PosBoard.tsx`'s per-item "advance kitchen status" button used a single
shared `isPending` flag from `useTransition()` for every item on the board.
This meant: (a) tapping one item's advance button disabled every other
item's button too (a UX issue, not itself fixed here), and more seriously,
(b) a user could double-tap the *same* item's advance button before the
next 4-second poll reflected its new status, and since
`advanceOrderItemStatus` computes "next status" from whatever the row's
*current* server-side status is, a rapid double-tap could silently skip a
kitchen stage (e.g. `PENDING` straight to `SERVED`).

**What changed**, arrived at over three iterative rounds within this
session (each round closing a specific gap the reviewing user identified by
reasoning about React's async semantics — see the historical commentary in
this repository's own session record for the blow-by-blow; only the
final, committed state is documented here as fact):

- **Per-item pending lock**: `pendingItemIds: Set<string>` (React state,
  drives the `disabled` attribute) plus `inFlightItemIdsRef:
  Map<string, string>` (a `useRef`, the actual synchronous re-entry guard —
  necessary because two calls to `handleAdvance` for the same item can occur
  before React commits a `pendingItemIds` state update, so a check against
  state alone would read the same stale value twice).
- **Poll-confirmed lock release**: the lock for an item is *not* released
  when the `advanceOrderItemStatus` server call resolves — the local
  `orders` state is fed only by the 4-second poll (`router.refresh()`
  updates the server tree but not this already-mounted client component's
  own `orders` state). Instead, the lock is released only once a
  subsequent poll response shows the item's status has actually changed
  from the status captured at submit time (or the item/order is gone),
  implemented inside the existing polling `useEffect`'s `setInterval`
  callback (a new pure helper, `findItemStatus(orderList, orderItemId)`,
  looks this up).
- **Polling sequence guard**: `pollSeqRef` (a `useRef<number>` counter)
  is incremented immediately before each poll's `fetch` is dispatched;
  the response is discarded (no `setOrders`, no lock confirmation) unless
  `seq === pollSeqRef.current` still holds after both `await fetch(...)`
  and `await res.json()` — preventing a slower, earlier-dispatched poll's
  response from overwriting a faster, later one's.
- **Walk-in order error handling**: `NewOrderClient.tsx`'s `handleCreate`
  previously had no `try/catch` around its `createWalkInOrder` call — any
  rejection (auth expiry, DB/network failure) would surface as an
  unhandled promise rejection with no user feedback. Wrapped in
  `try { ... } catch (err) { toast(...) }`, matching the toast-error
  convention already used elsewhere in the codebase.

**Still present at HEAD**: Confirmed by direct read of the current
`PosBoard.tsx` during this session — `pendingItemIds`, `inFlightItemIdsRef`,
`pollSeqRef`, and `findItemStatus` are all present and match this
description exactly.

**Tests**: No dedicated automated test exists for these client-side
React/polling behaviors (this project's test suite is entirely
Node-environment Prisma integration tests — no `jsdom`/`happy-dom`, no
`@testing-library/react` — so there is no infrastructure to render or drive
`PosBoard.tsx`'s effects in a test). Verification was `npx tsc --noEmit`,
`npm run lint`, and `npm test` (170/170 at the time), plus manual/browser
checks per this session's own account.

### `26c35e7` — fix: harden order item status concurrency

**Problem**: A follow-up production audit inspected `advanceOrderItemStatus`
in `src/app/(staff)/pos/actions.ts` and found it used a classic
check-then-act pattern with **no concurrency guard**, unlike every sibling
mutation in the same file (`addItemToOrder`, `payOrder`, `cancelOrder` all
use either `SELECT ... FOR UPDATE` row locks or an atomic conditional
`updateMany`). The original code:

```ts
const item = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
const next = ITEM_STATUS_ORDER[ITEM_STATUS_ORDER.indexOf(item.status) + 1];
await prisma.orderItem.update({ where: { id: orderItemId }, data: { status: next } });
```

Two concurrent calls (e.g. two staff devices tapping the same item) could
both read the same stale status, both compute the same `next`, and both
write it — losing one of the two intended transitions. This was
**empirically confirmed** before the fix, via a temporary, non-committed
test script: `Promise.all([advanceOrderItemStatus(id), advanceOrderItemStatus(id)])`
starting from `PENDING` deterministically landed at `PREPARING`, never
`SERVED`, across repeated runs.

**What changed**: replaced the plain `update` with an atomic conditional
`updateMany`, mirroring the exact pattern `cancelOrder`/`payOrder` already
use:

```ts
const result = await prisma.orderItem.updateMany({
  where: { id: orderItemId, status: item.status },
  data: { status: next },
});
if (result.count === 0) return;
```

Whichever concurrent call's `updateMany` commits first wins; the other's
`WHERE` clause no longer matches (the status has already moved) and it
safely no-ops rather than overwriting. No lock, no new state, no schema
change, no change to the state machine's transitions themselves.

**Regression tests** (`tests/advanceOrderItemStatus.test.ts`, new file, 3
tests):
1. Sequential `PENDING → PREPARING → SERVED`, then no-op past `SERVED`
   (baseline correctness).
2. Two real concurrent calls from `PENDING` land at `PREPARING` (a
   real-world smoke test via `Promise.all`).
3. **The discriminating test**: two real, sequential advances bring an item
   to `SERVED`; `prisma.orderItem.findUnique` is then mocked (via
   `vi.spyOn`, `mockImplementationOnce`) to return a stale `PENDING`
   snapshot for exactly one subsequent call to `advanceOrderItemStatus`,
   simulating a slow caller whose read predates the two real advances. The
   test asserts the item stays at `SERVED`.

**How the test distinguishes fixed vs. pre-fix behavior**: this document's
author verified — by temporarily reverting `actions.ts` to the pre-fix
`update` call via `git stash`, re-running the test, then restoring the fix
— that test 3 **fails** against the pre-fix code (`expected 'PREPARING' to
be 'SERVED'`, i.e. the stale write blindly regressed an already-served item
backwards) and **passes** against the fix. Tests 1 and 2 pass against both
versions (a same-value re-application of the same transition is
indistinguishable by final status alone, which is why test 3 exists).

**Verification recorded at commit time**: 173/173 tests (16 files), `npx
tsc --noEmit` clean, `npm run lint` clean, `npm run build` clean, `git diff
--check` clean. **Re-verified for this document** (current HEAD,
`26c35e7`): identical results reproduced independently — see §11.

### P1-2 — `addItemToOrder` result contract (uncommitted)

See §5 (Audit Round 2) for the finding and §12 for its current status. This
work is implemented and locally verified but is **not part of any commit**
at the time of writing; it is documented separately from the table in §3
for that reason, and is included here only because the current working
tree contains it.

**What changed** (present in the working tree, not HEAD): `addItemToOrder`
in `src/app/(staff)/pos/actions.ts` now returns `Promise<{ added: boolean }>`
instead of `Promise<void>`; `PosBoard.tsx`'s `AddItemPicker` checks
`result.added` and shows a toast
(`"ออเดอร์นี้ไม่สามารถเพิ่มรายการได้แล้ว อาจถูกชำระเงินหรือยกเลิกไปแล้วจากอุปกรณ์อื่น"`)
when `false`, instead of silently treating a no-op as success.
`tests/payOrder.test.ts`'s one assertion that encoded the old `undefined`
contract was updated to `resolves.toEqual({ added: false })`; a new file
`tests/addItemToOrder.test.ts` (4 tests) covers the OPEN/non-OPEN/invalid-qty/
concurrent-with-`cancelOrder` cases.

## 5. Audit history

Audits are recorded separately from implementation. An audit finding is
only "fixed" once there is a corresponding entry in §3/§4 with a commit
hash (or, for P1-2, an explicit "implemented, not yet committed" note).

### Audit Round 1

**Scope**: A strict, read-only stress-test audit of the staff POS UX and
integration boundaries, conducted with an explicit no-file-modification
rule, at checkpoint `11258ce`.

**Findings** (4 total, as reported in-session — this document did not
re-derive them independently, since the two approved ones were already
implemented and are verifiable in the `7b4f9a1` diff):
1. `createWalkInOrder` (`src/app/(staff)/pos/actions.ts`) has no
   `idempotencyKey`, unlike `placeOrder`'s `OrderItem.idempotencyKey`
   pattern — **not implemented** (explicitly out of scope; crosses the
   order-creation/business-logic boundary per this session's own rules).
2. `NewOrderClient.tsx` had no error handling around `createWalkInOrder` —
   **fixed in `7b4f9a1`** (confirmed above).
3. `/api/staff/orders/active`'s polling `fetch` uses default
   `redirect: "follow"`, so a middleware redirect to `/login` on session
   expiry silently returns 200 HTML that fails `res.json()` parsing,
   swallowed by an empty `catch {}` — **not implemented** (reported only).
4. `PosBoard.tsx`'s shared `isPending` flag allowed repeated status-advance
   submissions per item — **fixed in `7b4f9a1`** (confirmed above, and
   further hardened in `26c35e7` at the server layer).

**Status**: 2 of 4 findings fixed and pushed (`7b4f9a1`); 2 remain
unaddressed (findings 1 and 3 above) and are not tracked under the P-number
scheme used below — they were reported but no further work was requested
on them in this session.

### Audit Round 2

**Scope**: A broader production audit covering Table Session/QR lifecycle,
multi-device customer ordering, staff POS workflow, concurrency/race
conditions, and data integrity, conducted at checkpoint `11258ce` initially
and re-verified/extended at `7b4f9a1`.

**Method**: direct code tracing of every order-creation, status-change, and
payment/close-session code path (`src/app/(staff)/pos/actions.ts`,
`src/app/(staff)/admin/tables/actions.ts`, `src/app/order/[token]/actions.ts`,
`src/lib/tableSessionAccess.ts`), cross-checked against the existing test
suite, plus one empirical reproduction (a temporary, non-committed Vitest
file exercising the `advanceOrderItemStatus` race directly against the real
Postgres instance, deleted immediately after).

**Findings**:

| ID | Finding | Severity rationale | Status |
|---|---|---|---|
| P1-1 | `advanceOrderItemStatus` check-then-act race — no lock, unlike every sibling mutation | "race condition" in core order-item state machine — matches the audit's P1 definition | **Fixed and pushed** — `26c35e7` |
| P1-2 | `addItemToOrder` silently no-ops (`Promise<void>`, no signal) when the order is no longer OPEN; `AddItemPicker` treats this as success | staff believes an item was added when it was not — matches the audit's "order loss" P1 definition | **Implemented and verified locally — not committed, not pushed** (see §12) |
| P2-1 | Customer-facing `OrderClient.tsx` polling has no sequence guard (the same class of bug fixed in `PosBoard.tsx` by `7b4f9a1`, never ported here) | display-only staleness, self-corrects within one 5s poll tick, no lock/mutation depends on it | **Pending — not implemented** |
| P3-1 | Session-token resolution exists in two places (`placeOrder`'s own inline lookup vs. `resolveActiveSessionByToken`) that must be kept in sync by convention, not shared code | maintainability observation only; both are currently correct | **Pending — optional, not implemented** |

Do not read this table as "3 of 4 fixed" — only P1-1 is both committed and
pushed. P1-2 exists only in the uncommitted working tree as of this
document; treat it as pending from the perspective of the pushed
repository state.

## 6. Current concurrency protections

Traced directly from `src/app/(staff)/pos/actions.ts`,
`src/app/(staff)/admin/tables/actions.ts`, `src/app/order/[token]/actions.ts`,
and `src/lib/stock.ts` during this session.

| Mechanism | Where | Protects against |
|---|---|---|
| Table row lock (`SELECT id FROM "Table" WHERE id = $1 FOR UPDATE`, first statement in transaction) | `placeOrder` (`order/[token]/actions.ts`), `openTableSession`, `closeTableSession` (`admin/tables/actions.ts`) | Two operations affecting the same table's session/order state (e.g. a customer placing an order at the exact moment staff closes or reopens the session) fully serialize instead of racing |
| Order row lock (`SELECT id FROM "Order" WHERE id = $1 FOR UPDATE`, first statement in transaction) | `addItemToOrder`, `payOrder`, `cancelOrder` (`pos/actions.ts`) | A concurrent pay/cancel/add-item for the same order always serializes; e.g. an `addItemToOrder` that loses the race sees `status !== "OPEN"` and safely rejects |
| Atomic conditional `updateMany` (`where: { id, status: expected }`) | `payOrder` (OPEN→PAID), `cancelOrder` (status→CANCELLED), `advanceOrderItemStatus` (as of `26c35e7`) | A second, redundant/duplicate/racing call sees `count: 0` and no-ops instead of double-applying or overwriting a newer state |
| Idempotency key, DB-unique (`OrderItem.idempotencyKey`) | `placeOrder` — one key per cart line per submission (`${idempotencyKey}:${lineIndex}`) | A network retry or double-submit of the same customer order cannot insert duplicate line items |
| Idempotency key, DB-unique (`TableSession.idempotencyKey`) | `openTableSession` | A retried "open this table" request (client timeout, explicit retry) always resolves to the same session, never creates a second one |
| Atomic stock decrement (`updateMany({ where: { id, stock: { gte: qty } } })`) | `consumeStock` (`src/lib/stock.ts`), used by `placeOrder`, `addItemToOrder`, `createWalkInOrder` | Two concurrent orders can never both succeed off the same last unit of stock |
| Postgres partial unique index (`TableSession_one_active_per_table`, `WHERE status = 'ACTIVE'`) | Schema-level, backstop only (documented in `prisma/schema.prisma`) | A defense-in-depth backstop in case the Table row lock above is ever bypassed by a future bug — not the primary defense |
| Client-side per-item lock + poll-confirmed release + polling sequence guard | `PosBoard.tsx` (`7b4f9a1`) | Same-tab double-tap / stale-poll display issues on the client — a UX-layer complement to, not a substitute for, the server-side guards above |

**Not yet covered**: `addItemToOrder`'s *result* is currently ambiguous to
its caller when the guard above correctly rejects it (P1-2, pending as of
the pushed HEAD; fixed in the uncommitted working tree — see §12).

## 7. Current QR / Table Session model

Verified directly from `prisma/schema.prisma`, `src/lib/tableSessionAccess.ts`,
and `src/app/(staff)/admin/tables/actions.ts`.

- **Session creation**: `openTableSession(tableId, idempotencyKey)` creates
  a `TableSession` row (`status: "ACTIVE"`, a fresh `nanoid(12)` token)
  under the Table row lock described in §6. If an ACTIVE session already
  exists with an OPEN order under it, the call is rejected
  (`SESSION_HAS_OPEN_ORDER`) rather than silently reusing or replacing it.
- **QR/token generation**: the QR customers scan encodes
  `${baseUrl}/order/${session.token}` — the **TableSession's** token, not
  `Table.token` (which is legacy, used only by `/admin/tables/print`'s
  static per-table sheet).
- **Token resolution**: `resolveActiveSessionByToken(token)` looks up the
  `TableSession` by its unique `token` and returns access only if
  `status === "ACTIVE"`. There is no fallback to "whichever session is
  active on this table now."
- **Session isolation / old QR after close**: a closed session's token
  permanently resolves to that same (now-CLOSED) session — never to a
  newer session on the same table. This is enforced by the schema/lookup
  design itself (a `TableSession` row and its token are immutable once
  created) and is covered by tests (`tests/tableSessionOrderFlow.test.ts`,
  e.g. "old token does not resolve to the new session opened for the same
  table").
- **New session after reopen**: `openTableSession` on a table whose ACTIVE
  session has no OPEN order closes that session (`status: "CLOSED",
  endedAt: now()`) and creates a brand-new one, inside the same locked
  transaction — verified in `tests/tableSessionActions.test.ts`.
- **Multi-device ordering**: `placeOrder` looks up (or creates) the single
  OPEN order scoped to `tableSessionId`, under the Table row lock — multiple
  phones using the same session token share exactly one OPEN order
  (`tests/tableSessionOrderFlow.test.ts`, "multiple phones using the same
  session token share one OPEN order").
- **Close-session behavior**: `closeTableSession` rejects
  (`SESSION_HAS_OPEN_ORDER`) if an OPEN order still exists under the
  session; closing is idempotent for an already-CLOSED session
  (`alreadyClosed: true`, no `endedAt` re-write).
- **Order/session relationship**: `Order.tableSessionId` is set once at
  creation and never changed; a PAID/CANCELLED order under a closed session
  keeps pointing at that same session permanently.

## 8. Current Staff POS workflow

READY → open table → QR → customer order → staff POS → receive → advance →
served → payment → close → READY.

| Step | Source of truth | Server action / API | UI refresh mechanism | Concurrency protection | Known limitation |
|---|---|---|---|---|---|
| Open table | `TableSession` row | `openTableSession` (`admin/tables/actions.ts`) | `router.refresh()` after the action settles | Table row lock + idempotency key | None identified |
| QR display | `currentOrderTokenFor(table)` (derived) | n/a (server component read) | Server-rendered on each `/admin/tables` load (`dynamic = "force-dynamic"`) | n/a (read-only) | None identified |
| Customer order | `Order`/`OrderItem` rows | `placeOrder` (`order/[token]/actions.ts`) | Client polls `/api/public/tables/[token]` every 5s | Table row lock, re-verified session ACTIVE-ness post-lock, per-line idempotency key | Polling has no out-of-order-response guard (P2-1, pending) |
| Staff sees order | `Order`/`OrderItem` rows | `/api/staff/orders/active` (GET) | `PosBoard.tsx` polls every 4s | Sequence guard (`pollSeqRef`, `7b4f9a1`) prevents a stale response from overwriting a fresher one | None identified beyond what's fixed |
| Receive/add item | `OrderItem` row | `addItemToOrder` (`pos/actions.ts`) | `router.refresh()` via `onAdded` | Order row lock; atomic OPEN check inside the lock | Caller could not previously tell a silent rejection from success (P1-2 — fixed in working tree, not yet pushed) |
| Advance status | `OrderItem.status` | `advanceOrderItemStatus` (`pos/actions.ts`) | Poll-confirmed client-side release (`7b4f9a1`) plus `router.refresh()` | Atomic conditional `updateMany` (`26c35e7`) | None identified post-fix |
| Served | Derived (`isReadyForPayment`) | n/a | Recomputed each render from polled `orders` | n/a | None identified |
| Payment | `Order` row (frozen pricing snapshot) | `payOrder` (`pos/actions.ts`) | `router.push('/receipt/...')` on success | Order row lock + atomic conditional `updateMany`; total always recomputed server-side | None identified |
| Close session | `TableSession` row | `closeTableSession` (`admin/tables/actions.ts`) | `router.refresh()` | Table row lock; rejects if an OPEN order exists | None identified |
| Back to READY | Derived (`activeSession === null` or no OPEN order) | n/a | Server-rendered on next `/admin/tables` load | n/a | None identified |

## 9. Customer ordering workflow

- **QR entry**: scanning the QR opens `/order/[token]`, where `token` is a
  `TableSession.token` (never `Table.token`).
- **Token/session validation**: `OrderPage` (`order/[token]/page.tsx`) calls
  `resolveActiveSessionByToken(token)`; a `null` result renders `not-found.tsx`
  — an unknown token, a closed session's old token, and "this table has a
  different ACTIVE session now" are all indistinguishable to the customer
  by design.
- **Cart**: held entirely in client React state (`OrderClient.tsx`,
  `cartEntries`), never persisted server-side until submission.
- **Order submission**: `handleSubmitOrder` calls `placeOrder(token, lines,
  idempotencyKey)`; the idempotency key is created once per "ส่งออเดอร์"
  attempt (`CartFlowSheet.tsx`, `idempotencyKeyRef`) and reused across
  retries of that same attempt.
- **Stock/unavailable behavior**: `placeOrder` returns
  `{ unavailable: string[], orderId: string | null }`; unavailable items are
  skipped (not silently dropped without feedback) and named back to the
  customer (`CartFlowSheet.tsx` shows them and returns to the cart step
  rather than proceeding to "success").
- **Order status polling**: `OrderClient.tsx` polls
  `/api/public/tables/[token]` every 5 seconds, plus an immediate
  `refreshOrderNow()` right after a successful submit.
- **Known polling limitation (P2-1, pending)**: neither poll path has a
  sequence guard — an earlier-dispatched, slower response can in principle
  overwrite a fresher one's display. This affects only the read-only order
  status shown to the customer (no lock or mutation depends on it) and
  self-corrects on the next 5-second tick. Not yet fixed; see §12.

## 10. Payment workflow

Verified directly from `src/app/(staff)/pos/actions.ts` (`payOrder`) and
`src/app/(staff)/pos/CheckoutModal.tsx`/`checkoutLogic.ts`.

- **Server-side total calculation**: `payOrder` recomputes `subtotalAmount`
  from the order's own live (non-CANCELLED) `OrderItem` rows in the
  database — a client-supplied total is never trusted; `computeOrderPricing`
  (`src/lib/pricing.ts`) is the single source of truth for the
  discount/service-charge/tax formula. Verified by
  `tests/payOrder.test.ts`, "rejects a client-supplied grand total: only the
  server-recomputed pricing is ever persisted."
- **Payment idempotency**: if `order.status === "PAID"` already, `payOrder`
  is a pure no-op — it reads but never rewrites `paidAt`/payment fields a
  second time, even if a retry sends different options. Verified by
  "retry after success: paidAt and every payment field are frozen, even if
  the retry sends different options."
- **Order locking**: `payOrder` takes the same Order row lock
  (`SELECT ... FOR UPDATE`) used by `cancelOrder`/`addItemToOrder`, so a
  concurrent pay/cancel/add-item for the same order fully serializes. An
  atomic conditional `updateMany` (`where: { id, status: "OPEN" }`) is a
  second line of defense on top of the lock.
- **Already-paid behavior**: confirmed by
  `tests/payOrder.test.ts`, "paying twice concurrently (double-submit)
  results in exactly one recorded payment" — neither concurrent call
  throws; the loser observes `status === "PAID"` and no-ops.
- **Relationship to TableSession closing**: `closeTableSession` refuses to
  close a session with an OPEN order (`SESSION_HAS_OPEN_ORDER`); an order
  must be PAID or CANCELLED before its session can close. Payment itself
  does not touch `TableSession` at all — `Order.tableSessionId` is set once
  at creation and untouched by `payOrder`.

No payment logic was changed while producing this document.

## 11. Testing and verification history

**Re-run for this document, at the current working tree** (HEAD `26c35e7`
plus the uncommitted P1-2 changes described in §5/§12):

| Check | Result |
|---|---|
| `npm test` | **177/177 tests passing, 17/17 files** |
| `npx tsc --noEmit` | Clean (exit 0) |
| `npm run lint` | Clean (exit 0) |
| `npm run build` | Successful production build, all 13 routes compiled |
| `git diff --check` | Clean (no whitespace/conflict markers) |

**At pushed HEAD alone** (`26c35e7`, verified by temporarily stashing the
uncommitted P1-2 changes, re-running, then restoring them): **173/173
tests passing, 16/16 files**. This matches the count reported in this
session's own record at the time `26c35e7` was committed.

**Test files present** (17 at the time of writing; 16 committed at
`26c35e7`, `tests/addItemToOrder.test.ts` uncommitted):
`addItemToOrder.test.ts`\*, `advanceOrderItemStatus.test.ts`,
`cancelOrder.test.ts`, `cancelOrderVsAddItem.test.ts`, `checkoutLogic.test.ts`,
`orderTotals.test.ts`, `payOrder.test.ts`, `placeOrder.test.ts`,
`pricing.test.ts`, `printQrTokenWiring.test.ts`, `receiptItemSnapshot.test.ts`,
`reportsRevenue.test.ts`, `tableSession.test.ts`, `tableSessionActions.test.ts`,
`tableSessionLifecycleEndToEnd.test.ts`, `tableSessionOrderFlow.test.ts`,
`tableSessionPanelLogic.test.ts` (\* not yet committed).

**Test infrastructure note**: this suite runs entirely in Vitest's `node`
environment (see `vitest.config.ts` — no `jsdom`/`happy-dom`, no
`@testing-library/react`). Every test is a direct Prisma/DB integration
test exercising server actions against a real PostgreSQL instance; there is
no infrastructure to render or drive React client components
(`PosBoard.tsx`, `OrderClient.tsx`) in a test. This is why the `7b4f9a1`
client-side hardening has no dedicated automated test.

No test file was modified while producing this document beyond what was
already true of the working tree before this documentation task began
(`tests/payOrder.test.ts` and `tests/addItemToOrder.test.ts` were already
part of the uncommitted P1-2 work, not touched by this task).

## 12. Current known issues

| Priority | Issue | Location | Status | Recommended next step |
|---|---|---|---|---|
| P1-2 | `addItemToOrder` silent no-op gave the caller no way to distinguish "added" from "rejected, order no longer OPEN" | `src/app/(staff)/pos/actions.ts`, `src/app/(staff)/pos/PosBoard.tsx` | **Implemented and verified locally (177/177 tests, tsc/lint/build clean) — uncommitted, not pushed** | Review the uncommitted diff; commit and push if approved |
| P2-1 | Customer-facing `OrderClient.tsx` polling has no sequence guard against out-of-order responses (display-only staleness) | `src/app/order/[token]/OrderClient.tsx` | **Pending — not implemented** | Port the same `pollSeqRef` pattern already proven in `PosBoard.tsx` (`7b4f9a1`) |
| P3-1 | Session-token resolution logic exists in two places (`placeOrder`'s inline pre-lock read vs. `resolveActiveSessionByToken`) that must be kept in sync by convention | `src/app/order/[token]/actions.ts`, `src/lib/tableSessionAccess.ts` | **Pending — optional, maintainability only, not a defect today** | Have `placeOrder`'s pre-lock read call the shared helper; no urgency |

This task did not implement any of the above — it only documents their
current, verified status.

## 13. Protected architecture / do-not-change list

The following have intentionally remained unchanged throughout every fix
cycle documented above, and should continue to be treated as boundaries
that require explicit approval to cross:

- `prisma/schema.prisma` and all migrations under `prisma/migrations/`
- The `Order`/`OrderItem` status state machines (`OPEN/PAID/CANCELLED`,
  `PENDING/PREPARING/SERVED/CANCELLED`) — their *transitions* have never
  been changed; only the concurrency-safety of applying them has
  (`26c35e7`)
- `TableSession` lifecycle rules (`openTableSession`/`closeTableSession`'s
  exact preconditions and idempotency contract)
- Payment business logic (`payOrder`'s pricing/validation formula,
  `src/lib/pricing.ts`)
- The idempotency-key architecture (`OrderItem.idempotencyKey`,
  `TableSession.idempotencyKey`)
- The row-lock-based concurrency architecture described in §6
- Stock logic (`src/lib/stock.ts`'s `consumeStock`/`restoreStock`)
- API contracts not directly targeted by an approved fix (e.g. `payOrder`'s
  signature was never touched; `addItemToOrder`'s was touched only under
  P1-2, with explicit approval, and only its return type)

Future fixes should prefer the smallest change that stays within these
boundaries. Any change that appears to require crossing one of them should
be reported and approved before implementation, not made unilaterally —
this is the pattern every fix in §4 already followed.

## 14. Recommended next work

Strictly evidence-based, in priority order:

1. **P1-2** — already implemented and verified locally; the only remaining
   step is review and, if approved, commit + push. This is listed first
   because it is closest to done, not because it is more severe than
   already-fixed P1-1.
2. **P2-1** — a mechanical port of an already-proven pattern
   (`pollSeqRef`) from `PosBoard.tsx` into `OrderClient.tsx`; low risk,
   display-only impact.
3. **P3-1** — optional; no defect exists today, purely a future
   maintainability improvement.

Nothing else is currently identified as pending from the audits recorded in
this document. Audit Round 1's findings 1 and 3 (§5) remain unaddressed and
unscoped — they were reported but no fix was ever requested or approved for
them in this session; a future session should treat them as open questions
to be re-scoped, not silently-abandoned work.

## 15. Verification checklist for future changes

### Before change
- [ ] `git status --short` / `git status -sb` — confirm the actual baseline
      (branch, HEAD, clean or not) before touching anything
- [ ] Identify the exact commit/checkpoint being built on
- [ ] Audit first — trace the actual code path, don't assume a prior
      report is still accurate; re-read the current source
- [ ] Define scope explicitly — which files are approved to change, which
      architectural boundaries (§13) must not be crossed

### During change
- [ ] Implement the smallest safe fix consistent with existing conventions
      (row locks, atomic conditional updates, idempotency keys, result
      objects over silent no-ops — see §6 and precedents in §4)
- [ ] No unrelated refactor, no dependency changes, no schema/migration
      changes unless explicitly approved
- [ ] Preserve business logic/state machine transitions exactly
- [ ] Add or update a regression test where the project's test
      infrastructure supports it (Node-environment Prisma integration
      tests only — see §11's infrastructure note); if it doesn't, say so
      rather than skipping silently

### Before commit
- [ ] `git diff --check`
- [ ] `npm test` (record the exact pass count)
- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Inspect the final diff line by line
- [ ] Confirm the exact file list matches what was approved — nothing
      unrelated staged

### Before push
- [ ] Explicit reviewer/user approval of the exact commit
- [ ] Commit message matches what was approved, with required attribution
      footer
- [ ] `git log -1 --oneline` / `git rev-parse HEAD` to confirm the commit
      that was actually made
- [ ] `git status --short` confirms a clean tree post-commit
- [ ] Push only the approved commit — never bundle in unrelated work
- [ ] `git status -sb` post-push confirms remote sync (no ahead/behind)

## 16. Git checkpoint map

```
97ba9ac  test: verify table session lifecycle end to end
   │      (confirmed clean baseline for this session's audit/fix cycles)
   ▼
c410657  fix: polish customer order ux
   │      (cart flash, 44px targets, prefers-reduced-motion, category icons)
   ▼
11258ce  fix: polish staff pos ux
   │      (open-order amount + link, "พร้อมเก็บเงิน" ready-for-payment badge)
   ▼
7b4f9a1  fix: harden staff pos workflow ux
   │      (per-item advance lock, poll-confirmed release, sequence guard,
   │       walk-in order error handling)
   ▼
26c35e7  fix: harden order item status concurrency          ← current pushed HEAD
   │      (atomic conditional update closes a proven lost-update race)
   ▼
(uncommitted)  P1-2 — addItemToOrder result contract
                (implemented, 177/177 tests passing, awaiting commit/push approval)
```

## 17. Evidence policy

- Git history is authoritative for what has been **committed**.
- The current source tree is authoritative for what is **currently
  behaving** a given way — a commit message is a claim, not proof; this
  document cross-checks every claim against the actual diff or current
  file content.
- Automated tests are evidence only for the specific behavior they assert;
  absence of a test for something (e.g. `PosBoard.tsx`'s client-side
  hardening) does not mean it is unverified, but it does mean the
  verification was manual/browser-based and should be re-stated as such,
  not upgraded to "tested."
- Audit findings must distinguish an observed, reproduced defect (e.g.
  P1-1's empirically-confirmed lost update) from a theoretical concern —
  this document labels each accordingly in §5.
- A fix is never described as complete without both a code change and,
  where the test infrastructure supports it, a regression test that can be
  shown to fail against the pre-fix code.
- Pending issues (P1-2 as of the pushed HEAD, P2-1, P3-1) remain explicitly
  marked pending in every section of this document that mentions them —
  none are described as fixed, committed, or pushed unless they actually
  are.
