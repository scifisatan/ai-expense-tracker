import { Api } from "grammy"
import { eq } from "drizzle-orm"
import { telegramLinks } from "@/db/schema"
import type { AppDb } from "@/db/client"

// Send a plain-text message to every Telegram chat linked to an account.
// Best-effort per chat: one failure doesn't block the others. No-op without a
// bot token or any linked chat.
export const notifyLinkedChats = async (
  botToken: string | undefined,
  db: AppDb,
  accountId: string,
  text: string
): Promise<void> => {
  if (!botToken) return
  const links = await db.query.telegramLinks.findMany({
    where: eq(telegramLinks.accountId, accountId)
  })
  if (!links.length) return

  const api = new Api(botToken)
  for (const link of links) {
    try {
      await api.sendMessage(link.chatId, text)
    } catch (error) {
      console.error("[telegram-notify-error]", error)
    }
  }
}
