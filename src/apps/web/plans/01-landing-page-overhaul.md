# Plan 1 — Landing Page Overhaul

**Target:** `src/apps/web/components/AuthScreen.tsx` (the pre-auth screen shown by
`App.tsx` when `!session?.authenticated`).

## Why
Today the landing is a single small `max-w-sm` card with a wallet icon, one
sentence, and a "Sign in with Google" button. It does no selling — it doesn't
explain the natural-language capture, the Telegram parity, or the privacy angle
that the rest of the product leans on. First impression reads like a login form,
not a product.

## Goal
A real landing page: a focused hero that states the value, a short proof section
that shows the conversational-feed concept, and a clear single sign-in CTA — all
inside the existing warm design language (no new tokens, no hard-coded colors).
Must hold together at ≤640px and look correct in light **and** dark.

## Constraints (from DESIGN.md)
- Compose `@web/components/ui/*` (button, card, badge, separator) + Tailwind tokens.
- Brand = `primary`; money semantics use `income`/`expense`; numerals get `.tabular`.
- The Google button **must stay a plain `<a href="/api/auth/google">`** (server-side
  OAuth redirect, not a tRPC call). Keep it wrapped in `<Button asChild>`.
- Keep `<ThemeToggle/>` reachable.
- Voice: warm but precise, sentence case (see DESIGN.md "Voice").

## Proposed structure
1. **Top bar** — small brand lockup (wallet chip + "Budget", matching the
   Dashboard header at `Dashboard.tsx:55`) on the left, `<ThemeToggle/>` on the right.
   Replaces the floating absolute toggle.
2. **Hero** (centered, single column, `max-w-2xl`):
   - Eyebrow `<Badge variant="secondary">` e.g. "Money, in plain words".
   - Headline (text-4xl→5xl, `tracking-tight`): the core promise.
   - Subhead (`text-muted-foreground`): track on web + Telegram, always in sync.
   - Primary CTA: the Google `<a>` button (`size="lg"`), plus a muted one-liner
     under it ("Free. No card. Connect Telegram later.").
   - Reuse `BalanceHero`'s ambient glow trick (`bg-primary/15 blur-3xl`) as a soft
     backdrop so the page feels part of the app, not a separate site.
3. **Proof row** — 3 feature cards (`Card`) with lucide icons:
   - `Sparkles` — "Type it like you'd say it" (mirrors the CommandBar placeholder).
   - `MessageCircle` — "Capture from Telegram" (parity story).
   - `ShieldCheck`/`Lock` — "Your data, your key" (Groq-key/privacy angle).
   Each: icon chip + title + one line. Stack on mobile, 3-col `sm:` and up.
4. **Optional mini-preview** — a static, non-interactive mock of the feed/hero
   (a styled `Card` with a fake balance + 2 rows) to show the product. Keep it
   purely presentational; no data fetching on an unauthenticated route.
5. **Footer** — tiny muted line, repeat-CTA optional.

## Steps
1. Rebuild `AuthScreen.tsx` with the sections above; extract small local
   subcomponents (`Feature`, `Hero`) within the file or `components/landing/` if it
   grows past ~150 lines.
2. Pull the brand lockup into a shared snippet if it's now used in 3 places
   (Dashboard header, LoadingScreen, landing) — e.g. `components/Brand.tsx`.
3. Verify focus-visible/hover on the CTA and toggle; check tab order.
4. Manually verify light + dark and the 375px width.

## Acceptance
- Sign-in still works via the plain `<a>` redirect.
- No hard-coded hex/radii/fonts; everything from tokens.
- Looks intentional at 375px and on desktop, both themes.
- Lighthouse/visual: no layout shift, no fetch before auth.

## Out of scope
Marketing copy A/B, analytics, animations beyond the existing glow, routing changes.
