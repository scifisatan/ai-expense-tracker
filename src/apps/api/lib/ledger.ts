import { Api } from "grammy"
import { eq } from "drizzle-orm"
import type { AppDb } from "@/db/client"
import { telegramLinks } from "@/db/schema"
import { formatMoney } from "@/shared/money"

// Publish the current balance to every Telegram chat linked to the account.
// The balance is pinned once and then edited in place on subsequent updates, so
// the chat isn't flooded with a new pinned message per transaction.
// No-op when the account has no linked chat or no bot token is configured.
export const publishBalance = async (
  botToken: string | undefined,
  db: AppDb,
  accountId: string,
  balanceMinor: number,
  currency: string
): Promise<void> => {
  if (!botToken) return

  const links = await db.query.telegramLinks.findMany({
    where: eq(telegramLinks.accountId, accountId)
  })

  if (links.length === 0) return

  const api = new Api(botToken)
  const text = `💰 Current balance\n${formatMoney(balanceMinor, currency)}`

  const persistPinned = (chatId: number, messageId: number | null) =>
    db
      .update(telegramLinks)
      .set({ pinnedMessageId: messageId })
      .where(eq(telegramLinks.chatId, chatId))

  // Send + pin a fresh balance message, unpinning the previous one if any.
  const sendAndPin = async (chatId: number, previousId: number | null) => {
    const message = await api.sendMessage(chatId, text)
    await api.pinChatMessage(chatId, message.message_id, { disable_notification: true })
    if (previousId) {
      await api.unpinChatMessage(chatId, previousId).catch(() => {})
    }
    await persistPinned(chatId, message.message_id)
  }

  for (const link of links) {
    try {
      if (link.pinnedMessageId) {
        // Try to edit the existing pinned message; if it was deleted or is too old
        // to edit, fall back to sending + pinning a new one.
        try {
          await api.editMessageText(link.chatId, link.pinnedMessageId, text)
        } catch {
          await sendAndPin(link.chatId, link.pinnedMessageId)
        }
      } else {
        await sendAndPin(link.chatId, null)
      }
    } catch (error) {
      console.error("[balance-publish-error]", error)
    }
  }
}
