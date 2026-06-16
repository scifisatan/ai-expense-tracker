# Web Design Language

Single source of truth for the web UI. Built on **shadcn/ui + Tailwind v4**.

**Concept:** a *conversational feed* — a balance hero, a natural-language command bar
(mirrors the Telegram bot), and a day-grouped activity feed. Single centered column,
app-like, mobile-first. Core screens: `BalanceHero`, `CommandBar`, `TransactionDialog`
(shared add/edit), `ActivityFeed` + `ActivityItem`, all composed by `Dashboard`.

**Mood:** *warm & approachable* — cream surfaces, a friendly warm-orange brand, generous
rounding (`--radius: 1rem`), soft shadows; light **and** dark. Tokens live in
`src/apps/web/styles.css`; do not hard-code colors/radii/fonts.

## Foundations
- **Theme:** system-aware light/dark via the `.dark` class on `<html>`. Use `useTheme()`
  (`@web/hooks/useTheme`) and the shared `<ThemeToggle/>` (`@web/components/ThemeToggle`).
  Never read raw hex — everything resolves from CSS variables.
- **Color (Tailwind classes):** `bg-background text-foreground`, `bg-card`, `bg-muted`,
  `text-muted-foreground`, `border-border`, `bg-primary text-primary-foreground`,
  `ring-ring`. Brand = **primary** (indigo).
- **Money semantics:** income → `text-income` / `bg-income-muted`; expense → `text-expense`
  / `bg-expense-muted`. Use these everywhere amounts appear (web parity with the bot).
- **Numerals:** wrap amounts/IDs/dates in `className="tabular"` (DM Mono, tabular figures).
  Body/UI text is DM Sans (default `font-sans`).
- **Radius:** use `rounded-md/-lg/-xl` (driven by `--radius`). **Spacing:** Tailwind scale
  (multiples of 4). **Shadow:** `shadow-sm`/`shadow` for cards — keep it soft.

## Components — compose shadcn, don't reinvent
Available in `@web/components/ui/*`: `button`, `card`, `input`, `textarea`, `label`,
`select`, `badge`, `dialog`, `table`, `tabs`, `skeleton`, `sonner` (toast), `switch`,
`dropdown-menu`, `separator`, `tooltip`. Use `Button` variants
(`default|secondary|ghost|outline|destructive`, sizes `sm|default|lg|icon`) instead of
bespoke button classes. Merge classes with `cn()` from `@web/lib/utils`.

## Patterns (required)
- **Feedback:** use `toast()` from `sonner` (already mounted in `client.tsx`) for
  success/error — `toast.success`, `toast.error`. Replace ad-hoc status banners.
- **Loading:** use `<Skeleton/>` for tables/cards; never a bare "Loading…" string.
- **Empty states:** centered icon + one-line message + a primary action (e.g. "Add your
  first transaction"). Use lucide icons.
- **Every interactive element** needs hover/focus-visible/disabled states and must look
  correct in light **and** dark (verify both).
- **Mobile:** must hold together at ≤640px (stack, scroll tables, full-width dialogs).
- **Money formatting:** always `formatMoney`/`fromMinor` from `@web/helper` — never divide
  by 100 by hand.

## Voice (web microcopy)
Warm but precise, consistent with the Telegram bot: "Add your first transaction",
"Saved", "Couldn't connect — check the code and try again." Sentence case, no jargon.
