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

export const accountSettings = sqliteTable('account_settings', {
  accountId: text('account_id').primaryKey().references(() => accounts.id),
  groqApiKey: text('groq_api_key'),
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
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type AccountSetting = typeof accountSettings.$inferSelect;
export type NewAccountSetting = typeof accountSettings.$inferInsert;
