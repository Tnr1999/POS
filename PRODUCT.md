# Product

## Register

product

## Users

Two audiences on the same system:
- **Restaurant staff** (servers, cashiers, kitchen) using `/pos`, `/admin/*`, `/reports` on a shared tablet or phone behind the counter, often mid-shift with wet/greasy hands, needing to glance and tap fast between taking orders and running the register.
- **Diners** at a table using `/order/[token]` on their own phone after scanning a QR code — casual, one-handed, browsing a menu and building a cart before eating.

## Product Purpose

A free, self-hosted POS + QR ordering system for small restaurants: diners order from their phone, orders land on the staff screen in real time, staff track prep status and close out the bill with a printed receipt. Success = fewer order mistakes, faster table turnover, and a shop owner who can run this without a POS vendor contract.

## Brand Personality

Warm, restaurant-native, unmistakably food — not a generic SaaS admin panel. Accent color: orange/terracotta (appetite, warmth, energy) used deliberately for primary actions and brand moments, not washed into every surface.

## Anti-references

- Generic flat gray SaaS dashboard (the current unstyled state) — cards-everywhere, no personality, could be any B2B tool.
- Cold blue/navy fintech look — wrong emotional register for a restaurant.
- Overly cutesy/toylike food-app cliché (bouncy emoji, rounded blob illustrations) — this still has to look competent enough for a paying diner's phone.

## Design Principles

1. **Speed over decoration for staff surfaces** — `/pos` and `/admin/*` prioritize scan-ability and large tap targets over visual flourish; staff are working, not browsing.
2. **Appetite on the customer surface** — `/order/[token]` is the one screen allowed to feel inviting and food-forward; it's the only screen a paying customer actually looks at.
3. **One accent, used with intent** — orange/terracotta marks the primary action and brand identity; everything else stays quiet neutrals so the accent keeps its meaning.
4. **Print stays print** — the receipt and QR sheet are physical artifacts; they render as literal black-on-white regardless of the on-screen theme.
5. **No dead ends** — every destructive action confirms, every async action gives feedback (toast/loading/highlight); staff should never wonder if a tap worked.

## Accessibility & Inclusion

Standard WCAG AA: ≥4.5:1 body text contrast, ≥44px touch targets on mobile (already enforced via global `button { min-height: 2.5rem }`), `prefers-reduced-motion` respected for any new animation. No dark mode — tried it, dropped per feedback ("don't like the black background at all"); the app always renders light/cream regardless of the OS theme.
