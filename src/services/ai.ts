import { createGroq } from '@ai-sdk/groq';
import { generateObject } from 'ai';
import { z } from 'zod';
import { GROQ_TOKEN } from '../config/env';
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

export const createAIService = (options?: { model?: string }) => {
  const model: any = groq(options?.model ?? 'moonshotai/kimi-k2-instruct-0905');

  return {
    async extractTransactions(
      message: string
    ): Promise<TransactionsExtraction> {
      if (!GROQ_TOKEN) {
        throw new Error('Missing GROQ_TOKEN in environment variables.');
      }

      log.debug('ai.extractTransactions.prompt', message);

      // NOTE: cast `generateObject` to `any` to avoid TypeScript's deep type
      // instantiation error caused by complex generic inference with the
      // `ai` package and Zod schemas. We then cast the result to the
      // concrete `TransactionsExtraction` type to preserve type safety.
      const { object } = (await (generateObject as any)({
        model,
        schema: transactionsSchema,
        prompt: `Extract every monetary transaction mentioned in the message.

Message: "${message}"

Return an array of items. For each item:
- amount: integer (no decimals, strip currency symbols)
- type: "Expense" if money flows out / spending / paying; "Deposit" if money flows in / receiving.

If there are multiple amounts, include all of them. If no clear amounts, return items: [].`,
      })) as unknown as { object: TransactionsExtraction };

      return object;
    },
  };
};

export default createAIService;
