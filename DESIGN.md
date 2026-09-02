---
name: ร้านค้า POS
description: POS + สั่งอาหารผ่าน QR code สำหรับร้านอาหารขนาดเล็ก
colors:
  terracotta: "#c1440e"
  terracotta-deep: "#8f3009"
  terracotta-tint: "#fdece3"
  neutral-bg: "#f9fafb"
  neutral-bg-dark: "#0a0a0a"
  neutral-surface: "#ffffff"
  neutral-surface-dark: "#18181b"
  neutral-surface-muted: "#f3f4f6"
  neutral-surface-muted-dark: "#27272a"
  neutral-border: "#e5e7eb"
  neutral-border-dark: "#3f3f46"
  ink: "#111827"
  ink-dark: "#e5e7eb"
  ink-muted: "#6b7280"
  ink-muted-dark: "#a1a1aa"
  ink-subtle: "#374151"
  success: "#16a34a"
  danger: "#dc2626"
  warning: "#d97706"
typography:
  display:
    fontFamily: "Chonburi, 'Kanit', serif"
    fontSize: "clamp(1.5rem, 4vw, 2.25rem)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "normal"
  title:
    fontFamily: "Geist Sans, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Geist Sans, Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist Sans, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.3
  mono:
    fontFamily: "Geist Mono, monospace"
    fontSize: "0.875rem"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.terracotta}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.terracotta-deep}"
  button-ghost:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  card:
    backgroundColor: "{colors.neutral-surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.terracotta-tint}"
    textColor: "{colors.terracotta-deep}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
---

# Design System: ร้านค้า POS

## 1. Overview

**Creative North Star: "The Neighborhood Kitchen Counter"**

This is the counter at a restaurant that's good at what it does and doesn't need to prove it: warm terracotta where it matters (the "order," "pay," "confirm" moments), calm neutral gray everywhere else so staff can scan a busy screen without visual noise. The one screen a paying diner actually looks at — `/order/[token]` — gets a little more warmth and appetite (a display face for the shop name and menu categories); every staff screen (`/pos`, `/admin/*`, `/reports`) stays fast and quiet, because a server is working, not browsing.

This system explicitly rejects: the generic flat-gray SaaS dashboard the app shipped with before this pass (cards-everywhere, `bg-white`/`bg-black` with no identity); the cold blue/navy fintech look (wrong emotional register for a restaurant); and the cutesy food-app cliché of bouncy emoji and blob illustrations (a paying customer still needs to trust this screen with their order and their card).

**Key Characteristics:**
- One warm accent (terracotta) carries every primary action and brand moment — nowhere else.
- Staff surfaces are quiet and dense; the customer ordering surface is the one place allowed to feel inviting.
- Flat, tonal depth (soft shadows only), not glassy or skeuomorphic.
- Print artifacts (receipt, QR sheet) are always literal black-on-white, independent of on-screen theme.
- Full `prefers-color-scheme` dark mode: every token has a dark counterpart, not a bolted-on class.

## 2. Colors

Warm and restrained: a single terracotta accent against quiet neutral grays, with a light and dark counterpart for every neutral so the system holds up under either theme.

### Primary
- **Terracotta Ember** (`#c1440e`): every primary call-to-action — "สั่งอาหาร" (place order), "รับเงิน" (take payment), "เข้าสู่ระบบ" (log in), the customer-facing brand mark. Hover/active state is **Terracotta Ember Deep** (`#8f3009`).
- **Terracotta Tint** (`#fdece3`): soft background for "new"/highlight chips and the customer's live-order banner — the only place a tinted terracotta background appears.

### Neutral
- **Kitchen White** (`#ffffff` / dark: `#18181b`): card, header, and modal surfaces (`--surface`).
- **Counter Gray** (`#f9fafb` / dark: `#0a0a0a`): page background (`--background`).
- **Soft Gray** (`#f3f4f6` / dark: `#27272a`): qty steppers, hover states, soft accents (`--surface-muted`).
- **Hairline** (`#e5e7eb` / dark: `#3f3f46`): borders on top of a surface (`--surface-border`).
- **Ink** (`#111827` / dark: `#e5e7eb`): primary text (`--foreground`).
- **Ink Muted** (`#6b7280` / dark: `#a1a1aa`): secondary text — prices, timestamps, helper copy (`--text-muted`).
- **Ink Subtle** (`#374151` / dark: `#d4d4d8`): dimmed body text, e.g. secondary link (`--text-subtle`).
- **Charcoal** (`#1f2937` / dark: `#3f3f46`): secondary dark button/pill — "print," "add," "save" actions that aren't the primary action (`--accent`).

### Semantic
- **Success** (`#16a34a`): served, paid, menu item turned back on.
- **Danger** (`#dc2626`): delete/cancel text and confirm-dialog "danger" tone.
- **Warning** (`#d97706`): "ปิดขายชั่วคราว," QR-regenerate warning tone. Kept a clear hue-step away from terracotta (amber/gold vs. rust-orange) so it never gets mistaken for the brand accent.

### Named Rules
**The One Ember Rule.** Terracotta appears on exactly one primary action per screen and the customer brand mark. If a screen has two terracotta buttons competing for attention, one of them is wrong — demote it to `button-ghost` or `--accent`.

**The Paper Stays Paper Rule.** The receipt and the QR print sheet render `bg-white`/`text-black` literally, always — never `--surface`/`--foreground`. They are physical objects, not app screens, and must look identical regardless of the viewer's OS theme.

## 3. Typography

**Display Font:** Chonburi (Thai + Latin, Google Fonts), falling back to Kanit, then serif
**Body/UI Font:** Geist Sans (already wired via `next/font`), falling back to Arial
**Mono Font:** Geist Mono — the printed receipt only

**Character:** Chonburi is a bold, slightly rounded Thai display face with real warmth — it reads as "restaurant signage," not "corporate app," and carries Thai glyphs natively (this app's copy is Thai-first). It appears in exactly two places: the customer order page's shop-name header and section titles. Everything else — every staff screen, every button, every form label — stays in Geist Sans, because staff are scanning a busy screen fast and a display face there would slow that down.

### Hierarchy
- **Display** (400, `clamp(1.5rem, 4vw, 2.25rem)`, 1.15): shop name on `/order/[token]`, menu category headers. Nowhere on a staff screen.
- **Title** (700, 1.25rem, 1.3): page titles ("จัดการเมนู", "ออเดอร์ที่เปิดอยู่"), card headings.
- **Body** (400, 0.9375rem, 1.5): everything else — menu item names, form labels, table cells.
- **Label** (500, 0.8125rem, 1.3): timestamps, helper text, status pills.
- **Mono** (400, 0.875rem): the printed receipt body only — it's meant to look like it came out of a receipt printer.

### Named Rules
**The Two-Places Rule.** The display face (Chonburi) is permitted in exactly two contexts: the customer-facing shop name and menu section headers. Anywhere else — even a big number on a report — stays in Geist Sans at a larger size/weight instead of switching fonts.

## 4. Elevation

Flat by default, with one soft ambient shadow reserved for surfaces that sit "above" the page — cards, the sticky header, modals, toasts. No layered shadow scale, no glass blur. Depth comes from `--surface` vs `--background` contrast first, shadow second.

### Shadow Vocabulary
- **card** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.05), 0 1px 3px rgb(0 0 0 / 0.1)`; dark: `0 1px 2px rgb(0 0 0 / 0.4), 0 1px 3px rgb(0 0 0 / 0.5)`): every card, the sticky order header, the confirm dialog, the toast stack.
- **floating** (`box-shadow: 0 10px 30px rgb(0 0 0 / 0.15)`): the fixed bottom cart bar on the customer order page and the "new order" pos card ring — reserved for the one element per screen the user's thumb is about to hit.

### Named Rules
**The Flat-at-Rest Rule.** Nothing has a shadow just for decoration. A shadow means "this is a surface floating above the page" (card, modal, sticky bar) or "this needs your attention right now" (new-order highlight). If neither is true, no shadow.

## 5. Components

### Buttons
- **Shape:** 8px radius (`--rounded-sm`), never fully pill-shaped except status chips.
- **Primary:** `background: var(--brand)` / light mode = Terracotta Ember, dark mode = a light warm chip (`#fef3ec`) with `--brand-foreground` ink text — inverting so it doesn't vanish against a near-black page. Padding `10px 20px`, weight 500.
- **Secondary/Ghost:** `background: var(--accent)` (Charcoal) with white text, for "print," "add item," "save" — one visual step down from primary so the terracotta CTA still reads as *the* action.
- **Danger/Warning:** solid `--danger`/`--warning`, white text — reserved for `ConfirmButton`'s two destructive tones plus the cancel-order action.
- **Hover / Focus:** primary and secondary darken by one step on hover (`--brand-hover`/`--accent-hover`); every interactive element keeps the browser's default focus ring (never `outline: none` without a visible replacement).

### Chips
- **Status pill** ("ใหม่", "จ่ายแล้ว", item status): `Terracotta Tint` background + `Terracotta Ember Deep` text, pill radius (999px), `6px 14px` padding, `label` typography.
- **Filter/toggle** (order type selector): unselected = `button-ghost` outline; selected = `button-primary`.

### Cards / Containers
- **Corner style:** 16px radius (`--rounded-lg`) — noticeably softer than buttons, so cards read as "container" and buttons read as "action."
- **Background:** `--surface`.
- **Shadow:** `card` shadow from Elevation.
- **Border:** none in light mode (shadow alone separates card from page); dark mode adds a 1px `--surface-border` hairline since shadows read weaker against a dark page.
- **Internal padding:** 16px (`--spacing-md`), 24px on the login/error single-card pages.

### Inputs / Fields
- **Style:** transparent background (inherits the card behind it), 1px `--surface-border`, 8px radius, 16px font-size (fixed — prevents iOS auto-zoom on focus).
- **Focus:** browser default focus ring, kept intact — not suppressed.
- **Placeholder:** `--text-muted-2`, never lighter.

### Navigation
- **Staff header:** `--surface` background, bottom hairline border, nav links as text (no icons) with `hover:bg(--surface-muted)`; active page is implied by URL, not a persistent highlight — kept deliberately quiet per the "staff surfaces are quiet" principle.
- **Customer order page:** no nav — a single sticky header (shop name in Chonburi + "สแกนเพื่อสั่งอาหาร" subtitle) and a fixed bottom cart bar are the entire chrome.

### Toast / Confirm Dialog (signature components)
- **Toast:** dark `--accent` chip (or `--danger` for errors), white text, bottom-center, auto-dismiss — deliberately neutral-toned rather than terracotta, so a toast never gets mistaken for a call-to-action.
- **Confirm dialog:** centered card over a 40%-black scrim, title in `title` typography, message in `--text-muted`, two actions (ghost cancel + toned confirm) — never a single "OK," always an explicit named pair ("ลบเมนู" not "ยืนยัน").

## 6. Do's and Don'ts

### Do:
- **Do** use Terracotta Ember (`#c1440e`) for exactly one primary action per screen, plus the customer-facing brand mark.
- **Do** use Chonburi only for the customer order page's shop name and menu section headers — Geist Sans everywhere else, including every staff screen.
- **Do** keep the receipt and QR print sheet literal `bg-white`/`text-black`, independent of the viewer's OS theme.
- **Do** give every destructive action (`ConfirmButton`) a named confirm label ("ลบเมนู"), never a bare "ยืนยัน."
- **Do** keep every token defined for both light and dark (`prefers-color-scheme`) — no new hardcoded `bg-white`/`bg-gray-*`/`text-gray-*` utility.

### Don't:
- **Don't** add a second terracotta button on the same screen — demote it to ghost/charcoal instead.
- **Don't** use a colored `border-left`/`border-right` as a decorative stripe on cards or list rows (this project's absolute ban).
- **Don't** add gradient text, glassmorphism, or a hero-metric template — this is a POS tool, not a marketing page.
- **Don't** reach for the cold blue/navy fintech palette — wrong emotional register for a restaurant (per PRODUCT.md anti-references).
- **Don't** let a staff screen (`/pos`, `/admin/*`, `/reports`) get slower to scan for the sake of decoration — speed beats charm there; charm belongs on `/order/[token]`.
