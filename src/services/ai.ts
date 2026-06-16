import { generateObject } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { TransactionsExtraction, transactionsSchema } from "@/shared/types"
import { log } from "@/utils/logger"

const SYSTEM_PROMPT = `Extract every monetary transaction mentioned in the message.

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
- Do not include markdown, backticks, or extra text.`

export const createAiService = (options: {
  model: string
  ai: Ai
  groqApiKey: string
}) => {
  return {
    async extractTransactions(message: string): Promise<TransactionsExtraction> {
      const groq = createGroq({ apiKey: options.groqApiKey })
      const model = groq(options.model)

      log.ai.debug("ai.extractTransactions.model", options.model)
      log.ai.debug("ai.extractTransactions.prompt", message)

      try {
        const { object } = await generateObject({
          model,
          schema: transactionsSchema,
          system: SYSTEM_PROMPT,
          prompt: message,
        })

        return object
      } catch (error) {
        log.ai.error("ai.extractTransactions.failed", error)
        throw error
      }
    },
  }
}

export type AiService = ReturnType<typeof createAiService>
