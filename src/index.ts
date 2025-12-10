import { Elysia } from 'elysia';
import type { Update } from 'node-telegram-bot-api';
import { bot } from './bot';
import { BOT_TOKEN, PUBLIC_URL, PORT } from './config/env';

const app = new Elysia();

const webhookPath = `/bot${BOT_TOKEN}`;

app.get('/', () => 'Budget bot is running.');

app.post(webhookPath, ({ body }) => {
  bot.processUpdate(body as Update);
  return 'ok';
});

app.listen(PORT, async () => {
  console.log('Public URL', PUBLIC_URL);
  if (PUBLIC_URL) {
    await bot.setWebHook(`${PUBLIC_URL}${webhookPath}`);
    console.log('Webhook is set up');
  }
  console.log(`Bot is listening on port ${PORT}`);
});

export default app;
