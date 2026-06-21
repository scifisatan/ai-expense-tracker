import { generateObject } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { TransactionsExtraction, transactionsSchema } from "@/shared/types"
import { log } from "@/utils/logger"

const buildSystemPrompt = (today: string): string => `Extract every monetary transaction mentioned in the message.

Today's date is ${today} (ISO YYYY-MM-DD).

Return ONLY valid JSON with this exact shape:
{"items":[{"amount":12.50,"type":"Expense","note":"coffee","category":"Food","occurredAt":"${today}"}]}

Rules:
- amount must be a positive number; decimals are allowed (strip currency symbols).
- type must be either "Expense" or "Income".
- note must describe the specific transaction amount it appears next to or on the same line as.
- category is OPTIONAL: a short label like "Food", "Transport", "Shopping", "Bills", "Salary". Omit if unsure.
- occurredAt is OPTIONAL: include it as YYYY-MM-DD ONLY when the message references a date
  (e.g. "yesterday", "last Friday", "on the 3rd"); resolve it relative to today's date above.
  OMIT occurredAt entirely when no date is mentioned.
- Associate descriptive text with the closest relevant amount.
- If no clear note is associated, use an empty string.
- If no clear amounts are found, return: {"items":[]}
- Do not include markdown, backticks, or extra text.`

export const createAiService = (options: {
  model: string
  groqApiKey: string
}) => {
  return {
    async extractTransactions(message: string, today: string): Promise<TransactionsExtraction> {
      const groq = createGroq({ apiKey: options.groqApiKey })
      const model = groq(options.model)
      const system = buildSystemPrompt(today)

      log.ai.debug("ai.extractTransactions.model", options.model)
      log.ai.debug("ai.extractTransactions.prompt", message)

      // The model intermittently emits JSON that fails the schema (or fails JSON
      // mode outright). These failures are stochastic, so simply re-sampling clears
      // most of them — try up to MAX_ATTEMPTS times before giving up.
      const MAX_ATTEMPTS = 3
      let lastError: unknown
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const { object } = await generateObject({
            model,
            schema: transactionsSchema,
            system,
            prompt: message,
          })

          if (attempt > 1) {
            log.ai.debug("ai.extractTransactions.recovered", `attempt ${attempt}/${MAX_ATTEMPTS}`)
          }
          return object
        } catch (error) {
          lastError = error
          log.ai.warn(
            "ai.extractTransactions.attempt_failed",
            `attempt ${attempt}/${MAX_ATTEMPTS}`,
            error instanceof Error ? error.message : error,
          )
        }
      }

      log.ai.error("ai.extractTransactions.failed", lastError)
      throw lastError
    },
  }
}

export type AiService = ReturnType<typeof createAiService>
