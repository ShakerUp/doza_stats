import TelegramBot from 'node-telegram-bot-api';

export function getMainKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '☕ Проверка гриндера', callback_data: 'grinder_check' },
          { text: '📊Статистика', callback_data: 'sales_stats' },
        ],
      ],
    },
  };
}
export function getDateSelectionKeyboard() {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🟢 Сегодня', callback_data: `date_${formatDate(today)}` },
          { text: '🟡 Вчера', callback_data: `date_${formatDate(yesterday)}` },
        ],
        [{ text: '📅 Выбрать другую дату', callback_data: 'input_date' }],
      ],
    },
  };
}

export function getDateSelectionWithBackKeyboard() {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🟢 Сегодня', callback_data: `date_${formatDate(today)}` },
          { text: '🟡 Вчера', callback_data: `date_${formatDate(yesterday)}` },
        ],
        [{ text: '📅 Выбрать другую дату', callback_data: 'input_date' }],
        [{ text: '⬅️ Назад', callback_data: 'back_to_main' }],
      ],
    },
  };
}

// Новая функция для клавиатуры статистики с кнопкой обновить
export function getStatsKeyboard(date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🟢 Сегодня', callback_data: `date_${formatDate(today)}` },
          { text: '🟡 Вчера', callback_data: `date_${formatDate(yesterday)}` },
        ],
        [{ text: '📅 Выбрать другую дату', callback_data: 'input_date' }],
        [
          { text: '🔄 Обновить', callback_data: `refresh_${date}` }, // Кнопка обновить
          { text: '⬅️ Назад', callback_data: 'back_to_main' },
        ],
      ],
    },
  };
}

export function getBackKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: '⬅️ Назад', callback_data: 'back_to_main' }]],
    },
  };
}

// Вспомогательная функция для форматирования даты
export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Функция для парсинга даты из пользовательского ввода
export function parseUserDate(input) {
  try {
    const [day, month, year] = input.split('.');
    if (!day || !month || !year) return null;

    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (isNaN(date.getTime())) return null;

    return formatDate(date);
  } catch (error) {
    return null;
  }
}
