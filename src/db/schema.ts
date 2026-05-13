import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  userId: integer('user_id').primaryKey(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: integer('chat_id').notNull(),
  userId: integer('user_id'),
  amount: real('amount').notNull(),
  type: text('type').$type<"Income" | "Expense">().notNull(), // 'Income' | 'Expense'
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    userIdIdx: index('idx_transactions_user_id').on(table.userId),
    chatIdIdx: index('idx_transactions_chat_id').on(table.chatId),
    chatIdCreatedAtIdx: index('idx_transactions_chat_id_created_at').on(table.chatId, table.createdAt),
  };
});

export const userSettings = sqliteTable('user_settings', {
  userId: integer('user_id').primaryKey().references(() => users.userId),
  groqApiKey: text('groq_api_key'),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type UserSetting = typeof userSettings.$inferSelect;
export type NewUserSetting = typeof userSettings.$inferInsert;
