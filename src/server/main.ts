import createApp from "@/server/app";
import { BOT_TOKEN, PUBLIC_URL, PORT } from "@/config/env";
import { bot } from "@/bot";

const ensureWebhook = async (webhookUrl: string) => {
  try {
    const info = await bot.getWebHookInfo();
    if (info.url === webhookUrl) {
      return;
    }
  } catch (e) {
    console.error("[webhook-info-error]", e);
  }

  try {
    await bot.setWebHook(webhookUrl);
  } catch (e: any) {
    const retryAfter = e?.response?.headers?.["retry-after"];
    console.error("[webhook-set-error]", e?.message || e);
    if (retryAfter) {
      const delayMs = Number(retryAfter) * 1000;
      console.log(`Retrying setWebHook after ${retryAfter}s`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await bot.setWebHook(webhookUrl);
    } else {
      throw e;
    }
  }
};

(async function main() {
  const port = PORT || 3001;
  const app = createApp();
  app.listen(port, async () => {
    if (!PUBLIC_URL) {
      console.error(
        "[webhook-error] PUBLIC_URL is missing; cannot set webhook. Set URL env var."
      );
      return;
    }

    const webhookUrl = `${PUBLIC_URL}/bot${BOT_TOKEN}`;
    await ensureWebhook(webhookUrl);
    console.log(`bot is listening on port ${port}`);
  });
})();
