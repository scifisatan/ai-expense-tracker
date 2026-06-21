import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

// Spending budgets. categoryId null = overall account budget.
export const budgets = sqliteTable('budgets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: text('account_id').notNull().references(() => accounts.id),
  categoryId: integer('category_id').references(() => categories.id),
  period: text('period').$type<"monthly">().notNull().default('monthly'),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull().default('USD'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    accountIdIdx: index('idx_budgets_account_id').on(table.accountId),
  };
});

// Records which budget threshold (80 / 100) has already alerted for a given
// period key (e.g. "2026-06"), so each alert fires at most once.
export const budgetAlerts = sqliteTable('budget_alerts', {
  budgetId: integer('budget_id').notNull().references(() => budgets.id),
  periodKey: text('period_key').notNull(),
  threshold: integer('threshold').notNull(),
}, (table) => {
  return {
    pk: uniqueIndex('idx_budget_alerts_unique').on(table.budgetId, table.periodKey, table.threshold),
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
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type BudgetAlert = typeof budgetAlerts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type AccountSetting = typeof accountSettings.$inferSelect;
export type NewAccountSetting = typeof accountSettings.$inferInsert;
