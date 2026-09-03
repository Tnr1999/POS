---
name: บ้านอร่อย POS
description: POS + สั่งอาหารผ่าน QR code สำหรับร้านอาหารขนาดเล็ก
colors:
  brand: "#68773d"
  brand-hover: "#556132"
  brand-soft: "#879653"
  accent: "#654a2e"
  accent-hover: "#523c25"
  cta: "#c84f12"
  cta-hover: "#a4400e"
  gold: "#d9a43a"
  background: "#f8f3e8"
  surface: "#fffdf7"
  surface-muted: "#f1e6d2"
  surface-border: "#e4d8bf"
  foreground: "#252525"
  text-muted: "#6b6255"
  text-muted-2: "#756a5b"
  text-subtle: "#4a4038"
  text-success: "#596e37"
  text-warning: "#835f20"
  text-danger: "#b44234"
  chip-bg: "#f8e9e2"
  chip-foreground: "#963b0d"
typography:
  page-title:
    fontFamily: "Anuphan, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 2rem)"
    fontWeight: 700
  section-title:
    fontFamily: "Anuphan, sans-serif"
    fontSize: "clamp(1.125rem, 2.5vw, 1.375rem)"
    fontWeight: 600
  body:
    fontFamily: "Anuphan, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  metadata:
    fontFamily: "Anuphan, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
  mono:
    fontFamily: "Geist Mono, monospace"
    fontSize: "0.875rem"
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-cta:
    backgroundColor: "{colors.cta}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-accent:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.chip-bg}"
    textColor: "{colors.chip-foreground}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
---

# Design System: บ้านอร่อย POS

## 1. Overview

**Creative North Star: "The Restaurant Notebook"**

A warm olive-and-terracotta palette on cream paper, styled after the handwritten order pad and menu board of a restaurant that's confident in what it serves. Staff screens (`/pos`, `/admin/*`, `/reports`) stay dense and fast to scan — a server mid-shift needs to tap and move on, not admire the UI. The customer-facing order page (`/order/[token]`) is the one screen a paying diner actually looks at, so it gets a little more warmth: item photos, live stock badges, a floating cart.

This system explicitly rejects: the generic flat-gray SaaS dashboard the app shipped with originally; the cold blue/navy fintech look (wrong emotional register for a restaurant); strong purple/violet; and excessive pure white — every surface here is a warm cream/paper tone, never `#fff`/`#000` literal (except the receipt and QR print sheet, which are physical paper and stay literal black-on-white on purpose).

**Key Characteristics:**
- **Two accents, not one.** Olive (`--brand`) is the default primary for ordinary staff actions (บันทึก, เพิ่ม, เข้าสู่ระบบ). Terracotta (`--cta`) is reserved for the one or two highest-stakes actions per screen — "สร้างออเดอร์" and "ชำระเงิน / พิมพ์บิล". This replaced an earlier single-accent system; see "The Two-Accent Rule" below.
- Restaurant identity ("บ้านอร่อย" + a small hand-drawn dish-mark SVG) anchors every staff screen's header and the login page — never copied from any external reference, entirely original.
- Flat, tonal depth (soft shadows only), not glassy or skeuomorphic.
- Print artifacts (receipt, QR sheet) are always literal black-on-white, independent of the on-screen theme.
- **No dark mode, on purpose.** `colorScheme: "light"` is hard-set in the root layout; the app always renders the light/cream palette regardless of the OS/browser theme.

## 2. Colors

Warm olive + terracotta + gold on cream paper. One palette only — no dark-mode counterpart.

### Primary — olive
- **`--brand` (`#68773d`)**: the default primary-action fill (darker than the brief's raw swatch so white text on it clears 4.5:1). Used for "บันทึก", "เพิ่ม", "เข้าสู่ระบบ", the active nav pill, and every ordinary staff-screen CTA.
- **`--brand-hover` (`#556132`)**: hover/active state for `--brand`.
- **`--brand-soft` (`#879653`)**: the brief's original lighter olive swatch — used only for icon fills, decorative accents, and unselected-tab backgrounds, never paired with white text on top of it.

### Secondary — warm brown
- **`--accent` (`#654a2e`)** / **`--accent-hover` (`#523c25`)**: one step down from whichever accent is primary on a given screen — "พิมพ์", "เพิ่มโต๊ะ", "เพิ่มหมวดหมู่".

### CTA — terracotta (the highest-stakes action only)
- **`--cta` (`#c84f12`)** / **`--cta-hover` (`#a4400e`)**: reserved for the one or two most consequential actions per screen — placing an order, taking payment. Also the accent bar in front of every `.page-title`. Never used for an ordinary button — see "The Two-Accent Rule".

### Decorative
- **`--gold` (`#d9a43a`)**: decorative accent only (highlight chips), always paired with dark text, never white-on-gold.

### Neutral / paper
- **`--surface` (`#fffdf7`)**: card, header, and modal backgrounds — near-white paper, not pure white.
- **`--background` (`#f8f3e8`)**: page background — warm cream.
- **`--surface-muted` (`#f1e6d2`)**: qty steppers, hover states, soft fills.
- **`--surface-border` (`#e4d8bf`)**: borders on top of `--surface`.
- **`--foreground` (`#252525`)**: primary text.
- **`--text-muted` (`#6b6255`)** / **`--text-muted-2` (`#756a5b`)**: secondary/tertiary text — warm gray, never cool gray.
- **`--text-subtle` (`#4a4038`)**: slightly dimmed body text.

### Semantic
Darkened from the brief's raw swatches so plain-text usage still clears 4.5:1 against this palette:
- **`--text-success` (`#596e37`)**: served, paid, menu item turned back on, stock at a healthy level.
- **`--text-warning` (`#835f20`)**: low stock, "ปิดขายชั่วคราว", QR-regenerate warning tone.
- **`--text-danger` (`#b44234`)**: delete/cancel actions, out-of-stock, confirm-dialog "danger" tone.

Never plain Tailwind `green-600`/`amber-600`/`red-600` for text on this palette — checked and several failed 4.5:1; use the tokens above instead. Solid button/badge backgrounds still use plain Tailwind stops for `danger`/`warning` (white text on them is checked separately in `Button.tsx`).

### Named Rules
**The Two-Accent Rule.** `--brand` (olive) is the default primary. `--cta` (terracotta) marks only the one or two highest-stakes actions per screen (place order, pay). If a screen has two terracotta buttons competing for attention, one of them is wrong — demote it to `--brand` or `--accent`.

**The Paper Stays Paper Rule.** The receipt (`/receipt/[orderId]`) and the QR print sheet (`/admin/tables/print`) render literal black-on-white, always — never `--surface`/`--foreground`. They are physical objects, not app screens.

**No Strong Blue/Purple, No Excessive White.** Never introduce a blue/purple accent (wrong register for a restaurant) or a literal `bg-white`/pure-white surface outside the two print exceptions above — every surface is warm cream/paper.

## 3. Typography

**Body/UI Font:** Anuphan (Thai + Latin, `next/font/google`), weights 400/500/600/700 — used for every staff screen, every button, every form label. Anuphan was chosen because it ships a real Thai subset; the app's previous body font (Geist Sans) had none, so every Thai string was silently falling back through the browser default the whole time this app existed.

**Mono Font:** Geist Mono — the printed receipt only, so it reads like it came out of a receipt printer.

### Hierarchy
- **Page title** (`.page-title`, 700, `clamp(1.5rem, 4vw, 2rem)`): one per staff page ("จัดการเมนู", "ออเดอร์ที่เปิดอยู่"), preceded by a small terracotta accent bar.
- **Section title** (`.section-title`, 600, `clamp(1.125rem, 2.5vw, 1.375rem)`): card/section headings within a page ("สต็อกปัจจุบัน", "เมนูขายดี").
- **Card title** (500-600, `1rem`–`1.125rem`): menu item names, table names.
- **Body** (400, `0.9375rem`, 1.5): form labels, list rows, everything else.
- **Metadata** (500, `0.8125rem`): timestamps, helper text, badge labels.

### Named Rules
**Thai-First.** Every font loaded via `next/font/google` in this app must declare a `thai` subset — a font without one is not a candidate, no matter how it looks in a Latin-only preview.

## 4. Elevation

Flat by default, with one soft ambient shadow reserved for surfaces that sit "above" the page — cards, the sticky header, modals/drawers, toasts. No layered shadow scale, no glass blur.

### Shadow Vocabulary
- **card** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 1px 3px rgb(0 0 0 / 0.1)`): every `.card`, the confirm dialog, the modal/drawer, the toast stack.
- **floating** (`box-shadow: 0 10px 30px rgb(0 0 0 / 0.2)`): the fixed mobile submit bar on `/pos/new` — reserved for the one element per screen the user's thumb is about to hit.

### Named Rules
**The Flat-at-Rest Rule.** Nothing has a shadow just for decoration. A shadow means "this is a surface floating above the page" or "this needs your attention right now, tap it." If neither is true, no shadow.

## 5. Components

Shared components live in `src/components/` — pages compose these rather than repeating raw `className` strings. Never duplicate a button/input/card style inline; add a variant to the shared component instead.

- **`Button`** — variants `primary` (olive), `cta` (terracotta, highest-stakes only), `accent` (warm brown), `ghost`, `danger`, `warning`; sizes `md`/`sm`; renders a real `<Link>` when given `href`, otherwise a real `<button>` — never a `<div onClick>`.
- **`Input` / `Select` / `SearchInput`** — consistent border/radius/focus-ring, forwarding all native props. Font-size fixed at 16px (via the global `input, select, textarea` rule) so mobile Safari never auto-zooms on focus.
- **`Badge` / `StatusBadge`** — the `.chip*` classes wrapped as a component; `StockStatusBadge` pairs a colored dot with a text label (never color-only) driven by `stockStatusOf()` in `src/lib/stockStatus.ts` — the single source of truth for the ok/low/out/unlimited thresholds, shared by `/admin/menu`, `/admin/stock`, and `/pos/new`.
- **`Modal`** — centered card over a scrim on desktop, bottom-sheet slide-up on mobile. Used for confirm dialogs (via `ConfirmButton`) and short forms (restock).
- **`Drawer`** — same visual language as `Modal` but a full-height side panel on desktop / larger bottom sheet on mobile, for longer forms (menu item create/edit).
- **`EmptyState`** — icon + title + optional description + optional action, used everywhere a list can be empty (order board, menu, stock movements, tables, reports) instead of a bare "ยังไม่มี…" text line.
- **`BottomNavigation`** — fixed bottom tab bar, mobile only (`sm:hidden`); the desktop equivalent is `StaffNav`'s pill row in the header. Pages add bottom padding so this never clips the last card.
- **`ConfirmButton`** — button that opens a `Modal`-based confirm dialog before running a (typically destructive) server action; always a named confirm label ("ลบเมนู"), never a bare "ยืนยัน".
- **`CopyLinkButton`** — copies a QR order-link to the clipboard with a brief inline confirmation + toast.
- **`Toast`** — global `toast()` function + `<Toaster/>`, mounted once at the root layout.

### Buttons
- **Shape:** 8px radius, never fully pill-shaped except status chips and nav pills.
- **Hover / Focus:** primary/cta/accent darken by one step on hover; every interactive element keeps a visible focus state (never `outline: none` without a replacement).

### Cards / Containers
- **Corner style:** 20px radius (`.card`) — noticeably softer than buttons, so cards read "container" and buttons read "action."
- **Background:** `--surface`. **Border:** none — shadow alone separates card from page.

### Navigation
- **Staff header (desktop):** restaurant identity (dish-mark icon + "บ้านอร่อย" + "ระบบจัดการร้าน") on the left, `StaffNav`'s pill row centered, logout on the right.
- **Staff shell (mobile):** the same compact header plus a fixed `BottomNavigation` with 5 icon+label tabs (หน้าขาย/เมนู/คลังสินค้า/โต๊ะ-QR/รายงาน).
- **Customer order page:** no nav — a single sticky header and a fixed bottom cart bar are the entire chrome.

## 6. Do's and Don'ts

### Do:
- **Do** use `--cta` (terracotta) for only the one or two highest-stakes actions per screen — everything else primary is `--brand` (olive).
- **Do** reference CSS custom properties (`bg-(--brand)`, `text-(--text-muted)`) rather than a hardcoded `bg-white`/`bg-gray-*`/`text-red-600` utility.
- **Do** give every destructive action (`ConfirmButton`) a named confirm label, never a bare "ยืนยัน."
- **Do** keep every interactive element a real `<button>`/`<a>`/`<Link>` with a visible focus state and, for icon-only buttons, an `aria-label`.
- **Do** keep the receipt and QR print sheet literal black-on-white, independent of the viewer's OS theme.
- **Do** keep frequently-tapped icon-only controls (quantity steppers, modal close) at ≥44px.

### Don't:
- **Don't** add a second terracotta (`--cta`) button on the same screen — demote it to `--brand`/`--accent` instead.
- **Don't** reach for a blue/purple accent, or a literal pure-white/pure-black surface outside the print exception.
- **Don't** reintroduce `prefers-color-scheme: dark` styling — it was tried and explicitly dropped.
- **Don't** add gradient text, glassmorphism, or a hero-metric template — this is a POS tool, not a marketing page.
- **Don't** let a staff screen (`/pos`, `/admin/*`, `/reports`) get slower to scan for the sake of decoration — speed beats charm there.
- **Don't** copy any branding, logo, or illustration from an external reference — every icon/mark in this app is original inline SVG (`src/components/icons.tsx`).
