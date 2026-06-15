# Plan 2 — Settings Overlay Redesign (Tab System)

**Target:** `src/apps/web/components/SettingsPanel.tsx` (opened from the Dashboard
account menu, `Dashboard.tsx:80` / `:116`).

## Why
Today everything lives in one long vertically-scrolling `Dialog` with `Separator`s
between sections: Default currency → Groq key → Connect Telegram → Categories. On
mobile it's a tall scroll, sections compete for attention, and there's no sense of
"where am I". The unused `@web/components/ui/tabs` already exists — this is a clean
fit.

## Goal
Reorganize the same functionality into a tabbed settings overlay so each concern
gets its own pane, the dialog stops growing unbounded, and the structure scales as
we add settings. No backend/tRPC changes — pure reorganization + polish.

## Tab structure
Use `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` from `@web/components/ui/tabs`.

1. **General** — Default currency (`settings.setDefaultCurrency`). Room for future
   prefs (date format, week start, theme — could host `<ThemeToggle/>` here too).
2. **AI** — Groq API key set/replace/remove (`settings.setGroqKey` /
   `removeGroqKey`), with the "Set / Not set" `Badge` and the helper line.
3. **Telegram** — Connect via `/link` code (`telegram.confirmLink`) + the list of
   linked chats with disconnect (`telegram.unlink` / `listLinks`).
4. **Categories** — Add (name + Expense/Income type) and the colored list with
   delete (`categories.create` / `delete` / `list`).

## Layout
- Keep the `Dialog`; swap the stacked `<section>`s for `Tabs`.
- Header: `DialogTitle` "Settings" stays; drop the now-redundant description or make
  it dynamic per tab.
- `TabsList`: horizontal, `grid grid-cols-4` so triggers are even; icons + short
  labels (`Settings`, `Sparkles`, `MessageCircle`, `Tags` from lucide). On ≤640px
  labels can shrink to icon + tooltip if cramped, but try text-first.
- Each `TabsContent` keeps its own `flex flex-col gap-*`; the dialog height becomes
  stable instead of summing all sections. Keep `max-h-[90vh] overflow-y-auto` as a
  safety net but it should rarely trigger now.
- Preserve the current `p-0` + per-section padding rhythm.

## Steps
1. Import `Tabs*`; wrap the four existing `<section>` bodies in `TabsContent`
   values `general` / `ai` / `telegram` / `categories`. The JSX inside each section
   moves almost verbatim — only the surrounding wrapper and the `Separator`s change.
2. Remove the inter-section `<Separator/>`s (tabs replace them).
3. Add a `defaultValue="general"`; keep tab state local (uncontrolled is fine).
4. Decide badge/empty-state per tab: e.g. Telegram tab shows an empty state
   ("No chats connected yet") instead of just hiding the list; Categories likewise.
5. Move the account/sign-out affordance? **No** — that stays in the Dashboard menu.
   But consider relocating `<ThemeToggle/>` into General for discoverability (optional).
6. Verify each mutation still calls `refetch()` / `utils.*.invalidate()` exactly as
   before — do not change data flow.

## Acceptance
- All four areas work identically (currency, key set/remove, link/unlink, category
  add/delete) with the same toasts.
- Switching tabs preserves in-progress input within a tab during the session.
- Dialog no longer scrolls on a typical viewport; tabs are keyboard-navigable
  (Radix Tabs handles arrow keys / focus) and correct in light + dark at ≤640px.

## Out of scope
New settings, server schema changes, persisting last-open tab across sessions.
