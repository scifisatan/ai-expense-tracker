import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  TOKEN: z.string().nonempty(),
  URL: z.string().optional(),
  PORT: z.string().optional(),
  GROQ_TOKEN: z.string().optional(),
});

const parsed = EnvSchema.parse(process.env);

export const BOT_TOKEN = parsed.TOKEN;
export const PUBLIC_URL = parsed.URL;
export const PORT = Number(parsed.PORT ?? 3001);
export const GROQ_TOKEN = parsed.GROQ_TOKEN;
