import { createGroq } from "@ai-sdk/groq"
import { generateText } from "ai"
import { TransactionsExtraction, transactionsSchema } from "@/shared/types"
import { log } from "@/utils/logger"

export const createAiService = (options: { model: string }) => {
  return {
    async extractTransactions(message: string, groqToken: string): Promise<TransactionsExtraction> {
      const groq = createGroq({ apiKey: groqToken })

      log.ai.debug("ai.extractTransactions.model", options.model)
      log.ai.debug("ai.extractTransactions.prompt", message)

      const { text } = await generateText({
        model: groq(options.model),
        system: `Extract every monetary transaction mentioned in the message.

Return ONLY valid JSON with this exact shape:
{"items":[{"amount":12.50,"type":"Expense","note":"coffee","category":"Food"}]}

Rules:
- amount must be a positive number; decimals are allowed (strip currency symbols).
- type must be either "Expense" or "Income".
- note must describe the specific transaction amount it appears next to or on the same line as.
- category is OPTIONAL: a short label like "Food", "Transport", "Shopping", "Bills", "Salary". Omit if unsure.
- Associate descriptive text with the closest relevant amount.
- If no clear note is associated, use an empty string.
- If no clear amounts are found, return: {"items":[]}
- Do not include markdown, backticks, or extra text.`,
        prompt: message
      })

      const cleaned = text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")

      try {
        const parsed = JSON.parse(cleaned)
        return transactionsSchema.parse(parsed)
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/)
        if (!match) return { items: [] }
        const parsed = JSON.parse(match[0])
        return transactionsSchema.parse(parsed)
      }
    }
  }
}

export type AiService = ReturnType<typeof createAiService>
