import { TEXT } from './config.js';
import {
  getMainKeyboard,
  getDateSelectionWithBackKeyboard,
  getStatsKeyboard,
  getBackKeyboard,
  parseUserDate,
} from './keyboards.js';
import { getCoffeeSales } from './poster_api.js';
import { DOUBLE_GRINDER } from './config.js';

// Храним ID последних сообщений и состояния для каждого чата
const userStates = new Map();

export function setupMainHandlers(bot) {
  // Обработчик команды /start
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    // Удаляем предыдущее сообщение если есть
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
        // Показываем выбор даты
        await bot.editMessageText(TEXT.GRINDER_PAGE, {
          chat_id: chatId,
          message_id: messageId,
          ...getDateSelectionWithBackKeyboard(),
        });

        userState.lastMessageId = messageId;
        userState.waitingForDate = false;
        userStates.set(chatId, userState);
      } else if (data.startsWith('date_')) {
        // Обработка выбранной даты
        const date = data.replace('date_', '');
        await showCoffeeSales(bot, chatId, messageId, date, userState);
      } else if (data.startsWith('refresh_')) {
        // Обработка кнопки "Обновить"
        const date = data.replace('refresh_', '');
        await showCoffeeSales(bot, chatId, messageId, date, userState);
      } else if (data === 'input_date') {
        // Запрос на ввод даты
        await bot.editMessageText(TEXT.INPUT_DATE, {
          chat_id: chatId,
          message_id: messageId,
          ...getBackKeyboard(),
        });

        userState.lastMessageId = messageId;
        userState.waitingForDate = true;
        userStates.set(chatId, userState);
      } else if (data === 'back_to_main') {
        // Возвращаемся к главному меню
        await bot.editMessageText(TEXT.WELCOME, {
          chat_id: chatId,
          message_id: messageId,
          ...getMainKeyboard(),
        });

        userState.lastMessageId = messageId;
        userState.waitingForDate = false;
        userStates.set(chatId, userState);
      }

      // Подтверждаем обработку callback
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error('Ошибка при обработке callback:', error);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Произошла ошибка' });
    }
  });

  // Обработчик текстовых сообщений для ввода даты
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userState = userStates.get(chatId) || {};

    // Пропускаем команду /start (её обрабатывает отдельный обработчик)
    if (text === '/start') {
      return;
    }

    // Если пользователь вводит дату
    if (userState.waitingForDate && text && text !== TEXT.WELCOME) {
      const parsedDate = parseUserDate(text);

      if (parsedDate) {
        // Показываем статистику для введенной даты
        try {
          await bot.deleteMessage(chatId, userState.lastMessageId);
        } catch (error) {}

        const sentMessage = await bot.sendMessage(chatId, '⏳ Загружаю данные...');
        await showCoffeeSales(bot, chatId, sentMessage.message_id, parsedDate, userState);
      } else {
        // Неверный формат даты
        await bot.sendMessage(
          chatId,
          '❌ Неверный формат даты. Введите в формате ДД.ММ.ГГГГ (например: 07.09.2024)',
        );
      }
      return;
    }

    // Обработка текстового сообщения с текстом приветствия
    if (text === TEXT.WELCOME) {
      // Удаляем предыдущее сообщение если есть
      if (userState.lastMessageId) {
        try {
          await bot.deleteMessage(chatId, userState.lastMessageId);
        } catch (error) {}
      }

      // Отправляем новое сообщение
      const sentMessage = await bot.sendMessage(chatId, TEXT.WELCOME, getMainKeyboard());

      userState.lastMessageId = sentMessage.message_id;
      userState.waitingForDate = false;
      userStates.set(chatId, userState);
    }
  });
}

// Функция показа статистики продаж
async function showCoffeeSales(bot, chatId, messageId, date, userState) {
  try {
    // Показываем сообщение о загрузке
    await bot.editMessageText('⏳ Загружаю актуальные данные...', {
      chat_id: chatId,
      message_id: messageId,
    });

    const { sales, date: salesDate } = await getCoffeeSales(date);

    // Форматируем дату для отображения
    const displayDate = salesDate
      ? `${salesDate.slice(6, 8)}.${salesDate.slice(4, 6)}.${salesDate.slice(0, 4)}`
      : 'неизвестную дату';

    let message = `📊 Продажи кофейных напитков за ${displayDate}:\n\n`;

    if (sales.length > 0) {
      let totalCount = 0;
      let totalRevenue = 0;
      let grinderCount = 0;

      sales.forEach((item) => {
        const itemCount = parseInt(item.count) || 0;
        totalCount += itemCount;

        // Проверяем, нужно ли удваивать для гриндера
        const isDoublePortion = DOUBLE_GRINDER.some((doubleProduct) =>
          item.product_name?.toLowerCase().includes(doubleProduct.toLowerCase()),
        );
        grinderCount += isDoublePortion ? itemCount * 2 : itemCount;
        message += `${isDoublePortion ? '🟠' : '⚪'} ${item.product_name}: ${parseInt(
          item.count,
        )} шт.\n`;
      });

      message += `\n📈 Итого: ${totalCount.toFixed(0)} шт.`;
      message += `\n📈 Итого по гриндеру: ${grinderCount} шт.`;
    } else {
      message += '📭 Нет данных о продажах за эту дату';
    }

    message += '\n\nПоследнее обновление: ' + new Date().toLocaleTimeString();
    message += '\n\nВыберите другую дату или обновите статистику:';

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      ...getStatsKeyboard(date), // Используем клавиатуру с кнопкой обновить
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
