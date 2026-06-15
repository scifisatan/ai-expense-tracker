import { Api } from "grammy"
import { eq } from "drizzle-orm"
import type { AppDb } from "@/db/client"
import { telegramLinks } from "@/db/schema"
import { formatMoney } from "@/shared/money"

// Publish + pin the current balance to every Telegram chat linked to the account.
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

  for (const link of links) {
    try {
      const message = await api.sendMessage(link.chatId, text)
      await api.pinChatMessage(link.chatId, message.message_id, {
        disable_notification: true
      })
    } catch (error) {
      console.error("[balance-publish-error]", error)
    }
  }
}
