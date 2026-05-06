import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import { z } from 'zod';
import { AI_MODEL, GROQ_TOKEN } from '../config/env';
import type { ModelConfigService } from './model-config';
import { log } from '../config/logger';

const groq = createGroq({
  apiKey: GROQ_TOKEN,
});

const transactionItemSchema = z.object({
  amount: z.number().int().describe('Transaction amount as positive integer'),
  type: z.enum(['Expense', 'Deposit']).describe('Money flow direction'),
});

const transactionsSchema = z.object({
  items: z
    .array(transactionItemSchema)
    .describe('List of all transactions mentioned; empty if none'),
});

export type TransactionItem = z.infer<typeof transactionItemSchema>;
export type TransactionsExtraction = z.infer<typeof transactionsSchema>;

export const createAIService = (options?: {
  model?: string;
  modelConfig?: Pick<ModelConfigService, 'getCurrentModel'>;
}) => {
  return {
    async extractTransactions(
      message: string
    ): Promise<TransactionsExtraction> {
      const selectedModel =
        options?.model ??
        options?.modelConfig?.getCurrentModel() ??
        AI_MODEL ??
        'meta-llama/llama-4-scout-17b-16e-instruct';

      const model: any = groq(selectedModel);
      if (!GROQ_TOKEN) {
        throw new Error('Missing GROQ_TOKEN in environment variables.');
      }

      log.debug('ai.extractTransactions.model', selectedModel);
      log.debug('ai.extractTransactions.prompt', message);

      const { text } = await generateText({
        model,
        prompt: `Extract every monetary transaction mentioned in the message.

Message: "${message}"

Return ONLY valid JSON with this exact shape:
{"items":[{"amount":123,"type":"Expense"}]}

Rules:
- amount must be an integer (no decimals, strip currency symbols).
- type must be either "Expense" or "Deposit".
- If no clear amounts are found, return: {"items":[]}
- Do not include markdown, backticks, or extra text.`,
      });

      const cleaned = text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '');

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
