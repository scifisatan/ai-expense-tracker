# Plan 3 — Transaction Entry Overlay Redesign (Better UX)

**Target:** `src/apps/web/components/TransactionDialog.tsx` (shared create/edit form),
plus its trigger in `CommandBar.tsx`. Used for manual add (from CommandBar) and edit
(from `ActivityFeed` rows via `Dashboard.tsx:107`).

## Why
The current dialog is a plain stacked form: Type+Amount in a 2-col grid, Category
select, Note input, footer buttons. It works but the UX is flat:
- **Type** is a dropdown for a binary choice — slow, two taps.
- **Amount** is a normal text input with no currency affordance and no emphasis,
  even though it's the most important field.
- Category select doesn't differentiate income/expense visually.
- No keyboard ergonomics beyond Enter-submit; no quick-amount helpers.
- Validation is a single toast on submit ("Enter an amount greater than zero").

## Goal
Make manual entry fast and obvious while keeping the shared create/edit contract
(`onCreate` / `onUpdate`, the `mode`/`initial` seeding effect) intact.

## Changes
1. **Type as a segmented toggle**, not a `Select`. Two big pill buttons
   "Expense" / "Income" using `bg-expense-muted text-expense` and
   `bg-income-muted text-income` for the active state (money semantics from
   DESIGN.md). Switching type still resets `categoryId` (current behavior at
   `TransactionDialog.tsx:113`). Could be a `Tabs` or a custom 2-button group.
2. **Amount as the hero field.** Large, `.tabular`, with a leading currency symbol
   (resolve from `initial.currency` in edit, default-currency for create — pass it
   in as a prop from the Dashboard `summary.currency`). Keep `inputMode="decimal"`,
   `autoFocus`. Optional: quick-add chips (+5/+10/+20 or round) under it.
   Color the amount with the active type's `text-income`/`text-expense`.
3. **Category** — keep the `Select` but show a colored dot per option matching
   `cat.type` (reuse the dot pattern from `SettingsPanel.tsx:288`). Still filtered to
   the active type (`typeCategories`). Empty-state option "No category" stays.
4. **Note** — switch to `Textarea` (already in ui/) for multi-line, or keep `Input`
   but add a placeholder example. Minor.
5. **Validation inline**, not just a toast: disable submit until amount > 0, and show
   a small `text-expense` hint under the field if they try. Keep the toast as backup.
6. **Footer / submit** — primary button label stays mode-aware ("Add transaction" /
   "Save changes"); keep `saving` state. In create mode, consider "Add another"
   secondary action that submits and keeps the dialog open with type retained and
   amount cleared (fast repeated entry). Optional but high-value.
7. **Edit mode niceties** — surface a destructive "Delete" affordance in edit mode
   (currently delete lives only in the feed via `onDelete`); wire through a new
   optional `onDelete?` prop so editing and deleting share one surface. Confirm with
   a toast or a `dialog`-level confirm.

## Keep intact
- The `useEffect` seeding on open (`:59`) — extend it for the new currency prop.
- `mode === "edit"` vs create branching in `submit` (`:84`).
- `onCreate` returns `boolean` (false keeps dialog open on failure) — preserve.
- Number parsing via `Number(amount)` and the `fromMinor` seed.

## Steps
1. Add `currency` (and optional `onDelete`) to `Props`; thread `currency` from
   `Dashboard` → `CommandBar` → dialog, and from the feed edit path.
2. Replace the Type `Select` with the segmented control.
3. Rebuild the Amount block with the currency prefix + large tabular styling +
   optional quick chips.
4. Add the category dots; swap Note to `Textarea` if desired.
5. Add inline validation + disabled submit; optional "Add another" in create mode.
6. Add edit-mode Delete wired to `onDelete`.

## Acceptance
- Create and edit both produce identical results to today (amount in minor units,
  type, category, note).
- Type toggle resets category; amount field is the clear focal point and obeys money
  colors; works with keyboard (Tab/Enter) and at ≤640px in both themes.
- No regressions to the `onCreate` boolean / `onUpdate` contracts.

## Out of scope
Natural-language parsing (that's the CommandBar text path), multi-currency entry UI,
recurring transactions, attachments.
