import { TEXT } from './config.js';
import {
  getMainKeyboard,
  getDateSelectionWithBackKeyboard,
  getStatsKeyboard,
  getBackKeyboard,
  parseUserDate,
} from './keyboards.js';
import { getCoffeeSales, getSalesAnalyticsStat, getSalesAnalyticsRange } from './poster_api.js';
import { DOUBLE_GRINDER } from './config.js';

// Храним ID последних сообщений и состояния для каждого чата
const userStates = new Map();

export function setupMainHandlers(bot) {
  // Обработчик команды /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    const userState = userStates.get(chatId) || {};
    if (userState.lastMessageId) {
      try {
        await bot.deleteMessage(chatId, userState.lastMessageId);
      } catch (error) {}
    }

    const sentMessage = await bot.sendMessage(chatId, TEXT.WELCOME, getMainKeyboard());

    userStates.set(chatId, {
      lastMessageId: sentMessage.message_id,
      waitingForDate: false,
    });
  });

  // Обработчик inline-кнопок
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    const userState = userStates.get(chatId) || {};

    try {
      if (data === 'grinder_check') {
        await bot.editMessageText(TEXT.GRINDER_PAGE, {
          chat_id: chatId,
          message_id: messageId,
          ...getDateSelectionWithBackKeyboard(),
        });

        userState.lastMessageId = messageId;
        userState.waitingForDate = false;
        userState.currentMode = 'grinder';
        userStates.set(chatId, userState);
      } else if (data.startsWith('date_')) {
        const date = data.replace('date_', '');

        if (userState.currentMode === 'sales') {
          await showSalesAnalytics(bot, chatId, messageId, date, userState);
        } else {
          await showCoffeeSales(bot, chatId, messageId, date, userState);
        }
      } else if (data.startsWith('refresh_')) {
        const date = data.replace('refresh_', '');

        if (userState.currentMode === 'sales') {
          await showSalesAnalytics(bot, chatId, messageId, date, userState);
        } else {
          await showCoffeeSales(bot, chatId, messageId, date, userState);
        }
      } else if (data === 'input_date') {
        await bot.editMessageText(TEXT.INPUT_DATE, {
          chat_id: chatId,
          message_id: messageId,
          ...getBackKeyboard(),
        });

        userState.lastMessageId = messageId;
        userState.waitingForDate = true;
        userStates.set(chatId, userState);
      } else if (data === 'back_to_main') {
        await bot.editMessageText(TEXT.WELCOME, {
          chat_id: chatId,
          message_id: messageId,
          ...getMainKeyboard(),
        });

        userState.lastMessageId = messageId;
        userState.waitingForDate = false;
        userState.currentMode = null;
        userStates.set(chatId, userState);
      } else if (data === 'sales_stats') {
        await bot.editMessageText(TEXT.SALES_PAGE, {
          chat_id: chatId,
          message_id: messageId,
          ...getDateSelectionWithBackKeyboard('sales'),
        });

        userState.lastMessageId = messageId;
        userState.waitingForDate = false;
        userState.currentMode = 'sales';
        userStates.set(chatId, userState);
      }

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error('Ошибка при обработке callback:', error);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Произошла ошибка' });
    }
  });

  // Обработчик текстовых сообщений для ввода даты или диапазона
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userState = userStates.get(chatId) || {};

    if (text === '/start') {
      return;
    }

    if (userState.waitingForDate && text && text !== TEXT.WELCOME) {
      // Проверяем: диапазон ли это
      if (text.includes('-') && userState.currentMode === 'sales') {
        const parts = text.split('-').map((p) => p.trim());
        if (parts.length === 2) {
          const startDate = parseUserDate(parts[0]);
          const endDate = parseUserDate(parts[1]);

          if (startDate && endDate) {
            try {
              if (userState.lastMessageId) {
                await bot.deleteMessage(chatId, userState.lastMessageId);
              }
            } catch (error) {}

            const sentMessage = await bot.sendMessage(chatId, '⏳ Загружаю данные за период...');

            await showSalesAnalyticsRange(
              bot,
              chatId,
              sentMessage.message_id,
              startDate,
              endDate,
              userState,
            );
            return;
          }
        }

        await bot.sendMessage(
          chatId,
          '❌ Неверный формат диапазона. Введите так: ДД.ММ.ГГГГ - ДД.ММ.ГГГГ (например: 20.09.2025 - 24.09.2025)',
        );
        return;
      }

      // Обычная одиночная дата
      const parsedDate = parseUserDate(text);

      if (parsedDate) {
        try {
          if (userState.lastMessageId) {
            await bot.deleteMessage(chatId, userState.lastMessageId);
          }
        } catch (error) {}

        const sentMessage = await bot.sendMessage(chatId, '⏳ Загружаю данные...');

        if (userState.currentMode === 'sales') {
          await showSalesAnalytics(bot, chatId, sentMessage.message_id, parsedDate, userState);
        } else {
          await showCoffeeSales(bot, chatId, sentMessage.message_id, parsedDate, userState);
        }
      } else {
        await bot.sendMessage(
          chatId,
          '❌ Неверный формат даты. Введите в формате ДД.ММ.ГГГГ (например: 07.09.2024)',
        );
      }
      return;
    }

    if (text === TEXT.WELCOME) {
      if (userState.lastMessageId) {
        try {
          await bot.deleteMessage(chatId, userState.lastMessageId);
        } catch (error) {}
      }

      const sentMessage = await bot.sendMessage(chatId, TEXT.WELCOME, getMainKeyboard());

      userState.lastMessageId = sentMessage.message_id;
      userState.waitingForDate = false;
      userState.currentMode = null;
      userStates.set(chatId, userState);
    }
  });
}

// Функция показа статистики продаж (кофе)
async function showCoffeeSales(bot, chatId, messageId, date, userState) {
  try {
    await bot.editMessageText('⏳ Загружаю актуальные данные...', {
      chat_id: chatId,
      message_id: messageId,
    });

    const { sales, date: salesDate } = await getCoffeeSales(date);

    const displayDate = salesDate
      ? `${salesDate.slice(6, 8)}.${salesDate.slice(4, 6)}.${salesDate.slice(0, 4)}`
      : 'неизвестную дату';

    let message = `📊 Продажи кофейных напитков за ${displayDate}:\n\n`;

    if (sales.length > 0) {
      let totalCount = 0;
      let grinderCount = 0;

      sales.forEach((item) => {
        const itemCount = parseInt(item.count) || 0;
        totalCount += itemCount;

        const isDoublePortion = DOUBLE_GRINDER.some((doubleProduct) =>
          item.product_name?.toLowerCase().includes(doubleProduct.toLowerCase()),
        );
        grinderCount += isDoublePortion ? itemCount * 2 : itemCount;
        message += `${isDoublePortion ? '🟠' : '⚪'} ${item.product_name}: ${itemCount} шт.\n`;
      });

      message += `\n📈 Итого: ${totalCount} шт.`;
      message += `\n📈 Итого по гриндеру: ${grinderCount} шт.`;
    } else {
      message += '📭 Нет данных о продажах за эту дату';
    }

    message += '\n\nПоследнее обновление: ' + new Date().toLocaleTimeString();
    message += '\n\nВыберите другую дату или обновите статистику:';

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      ...getStatsKeyboard(date),
    });

    userState.lastMessageId = messageId;
    userState.waitingForDate = false;
    userStates.set(chatId, userState);
  } catch (error) {
    console.error('Ошибка при показе статистики:', error);
    await bot.editMessageText('❌ Ошибка при загрузке данных', {
      chat_id: chatId,
      message_id: messageId,
      ...getBackKeyboard(),
    });
  }
}

// Функция показа аналитики за один день
async function showSalesAnalytics(bot, chatId, messageId, date, userState) {
  try {
    await bot.editMessageText('⏳ Загружаю общую статистику...', {
      chat_id: chatId,
      message_id: messageId,
    });

    const { analytics, date: analyticsDate } = await getSalesAnalyticsStat(date);

    const displayDate = analyticsDate
      ? `${analyticsDate.slice(6, 8)}.${analyticsDate.slice(4, 6)}.${analyticsDate.slice(0, 4)}`
      : 'неизвестную дату';

    let message = `📈 Общая статистика за ${displayDate}:\n\n`;

    if (analytics && analytics.counters) {
      const counters = analytics.counters;

      message += `💰 Выручка: ${parseFloat(counters.revenue).toFixed(2)} грн\n`;
      message += `🧾 Чеков: ${counters.transactions} шт\n`;
      message += `👥 Посетителей: ${counters.visitors} чел\n`;
      message += `📊 Средний чек: ${counters.average_receipt} грн\n`;
      message += `💵 Прибыль: ${parseFloat(counters.profit).toFixed(2)} грн\n`;
    } else {
      message += '📭 Нет данных о продажах за эту дату';
    }

    message += '\n\nПоследнее обновление: ' + new Date().toLocaleTimeString();

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      ...getStatsKeyboard(date, 'sales'),
    });

    userState.lastMessageId = messageId;
    userState.waitingForDate = false;
    userStates.set(chatId, userState);
  } catch (error) {
    console.error('Ошибка при показе общей статистики:', error);
    await bot.editMessageText('❌ Ошибка при загрузке общей статистики', {
      chat_id: chatId,
      message_id: messageId,
      ...getBackKeyboard(),
    });
  }
}

// Функция показа аналитики за период
async function showSalesAnalyticsRange(bot, chatId, messageId, startDate, endDate, userState) {
  try {
    await bot.editMessageText('⏳ Загружаю статистику за период...', {
      chat_id: chatId,
      message_id: messageId,
    });

    const { analytics, start, end } = await getSalesAnalyticsRange(startDate, endDate);

    const displayStart = `${start.slice(6, 8)}.${start.slice(4, 6)}.${start.slice(0, 4)}`;
    const displayEnd = `${end.slice(6, 8)}.${end.slice(4, 6)}.${end.slice(0, 4)}`;

    let message = `📊 Общая статистика за период ${displayStart} - ${displayEnd}:\n\n`;

    if (analytics && analytics.counters) {
      const counters = analytics.counters;
      message += `💰 Выручка: ${parseFloat(counters.revenue).toFixed(2)} грн\n`;
      message += `🧾 Чеков: ${counters.transactions} шт\n`;
      message += `👥 Посетителей: ${counters.visitors} чел\n`;
      message += `📊 Средний чек: ${counters.average_receipt} грн\n`;
      message += `⏱️ Среднее время: ${parseFloat(counters.average_time).toFixed(1)} ч\n`;
      message += `💵 Прибыль: ${parseFloat(counters.profit).toFixed(2)} грн\n`;
    } else {
      message += '📭 Нет данных о продажах за этот период';
    }

    message += '\n\nПоследнее обновление: ' + new Date().toLocaleTimeString();

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      ...getBackKeyboard(),
    });

    userState.lastMessageId = messageId;
    userState.waitingForDate = false;
    userStates.set(chatId, userState);
  } catch (error) {
    console.error('Ошибка при показе статистики за период:', error);
    await bot.editMessageText('❌ Ошибка при загрузке статистики за период', {
      chat_id: chatId,
      message_id: messageId,
      ...getBackKeyboard(),
    });
  }
}
