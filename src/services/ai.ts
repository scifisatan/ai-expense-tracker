import { generateObject } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { TransactionsExtraction, transactionsSchema } from "@/shared/types"
import { log } from "@/utils/logger"

const buildCategoryRule = (categories: { expense: string[]; income: string[] }): string => {
  const lines = ["- category is OPTIONAL."]
  if (categories.expense.length) {
    lines.push(`  For Expense items choose ONLY from: ${categories.expense.join(", ")}.`)
  } else {
    lines.push("  OMIT category for Expense items.")
  }
  if (categories.income.length) {
    lines.push(`  For Income items choose ONLY from: ${categories.income.join(", ")}.`)
  } else {
    lines.push("  OMIT category for Income items.")
  }
  lines.push("  Copy the name exactly as written. If none fits, OMIT category.")
  return lines.join("\n")
}

const buildSystemPrompt = (
  today: string,
  categories: { expense: string[]; income: string[] },
): string => `Extract every monetary transaction mentioned in the message.

Today's date is ${today} (ISO YYYY-MM-DD).

Return ONLY valid JSON with this exact shape:
{"items":[{"amount":12.50,"type":"Expense","note":"coffee","category":"Food","occurredAt":"${today}"}]}

Rules:
- amount must be a positive number; decimals are allowed (strip currency symbols).
- type must be either "Expense" or "Income".
- note must describe the specific transaction amount it appears next to or on the same line as.
${buildCategoryRule(categories)}
- occurredAt is OPTIONAL: include it as YYYY-MM-DD ONLY when the message references a date
  (e.g. "yesterday", "last Friday", "on the 3rd"); resolve it relative to today's date above.
  OMIT occurredAt entirely when no date is mentioned.
- Associate descriptive text with the closest relevant amount.
- If no clear note is associated, use an empty string.
- If no clear amounts are found, return: {"items":[]}
- Do not include markdown, backticks, or extra text.`

const parseHeuristicTransactions = (
  message: string,
  today: string,
  categories: { expense: string[]; income: string[] }
): TransactionsExtraction => {
  const text = message.trim()
  if (!text) return { items: [] }

  const lines = text.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean)
  const items: TransactionsExtraction["items"] = []

  for (const line of lines) {
    // Look for numbers like 150, 15.50, $20, 20$, 500rs, etc.
    const numMatch = line.match(/(?:^|[^\d.])(?:[$€£¥₹Rs.]*\s*)(\d+(?:\.\d{1,2})?)(?:\s*[$€£¥₹Rs.]*)?(?:[^\d.]|$)/i)
    if (!numMatch || !numMatch[1]) continue

    const amount = Number(numMatch[1])
    if (!Number.isFinite(amount) || amount <= 0) continue

    // Extract note by removing the number
    let note = line.replace(numMatch[1], "").replace(/[$€£¥₹Rs.]/g, "").trim()
    note = note.replace(/^(spent|paid|bought|got|received|income|expense|for|on)\s+/i, "").trim()
    note = note.replace(/\s+(yesterday|today|last night)$/i, "").trim()
    if (!note) note = "Quick Entry"

    const isIncome = /\b(salary|income|received|paycheck|dividend|bonus|freelance|client|sold)\b/i.test(line)
    const type: "Income" | "Expense" = isIncome ? "Income" : "Expense"

    const pool = type === "Income" ? categories.income : categories.expense
    const matchedCategory = pool.find((cat) => note.toLowerCase().includes(cat.toLowerCase()))

    let occurredAt: string | undefined = undefined
    if (/\byesterday\b/i.test(line)) {
      const d = new Date(today)
      d.setDate(d.getDate() - 1)
      occurredAt = d.toISOString().slice(0, 10)
    }

    items.push({
      amount,
      type,
      note,
      category: matchedCategory,
      occurredAt
    })
  }

  return { items }
}

export const createAiService = (options: {
  model: string
  groqApiKey: string
}) => {
  return {
    async extractTransactions(
      message: string,
      today: string,
      categories: { expense: string[]; income: string[] },
    ): Promise<TransactionsExtraction> {
      if (!options.groqApiKey) {
        log.ai.debug("ai.extractTransactions.fallback_heuristic", "no apiKey provided")
        return parseHeuristicTransactions(message, today, categories)
      }

      const groq = createGroq({ apiKey: options.groqApiKey })
      const model = groq(options.model || "llama-3.3-70b-versatile")
      const system = buildSystemPrompt(today, categories)

      log.ai.debug("ai.extractTransactions.model", options.model)
      log.ai.debug("ai.extractTransactions.prompt", message)

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

      log.ai.warn("ai.extractTransactions.falling_back_to_heuristic", lastError)
      const fallbackResult = parseHeuristicTransactions(message, today, categories)
      if (fallbackResult.items.length > 0) {
        return fallbackResult
      }
      throw lastError
    },
  }
}

export type AiService = ReturnType<typeof createAiService>
