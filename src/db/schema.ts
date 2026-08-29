import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';

// Root identity. Created via web OAuth (Google).
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  oauthProvider: text('oauth_provider').notNull(),
  oauthSubject: text('oauth_subject').notNull(),
  defaultCurrency: text('default_currency').notNull().default('USD'),
  timezone: text('timezone').notNull().default('UTC'),
  // Bumped to invalidate all outstanding session tokens ("log out everywhere").
  tokenVersion: integer('token_version').notNull().default(0),
  // Set when the account completes first-run onboarding (currency + timezone).
  // NULL means onboarding is still pending.
  onboardedAt: text('onboarded_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    emailIdx: uniqueIndex('idx_accounts_email').on(table.email),
    oauthIdx: uniqueIndex('idx_accounts_oauth').on(table.oauthProvider, table.oauthSubject),
  };
});

// Maps a Telegram chat to an account. Telegram is an input channel, not an identity.
export const telegramLinks = sqliteTable('telegram_links', {
  chatId: integer('chat_id').primaryKey(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  telegramUserId: integer('telegram_user_id'),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  // Telegram message id of the pinned balance message, edited in place instead of
  // posting (and pinning) a fresh one on every transaction.
  pinnedMessageId: integer('pinned_message_id'),
  linkedAt: text('linked_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    accountIdIdx: index('idx_telegram_links_account_id').on(table.accountId),
  };
});

// Pending Telegram link requests: bot issues the code, web confirms it.
export const linkCodes = sqliteTable('link_codes', {
  code: text('code').primaryKey(),
  chatId: integer('chat_id').notNull(),
  telegramUserId: integer('telegram_user_id'),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  expiresAt: integer('expires_at').notNull(),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: text('account_id').notNull().references(() => accounts.id),
  name: text('name').notNull(),
  type: text('type').$type<"Income" | "Expense">().notNull(),
  color: text('color'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    accountIdIdx: index('idx_categories_account_id').on(table.accountId),
  };
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: text('account_id').notNull().references(() => accounts.id),
  amountMinor: integer('amount_minor').notNull(), // stored in minor units (e.g. cents)
  currency: text('currency').notNull().default('USD'),
  type: text('type').$type<"Income" | "Expense">().notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  note: text('note'),
  occurredAt: text('occurred_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  source: text('source').$type<"web" | "telegram">().notNull().default('web'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    accountIdIdx: index('idx_transactions_account_id').on(table.accountId),
    accountOccurredIdx: index('idx_transactions_account_occurred').on(table.accountId, table.occurredAt),
  };
});

// One income period being paced. [start_at, end_at) is a half-open DB-timestamp
// range, same convention as monthRange/weekRange. Cycle membership for
// transactions is derived from occurred_at falling in this range, not stored.
export const cycles = sqliteTable('cycles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: text('account_id').notNull().references(() => accounts.id),
  startAt: text('start_at').notNull(),
  endAt: text('end_at').notNull(),
  grossMinor: integer('gross_minor').notNull(),
  currency: text('currency').notNull().default('USD'),
  sweepPct: integer('sweep_pct').notNull().default(50),
  closedAt: text('closed_at'), // manual early close; null while active
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    accountIdIdx: index('idx_cycles_account_id').on(table.accountId),
    accountRangeIdx: index('idx_cycles_account_range').on(table.accountId, table.startAt, table.endAt),
  };
});

// Off-the-top deductions from a cycle's gross before the pacing pool is
// computed. kind = 'needs_reserve' also credits the needs_reserve fund
// bucket on the cycle's first day close; every other kind is a plain
// deduction (label carries the specific "Netflix", "Rent", etc.).
export const allocations = sqliteTable('allocations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cycleId: integer('cycle_id').notNull().references(() => cycles.id),
  kind: text('kind').$type<"family" | "savings" | "subscriptions" | "fixed" | "needs_reserve" | "other">().notNull(),
  label: text('label').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    cycleIdIdx: index('idx_allocations_cycle_id').on(table.cycleId),
  };
});

// One row per account per local calendar day, written once by the day-close
// cron. Composite PK makes retries idempotent no-ops; row is immutable once written.
export const dayCloses = sqliteTable('day_closes', {
  accountId: text('account_id').notNull().references(() => accounts.id),
  localDate: text('local_date').notNull(), // "YYYY-MM-DD"
  cycleId: integer('cycle_id').notNull().references(() => cycles.id),
  allowanceMinor: integer('allowance_minor').notNull(),
  spentMinor: integer('spent_minor').notNull(),
  sweptMinor: integer('swept_minor').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.accountId, table.localDate] }),
    cycleIdIdx: index('idx_day_closes_cycle_id').on(table.cycleId),
  };
});

// Needs/wants queue. rank is a fractional drag-reorder sort key (see
// shared/allowance.ts midRank/needsRenormalize).
export const queueItems = sqliteTable('queue_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: text('account_id').notNull().references(() => accounts.id),
  kind: text('kind').$type<"need" | "want">().notNull(),
  title: text('title').notNull(),
  priceMinor: integer('price_minor').notNull(),
  currency: text('currency').notNull().default('USD'),
  rank: real('rank').notNull(),
  status: text('status').$type<"queued" | "purchased" | "cancelled">().notNull().default('queued'),
  coolingUntil: text('cooling_until'), // wants only
  deadline: text('deadline'), // needs only, informational
  purchasedAt: text('purchased_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    accountIdIdx: index('idx_queue_items_account_id').on(table.accountId),
    accountKindStatusRankIdx: index('idx_queue_items_account_kind_status_rank').on(table.accountId, table.kind, table.status, table.rank),
  };
});

// Append-only ledger for both funds. Balance = SUM(delta_minor) per
// (account_id, bucket) — never a stored running total, so a partial failure
// can never leave a balance that disagrees with the underlying history.
export const fundLedger = sqliteTable('fund_ledger', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: text('account_id').notNull().references(() => accounts.id),
  bucket: text('bucket').$type<"want_fund" | "needs_reserve" | "savings_vault">().notNull(),
  deltaMinor: integer('delta_minor').notNull(), // + sweep/credit, - purchase
  reason: text('reason').$type<"sweep" | "purchase" | "reserve_credit" | "adjustment" | "deposit">().notNull(),
  dayCloseLocalDate: text('day_close_local_date'), // set for sweep/reserve_credit
  queueItemId: integer('queue_item_id').references(() => queueItems.id), // set for purchase
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    accountIdIdx: index('idx_fund_ledger_account_id').on(table.accountId),
    accountBucketIdx: index('idx_fund_ledger_account_bucket').on(table.accountId, table.bucket),
  };
});

// Idempotency guard for the once-daily 8am local-time push, independent of
// day_closes since the two crons fire at different local hours.
export const morningPushes = sqliteTable('morning_pushes', {
  accountId: text('account_id').notNull().references(() => accounts.id),
  localDate: text('local_date').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.accountId, table.localDate] }),
  };
});

export const accountSettings = sqliteTable('account_settings', {
  accountId: text('account_id').primaryKey().references(() => accounts.id),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type TelegramLink = typeof telegramLinks.$inferSelect;
export type NewTelegramLink = typeof telegramLinks.$inferInsert;
export type LinkCode = typeof linkCodes.$inferSelect;
export type NewLinkCode = typeof linkCodes.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Cycle = typeof cycles.$inferSelect;
export type NewCycle = typeof cycles.$inferInsert;
export type Allocation = typeof allocations.$inferSelect;
export type AllocationKind = Allocation["kind"];
export type NewAllocation = typeof allocations.$inferInsert;
export type DayClose = typeof dayCloses.$inferSelect;
export type NewDayClose = typeof dayCloses.$inferInsert;
export type QueueItem = typeof queueItems.$inferSelect;
export type NewQueueItem = typeof queueItems.$inferInsert;
export type FundLedgerEntry = typeof fundLedger.$inferSelect;
export type NewFundLedgerEntry = typeof fundLedger.$inferInsert;
export type MorningPush = typeof morningPushes.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type AccountSetting = typeof accountSettings.$inferSelect;
export type NewAccountSetting = typeof accountSettings.$inferInsert;
