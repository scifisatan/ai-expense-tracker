import { createGroq } from "@ai-sdk/groq";
import { generateText } from "ai";
import { z } from "zod";
import { log } from "../../utils/logger";

const transactionItemSchema = z.object({
  amount: z.number().int().describe("Transaction amount as positive integer"),
  type: z.enum(["Expense", "Income"]).describe("Money flow direction"),
  note: z.string().describe("Note related to the transaction"),
});

const transactionsSchema = z.object({
  items: z
    .array(transactionItemSchema)
    .describe("List of all transactions mentioned; empty if none"),
});

export type TransactionItem = z.infer<typeof transactionItemSchema>;
export type TransactionsExtraction = z.infer<typeof transactionsSchema>;

export const createAIService = (options: { model: string }) => {
  return {
    async extractTransactions(message: string, groqToken: string): Promise<TransactionsExtraction> {
      const groq = createGroq({ apiKey: groqToken });

      log.debug("ai.extractTransactions.model", options.model);
      log.debug("ai.extractTransactions.prompt", message);

      const { text } = await generateText({
        model: groq(options.model) as any,
        system: `Extract every monetary transaction mentioned in the message.

Return ONLY valid JSON with this exact shape:
{"items":[{"amount":123,"type":"Expense","note":"coffee"}]}

Rules:
- amount must be an integer (no decimals, strip currency symbols).
- type must be either "Expense" or "Income".
- note must describe the specific transaction amount it appears next to or on the same line as.
- Associate descriptive text with the closest relevant amount.
- If no clear note is associated, use an empty string.
- If no clear amounts are found, return: {"items":[]}
- Do not include markdown, backticks, or extra text.`,
        prompt: message,
      });

      const cleaned = text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");

      try {
        const parsed = JSON.parse(cleaned);
        return transactionsSchema.parse(parsed);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) return { items: [] };
        const parsed = JSON.parse(match[0]);
        return transactionsSchema.parse(parsed);
      }
    },
  };
};

export default createAIService;
