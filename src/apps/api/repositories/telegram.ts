import type { AppDb } from "@/db/client"

import { and, eq, lt } from "drizzle-orm"
import { telegramLinks, linkCodes } from "@/db/schema"
import type { NewTelegramLink, NewLinkCode } from "@/db/schema"

export const createTelegramRepo = (db: AppDb) => ({
  // Links
  findLinkByChatId: (chatId: number) =>
    db.query.telegramLinks.findFirst({ where: eq(telegramLinks.chatId, chatId) }),

  listLinksByAccount: (accountId: string) =>
    db.query.telegramLinks.findMany({ where: eq(telegramLinks.accountId, accountId) }),

  createLink: (link: NewTelegramLink) =>
    db
      .insert(telegramLinks)
      .values(link)
      .onConflictDoUpdate({
        target: telegramLinks.chatId,
        set: {
          accountId: link.accountId,
          telegramUserId: link.telegramUserId ?? null,
          username: link.username ?? null,
          firstName: link.firstName ?? null,
          lastName: link.lastName ?? null,
        },
      }),

  deleteLink: (accountId: string, chatId: number) =>
    db
      .delete(telegramLinks)
      .where(and(eq(telegramLinks.accountId, accountId), eq(telegramLinks.chatId, chatId))),

  // One-time link codes (bot-issued, web-confirmed)
  createCode: (code: NewLinkCode) => db.insert(linkCodes).values(code),

  findCode: (code: string) =>
    db.query.linkCodes.findFirst({ where: eq(linkCodes.code, code) }),

  deleteCode: (code: string) => db.delete(linkCodes).where(eq(linkCodes.code, code)),

  deleteExpiredCodes: (now: number) =>
    db.delete(linkCodes).where(lt(linkCodes.expiresAt, now)),
})

export type TelegramRepo = ReturnType<typeof createTelegramRepo>
