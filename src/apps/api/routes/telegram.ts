import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { t, publicProcedure, protectedProcedure } from "../trpc"
import { confirmLinkInputSchema } from "@/shared/types"

const LINK_CODE_TTL_MS = 5 * 60 * 1000

// Unambiguous alphabet (no 0/O/1/I) for a human-typed code.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

const generateCode = (length = 6): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("")
}

export const telegramRouter = t.router({
  // Bot-only: issue a one-time code that the user enters on the (authenticated) web app.
  requestLinkCode: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.actor !== "bot" || !ctx.telegram) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Bot only" })
    }

    await ctx.repos.telegram.deleteExpiredCodes(Date.now())

    const code = generateCode()
    await ctx.repos.telegram.createCode({
      code,
      chatId: ctx.telegram.chatId,
      telegramUserId: ctx.telegram.userId ?? null,
      username: ctx.telegram.username ?? null,
      firstName: ctx.telegram.firstName ?? null,
      lastName: ctx.telegram.lastName ?? null,
      expiresAt: Date.now() + LINK_CODE_TTL_MS,
    })

    return { code, expiresInSeconds: LINK_CODE_TTL_MS / 1000 }
  }),

  // Web (authenticated): confirm a code issued by the bot, linking the chat to this account.
  confirmLink: protectedProcedure
    .input(confirmLinkInputSchema)
    .mutation(async ({ input, ctx }) => {
      const code = input.code.trim().toUpperCase()
      const record = await ctx.repos.telegram.findCode(code)

      if (!record || record.expiresAt < Date.now()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired code." })
      }

      await ctx.repos.telegram.createLink({
        chatId: record.chatId,
        accountId: ctx.accountId,
        telegramUserId: record.telegramUserId,
        username: record.username,
        firstName: record.firstName,
        lastName: record.lastName,
      })

      await ctx.repos.telegram.deleteCode(code)

      return { ok: true, chatId: record.chatId }
    }),

  listLinks: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.repos.telegram.listLinksByAccount(ctx.accountId)
    return { items }
  }),

  unlink: protectedProcedure
    .input(z.object({ chatId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.repos.telegram.deleteLink(ctx.accountId, input.chatId)
      return { ok: true }
    }),
})
