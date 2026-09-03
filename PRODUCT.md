# Product

## Register

product

## Users

Two audiences on the same system:
- **Restaurant staff** (servers, cashiers, kitchen) using `/pos`, `/admin/*`, `/reports` on a shared tablet or phone behind the counter, often mid-shift with wet/greasy hands, needing to glance and tap fast between taking orders and running the register.
- **Diners** at a table using `/order/[token]` on their own phone after scanning a QR code — casual, one-handed, browsing a menu and building a cart before eating.

## Product Purpose

A free, self-hosted POS + QR ordering system for small restaurants: diners order from their phone, orders land on the staff screen in real time, staff track prep status and close out the bill with a printed receipt. Success = fewer order mistakes, faster table turnover, and a shop owner who can run this without a POS vendor contract.

## Brand Identity

**บ้านอร่อย** ("Baan Aroi" — "the tasty house"), tagline "ระบบจัดการร้าน" ("shop management system"). A small original hand-drawn dish-mark SVG (`DishMarkIcon`) stands in for a logo next to the name on the login page and every staff screen's header — no external logo, photo, or branding was used or copied from any reference; every mark in this app is original inline SVG.

## Brand Personality

Warm, restaurant-native, unmistakably food — not a generic SaaS admin panel. A warm olive + terracotta + gold palette on cream paper (never cold gray, never pure white) used deliberately for primary actions and brand moments, not washed into every surface. See DESIGN.md for the full palette and the two-accent split (olive for ordinary actions, terracotta reserved for the highest-stakes ones).

## Anti-references

- Generic flat gray SaaS dashboard (the app's original unstyled state) — cards-everywhere, no personality, could be any B2B tool.
- Cold blue/navy fintech look, and strong blue/purple accents generally — wrong emotional register for a restaurant.
- Overly cutesy/toylike food-app cliché (bouncy emoji, rounded blob illustrations) — this still has to look competent enough for a paying diner's phone and a real commercial POS a shop owner would show a customer.
- Bootstrap-default admin-template look, or anything that reads as a school project / basic CRUD scaffold.

## Design Principles

1. **Speed over decoration for staff surfaces** — `/pos` and `/admin/*` prioritize scan-ability and large tap targets over visual flourish; staff are working, not browsing.
2. **Appetite on the customer surface** — `/order/[token]` is the one screen allowed to feel the most inviting and food-forward; it's the only screen a paying customer actually looks at.
3. **Two accents, used with intent** — olive (`--brand`) marks ordinary primary actions and the brand identity; terracotta (`--cta`) is reserved for only the one or two highest-stakes actions per screen (place order, take payment). Everything else stays quiet neutrals so both accents keep their meaning.
4. **Print stays print** — the receipt and QR sheet are physical artifacts; they render as literal black-on-white regardless of the on-screen theme.
5. **No dead ends** — every destructive action confirms via a named `ConfirmButton` dialog, every async action gives feedback (toast/loading/highlight); staff should never wonder if a tap worked.
6. **Preserve the logic, redesign the presentation** — every redesign pass keeps auth, menu CRUD, inventory logic, table/QR generation, order lifecycle, and report calculations byte-for-byte identical; only the surrounding UI changes.

## Accessibility & Inclusion

Standard WCAG AA: ≥4.5:1 body text contrast (every semantic text token in DESIGN.md is checked against both `--background` and `--surface`), ≥44px touch targets for frequently-tapped controls (quantity steppers, modal/drawer close — enforced explicitly; every other button keeps the global `button { min-height: 2.5rem }` floor), `prefers-reduced-motion`-friendly animation (short, non-essential). Status is always paired with text, never color alone (`StatusBadge`). No dark mode — tried it, dropped per feedback ("don't like the black background at all"); the app always renders light/cream regardless of the OS theme.
