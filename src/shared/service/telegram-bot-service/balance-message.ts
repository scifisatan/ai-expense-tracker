import { Api } from "grammy"
import type { LedgerBalancePublisher } from "@/shared/service/ledger-service"

export type TelegramBalanceInfo = {
  balance: number | null
  messageId?: number
}

export const parseTelegramBalanceMessage = (text: string): number | null => {
  const cleaned = text.trim()
  const balanceMatch = cleaned.match(
    /(?:remaining|current|total)?\s*balance\s*:?\s*r?s?\.?\s*(-?[\d,.]+)/i
  )

  if (balanceMatch?.[1]) {
    const value = Number(balanceMatch[1].replace(/,/g, ""))
    if (!Number.isNaN(value)) return value
  }

  const rupeeMatch = cleaned.match(/rs\.?\s*(-?[\d,.]+)/i)
  if (rupeeMatch?.[1]) {
    const value = Number(rupeeMatch[1].replace(/,/g, ""))
    if (!Number.isNaN(value)) return value
  }

  return null
}

export const createTelegramBalanceService = (api: Api) => ({
  async getPinnedBalance(chatId: number): Promise<TelegramBalanceInfo> {
    try {
      const chatInfo = await api.getChat(chatId)
      const pinned = (chatInfo as any).pinned_message

      if (pinned?.text) {
        const balance = parseTelegramBalanceMessage(pinned.text)
        if (balance !== null) return { balance, messageId: pinned.message_id }
      }
    } catch (error) {
      console.error("[balance-fetch-error]", error)
    }

    return { balance: null }
  },

  async sendAndPinBalance(chatId: number, balance: number) {
    const balanceText = `💰 Current Balance: Rs. ${balance}`
    const balanceMsg = await api.sendMessage(chatId, balanceText)
    await api.pinChatMessage(chatId, balanceMsg.message_id, {
      disable_notification: true
    })
    return balanceMsg.message_id
  }
})

export const createTelegramBalancePublisher = (
  botToken?: string
): LedgerBalancePublisher | undefined => {
  if (!botToken) return undefined

  const balanceService = createTelegramBalanceService(new Api(botToken))
  return {
    async publishBalance(chatId, balance) {
      await balanceService.sendAndPinBalance(chatId, balance)
    }
  }
}

export type TelegramBalanceService = ReturnType<typeof createTelegramBalanceService>
