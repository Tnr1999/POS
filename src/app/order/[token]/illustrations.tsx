// Original line-art illustrations for the customer ordering page — hand-drawn
// "food journal" feeling via loose, slightly irregular strokes. Two-tone at
// most (olive + terracotta/gold accents), never a filled realistic drawing —
// the food photos stay the visual hero, these are just warm accents around
// empty/loading/success states and the page header.

type IllustrationProps = { className?: string };

/** Steaming bowl — used next to the hero greeting. */
export function SteamingBowlIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 46c0 15.5 12.5 28 28 28s28-12.5 28-28"
        stroke="var(--accent)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M14 46h68" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M30 46c1-4 4-6 6-9M46 46c1-5 5-7 6-11M62 46c1-4 4-6 6-9"
        stroke="var(--cta)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M36 20c-3 2-4 5-2 8M50 15c-3 2-4 5-2 8M64 20c-3 2-4 5-2 8"
        stroke="var(--gold)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}

/** Small decorative leaf sprig — used as a light accent near headings. */
export function LeafAccentIcon({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 20c8-1 14-7 15-15-8 1-14 7-15 15Z"
        stroke="var(--brand)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 18c3-4 6.5-7.5 11-10.5" stroke="var(--brand)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/** Empty plate with a wandering fork — "nothing here yet" doodle. */
export function EmptyPlateDoodle({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true">
      <circle cx="46" cy="50" r="26" stroke="var(--surface-border)" strokeWidth="3" />
      <circle cx="46" cy="50" r="16" stroke="var(--surface-border)" strokeWidth="2" />
      <path
        d="M74 30v14M74 30c-2 0-3 1-3 3v6M78 30v9"
        stroke="var(--brand-soft)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M74 44v14" stroke="var(--brand-soft)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Magnifier drifting past a noodle doodle — "no search results". */
export function NoResultsDoodle({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true">
      <circle cx="40" cy="42" r="20" stroke="var(--surface-border)" strokeWidth="3" />
      <path d="M55 57l14 14" stroke="var(--surface-border)" strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M31 42c2-5 5-8 9-8M42 42c2-5 5-8 9-8"
        stroke="var(--brand-soft)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Small confetti/celebration burst for the success state. */
export function CelebrationBurst({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 96 96" fill="none" className={className} aria-hidden="true">
      <circle cx="48" cy="48" r="22" fill="var(--gold)" opacity="0.18" />
      <path d="M48 20v10M48 66v10M20 48h10M66 48h10M28 28l7 7M61 61l7 7M68 28l-7 7M35 61l-7 7" stroke="var(--cta)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="48" cy="48" r="13" fill="var(--brand)" />
      <path d="M42 48l4 4 8-8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReceivedIcon({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M5 12l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PreparingPotIcon({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6v-3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2 11h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 4c-1.2 1.2-1.2 2.8 0 4M15 4c-1.2 1.2-1.2 2.8 0 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function ServingTrayIcon({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <ellipse cx="12" cy="18" rx="9" ry="2.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 18V9a6 6 0 0 1 12 0v9" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function ServedCheckIcon({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
