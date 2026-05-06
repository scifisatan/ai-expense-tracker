import TelegramBot from 'node-telegram-bot-api';
import createAIService from '../services/ai';
import { log } from '../config/logger';
import { computeTotals } from './transactions';
import { createBalanceService } from './balance';
import { createTelegramService } from '../services/telegram';
import { createModelConfigService } from '../services/model-config';

const MODELS_PAGE_SIZE = 6;

type ChatPrefs = {
  currency: 'rs' | 'inr';
  verbose: boolean;
  keyboardHidden: boolean;
};

const chatPrefs = new Map<number, ChatPrefs>();

const getPrefs = (chatId: number): ChatPrefs => {
  const existing = chatPrefs.get(chatId);
  if (existing) return existing;

  const next: ChatPrefs = {
    currency: 'rs',
    verbose: true,
    keyboardHidden: false,
  };
  chatPrefs.set(chatId, next);
  return next;
};

const shorten = (text: string, max = 48) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

const formatMoney = (chatId: number, value: number) => {
  const { currency } = getPrefs(chatId);
  return currency === 'inr' ? `₹${value}` : `Rs. ${value}`;
};

const getMainMenu = (): TelegramBot.InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      { text: '💰 Show Balance', callback_data: 'ui:balance' },
      { text: '🤖 AI Model', callback_data: 'ui:models' },
    ],
    [
      { text: '⚙️ Settings', callback_data: 'ui:settings' },
      { text: 'ℹ️ Help', callback_data: 'ui:help' },
    ],
  ],
});

const getChatKeyboard = (): TelegramBot.ReplyKeyboardMarkup => ({
  keyboard: [
    [{ text: '💰 Balance' }, { text: '🤖 Models' }],
    [{ text: '⚙️ Settings' }, { text: 'ℹ️ Help' }],
    [{ text: '🙈 Hide Keyboard' }, { text: '/start' }],
  ],
  resize_keyboard: true,
  is_persistent: true,
});

const buildSettingsMenu = (
  prefs: ChatPrefs
): { text: string; replyMarkup: TelegramBot.InlineKeyboardMarkup } => {
  const currencyLabel = prefs.currency === 'inr' ? '₹' : 'Rs.';

  return {
    text: [
      '⚙️ Settings',
      `• Currency: ${currencyLabel}`,
      `• Verbose confirmations: ${prefs.verbose ? 'On' : 'Off'}`,
      '',
      'Use buttons to update preferences.',
    ].join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: prefs.verbose ? '🔕 Set concise responses' : '🗣️ Set detailed responses',
            callback_data: 'settings:toggle-verbose',
          },
        ],
        [
          {
            text: `${prefs.currency === 'rs' ? '✅ ' : ''}Rs. format`,
            callback_data: 'settings:currency:rs',
          },
          {
            text: `${prefs.currency === 'inr' ? '✅ ' : ''}₹ format`,
            callback_data: 'settings:currency:inr',
          },
        ],
        [
          { text: '⌨️ Show Keyboard', callback_data: 'settings:show-keyboard' },
          { text: '🙈 Hide Keyboard', callback_data: 'settings:hide-keyboard' },
        ],
        [{ text: '🏠 Back to menu', callback_data: 'ui:menu' }],
      ],
    },
  };
};

const buildModelsMenu = (
  models: string[],
  currentModel: string,
  page: number
): { text: string; replyMarkup: TelegramBot.InlineKeyboardMarkup } => {
  const totalPages = Math.max(1, Math.ceil(models.length / MODELS_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const start = safePage * MODELS_PAGE_SIZE;
  const pageModels = models.slice(start, start + MODELS_PAGE_SIZE);

  const inline_keyboard: TelegramBot.InlineKeyboardButton[][] = pageModels.map(
    (id) => [
      {
        text: id === currentModel ? `✅ ${shorten(id)}` : shorten(id),
        callback_data: `models:set:${id}`,
      },
    ]
  );

  const navRow: TelegramBot.InlineKeyboardButton[] = [];
  if (safePage > 0) {
    navRow.push({ text: '⬅️ Prev', callback_data: `models:page:${safePage - 1}` });
  }
  navRow.push({
    text: `Page ${safePage + 1}/${totalPages}`,
    callback_data: 'models:noop',
  });
  if (safePage < totalPages - 1) {
    navRow.push({ text: 'Next ➡️', callback_data: `models:page:${safePage + 1}` });
  }

  inline_keyboard.push(navRow);
  inline_keyboard.push([
    { text: '🔄 Refresh', callback_data: 'models:refresh' },
    { text: '🏠 Menu', callback_data: 'ui:menu' },
  ]);

  return {
    text: [
      'Structured-output models (Groq)',
      `Current: ${currentModel}`,
      '',
      'Tap a model to switch.',
    ].join('\n'),
    replyMarkup: { inline_keyboard },
  };
};

export const registerHandlers = (bot: TelegramBot) => {
  const modelConfig = createModelConfigService();
  const ai = createAIService({ modelConfig });
  const telegram = createTelegramService(bot);
  const balanceService = createBalanceService(bot);

  const maybeChatKeyboard = (
    chatId: number
  ): TelegramBot.ReplyKeyboardMarkup | undefined => {
    return getPrefs(chatId).keyboardHidden ? undefined : getChatKeyboard();
  };

  const hideKeyboard = async (chatId: number) => {
    getPrefs(chatId).keyboardHidden = true;
    await telegram.sendMessage(
      chatId,
      'Keyboard hidden. Use /menu or /showkeyboard to bring it back.',
      { reply_markup: { remove_keyboard: true } }
    );
  };

  const showKeyboard = async (chatId: number) => {
    getPrefs(chatId).keyboardHidden = false;
    await telegram.sendMessage(chatId, 'Keyboard shortcuts enabled ⌨️', {
      reply_markup: getChatKeyboard(),
    });
  };

  const sendHelp = async (chatId: number) => {
    await telegram.sendMessage(
      chatId,
      [
        '👋 *Budget Bot Help*',
        '',
        '• Send messages like `Paid 200`, `Got 500`, `Spent 120 and 80`',
        '• I extract transactions and update pinned balance automatically.',
        '',
        '*Commands*',
        '`/start` Initialize and pin balance',
        '`/balance` Show current balance',
        '`/models` Choose AI model (structured output only)',
        '`/settings` Configure behavior',
        '`/hidekeyboard` or `/showkeyboard`',
      ].join('\n'),
      {
        parse_mode: 'Markdown',
        reply_markup: maybeChatKeyboard(chatId),
      }
    );
  };

  const sendBalance = async (chatId: number) => {
    const { balance } = await balanceService.getPinnedBalance(chatId);
    if (balance === null) {
      await telegram.sendMessage(
        chatId,
        'I cannot find a pinned balance yet. Use /start to initialize it.',
        { reply_markup: maybeChatKeyboard(chatId) }
      );
      return;
    }

    await telegram.sendMessage(chatId, `💰 Current Balance: ${formatMoney(chatId, balance)}`, {
      reply_markup: maybeChatKeyboard(chatId),
    });
  };

  const renderSettingsMenu = async (chatId: number, messageId?: number) => {
    const { text, replyMarkup } = buildSettingsMenu(getPrefs(chatId));

    if (!messageId) {
      await telegram.sendMessage(chatId, text, { reply_markup: replyMarkup });
      return;
    }

    await telegram.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    });
  };

  const renderModelsMenu = async (
    chatId: number,
    messageId?: number,
    page = 0,
    forceRefresh = false
  ) => {
    const models = await modelConfig.listStructuredOutputModels(forceRefresh);
    const currentModel = modelConfig.getCurrentModel();
    const { text, replyMarkup } = buildModelsMenu(models, currentModel, page);

    if (!messageId) {
      await telegram.sendMessage(chatId, text, { reply_markup: replyMarkup });
      return;
    }

    await telegram.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    });
  };

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      getPrefs(chatId).keyboardHidden = false;
      await balanceService.sendAndPinBalance(chatId, 0);
      await telegram.sendMessage(
        chatId,
        '✅ Budget tracking is active. I pinned the initial balance at Rs. 0.',
        { reply_markup: getChatKeyboard() }
      );
    } catch (e) {
      console.error('[start-balance-error]', e);
      await telegram.sendMessage(chatId, 'Failed to initialize. Please try /start again.');
    }
  });

  bot.onText(/\/help(?:@[\w_]+)?$/, async (msg) => sendHelp(msg.chat.id));
  bot.onText(/\/menu(?:@[\w_]+)?$/, async (msg) => {
    await telegram.sendMessage(msg.chat.id, 'Quick actions:', {
      reply_markup: getMainMenu(),
    });
    await showKeyboard(msg.chat.id);
  });
  bot.onText(/\/balance(?:@[\w_]+)?$/, async (msg) => sendBalance(msg.chat.id));
  bot.onText(/\/settings(?:@[\w_]+)?$/, async (msg) =>
    renderSettingsMenu(msg.chat.id)
  );
  bot.onText(/\/hidekeyboard(?:@[\w_]+)?$/, async (msg) =>
    hideKeyboard(msg.chat.id)
  );
  bot.onText(/\/showkeyboard(?:@[\w_]+)?$/, async (msg) =>
    showKeyboard(msg.chat.id)
  );

  bot.onText(/^💰\s*Balance$/i, async (msg) => sendBalance(msg.chat.id));
  bot.onText(/^🤖\s*Models$/i, async (msg) => {
    try {
      await renderModelsMenu(msg.chat.id);
    } catch (e) {
      log.error('[models-list-error]', e);
      await telegram.sendMessage(
        msg.chat.id,
        'Failed to fetch structured-output models from Groq.'
      );
    }
  });
  bot.onText(/^⚙️\s*Settings$/i, async (msg) =>
    renderSettingsMenu(msg.chat.id)
  );
  bot.onText(/^ℹ️\s*Help$/i, async (msg) => sendHelp(msg.chat.id));
  bot.onText(/^🙈\s*Hide Keyboard$/i, async (msg) => hideKeyboard(msg.chat.id));

  bot.onText(/\/models(?:@[\w_]+)?$/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      await telegram.sendChatAction(chatId, 'typing');
      await renderModelsMenu(chatId);
    } catch (e) {
      log.error('[models-list-error]', e);
      await telegram.sendMessage(
        chatId,
        'Failed to fetch structured-output models from Groq.'
      );
    }
  });

  bot.onText(/\/model(?:@[\w_]+)?(?:\s+(.+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const requestedModel = (match?.[1] ?? '').trim();

    if (!requestedModel) {
      await renderModelsMenu(chatId);
      return;
    }

    try {
      const result = await modelConfig.setCurrentModel(requestedModel);
      if (!result.ok) {
        await telegram.sendMessage(
          chatId,
          `Model is not in structured-output list: ${requestedModel}\nUse /models and pick one from the buttons.`
        );
        return;
      }

      await telegram.sendMessage(
        chatId,
        `✅ Model updated to: ${result.currentModel}`,
        { reply_markup: maybeChatKeyboard(chatId) }
      );
    } catch (e) {
      log.error('[model-set-error]', e);
      await telegram.sendMessage(chatId, 'Failed to update model.');
    }
  });

  bot.on('callback_query', async (query) => {
    const data = query.data;
    const chatId = query.message?.chat.id;
    const messageId = query.message?.message_id;

    if (!data || !chatId || !messageId) return;

    try {
      if (data.startsWith('ui:')) {
        if (data === 'ui:menu') {
          await telegram.answerCallbackQuery(query.id);
          await telegram.editMessageText('Quick actions:', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: getMainMenu(),
          });
          return;
        }

        if (data === 'ui:help') {
          await telegram.answerCallbackQuery(query.id);
          await sendHelp(chatId);
          return;
        }

        if (data === 'ui:balance') {
          await telegram.answerCallbackQuery(query.id);
          await sendBalance(chatId);
          return;
        }

        if (data === 'ui:models') {
          await telegram.answerCallbackQuery(query.id);
          await renderModelsMenu(chatId, messageId);
          return;
        }

        if (data === 'ui:settings') {
          await telegram.answerCallbackQuery(query.id);
          await renderSettingsMenu(chatId, messageId);
          return;
        }
      }

      if (data.startsWith('settings:')) {
        if (data === 'settings:toggle-verbose') {
          const prefs = getPrefs(chatId);
          prefs.verbose = !prefs.verbose;
          await telegram.answerCallbackQuery(query.id, {
            text: `Verbose ${prefs.verbose ? 'enabled' : 'disabled'}`,
          });
          await renderSettingsMenu(chatId, messageId);
          return;
        }

        if (data === 'settings:currency:rs' || data === 'settings:currency:inr') {
          const prefs = getPrefs(chatId);
          prefs.currency = data.endsWith(':inr') ? 'inr' : 'rs';
          await telegram.answerCallbackQuery(query.id, {
            text: `Currency set to ${prefs.currency === 'inr' ? '₹' : 'Rs.'}`,
          });
          await renderSettingsMenu(chatId, messageId);
          return;
        }

        if (data === 'settings:hide-keyboard') {
          await telegram.answerCallbackQuery(query.id, { text: 'Keyboard hidden' });
          await hideKeyboard(chatId);
          await renderSettingsMenu(chatId, messageId);
          return;
        }

        if (data === 'settings:show-keyboard') {
          await telegram.answerCallbackQuery(query.id, { text: 'Keyboard shown' });
          await showKeyboard(chatId);
          await renderSettingsMenu(chatId, messageId);
          return;
        }
      }

      if (!data.startsWith('models:')) return;

      if (data === 'models:noop') {
        await telegram.answerCallbackQuery(query.id);
        return;
      }

      if (data === 'models:refresh') {
        await telegram.answerCallbackQuery(query.id, {
          text: 'Refreshing model list...',
        });
        await renderModelsMenu(chatId, messageId, 0, true);
        return;
      }

      if (data.startsWith('models:page:')) {
        const page = Number(data.split(':')[2] ?? '0');
        await telegram.answerCallbackQuery(query.id);
        await renderModelsMenu(chatId, messageId, Number.isNaN(page) ? 0 : page);
        return;
      }

      if (data.startsWith('models:set:')) {
        const modelId = data.slice('models:set:'.length);
        const result = await modelConfig.setCurrentModel(modelId);

        if (!result.ok) {
          await telegram.answerCallbackQuery(query.id, {
            text: 'Model unavailable for structured output',
            show_alert: true,
          });
          await renderModelsMenu(chatId, messageId, 0, true);
          return;
        }

        await telegram.answerCallbackQuery(query.id, { text: `Using ${modelId}` });
        await renderModelsMenu(chatId, messageId);
      }
    } catch (e) {
      log.error('[models-callback-error]', e);
      await telegram.answerCallbackQuery(query.id, {
        text: 'Failed to handle action',
        show_alert: true,
      });
    }
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    if (msg.pinned_message) {
      try {
        await telegram.deleteMessage(chatId, msg.message_id);
      } catch {
        // Ignore if we can't delete
      }
      return;
    }

    if (msg.from?.is_bot) return;

    const text = (msg.text ?? msg.caption ?? '').trim();
    if (!text) return;
    if (text.startsWith('/')) return;

    if (
      /^💰\s*Balance$/i.test(text) ||
      /^🤖\s*Models$/i.test(text) ||
      /^⚙️\s*Settings$/i.test(text) ||
      /^ℹ️\s*Help$/i.test(text) ||
      /^🙈\s*Hide Keyboard$/i.test(text)
    ) {
      return;
    }

    try {
      const start = Date.now();
      await telegram.sendChatAction(chatId, 'typing');
      log.debug('[extract-input]', text);
      const extracted = await ai.extractTransactions(text);
      const duration = Date.now() - start;
      log.debug('[extract-output]', extracted, `(${duration}ms)`);

      if (!extracted.items.length) return;

      const { net } = computeTotals(extracted.items);
      const { balance: currentBalance } =
        await balanceService.getPinnedBalance(chatId);

      if (currentBalance === null) {
        log.debug('[balance-skip] no pinned balance; ignoring message');
        await telegram.sendMessage(
          chatId,
          'I found transactions, but there is no pinned balance yet. Use /start first.'
        );
        return;
      }

      const newBalance = currentBalance + net;

      try {
        const pinnedMessageId = await balanceService.sendAndPinBalance(
          chatId,
          newBalance
        );
        log.info(
          '[balance] prev=',
          currentBalance,
          'new=',
          newBalance,
          'net=',
          net,
          'pinnedMessageId=',
          pinnedMessageId
        );

        if (getPrefs(chatId).verbose) {
          await telegram.sendMessage(
            chatId,
            `✅ Recorded ${extracted.items.length} transaction(s)\nNet change: ${net >= 0 ? '+' : ''}${formatMoney(chatId, net)}\nNew balance: ${formatMoney(chatId, newBalance)}`,
            { reply_markup: maybeChatKeyboard(chatId) }
          );
        } else {
          await telegram.sendMessage(chatId, `✅ ${formatMoney(chatId, newBalance)}`, {
            reply_markup: maybeChatKeyboard(chatId),
          });
        }
      } catch (e) {
        console.error('[balance-pin-error]', e);
      }
    } catch (err) {
      log.error('[extract-error]', err);
    }
  });
};
