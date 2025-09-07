import TelegramBot from 'node-telegram-bot-api';
import { BOT_TOKEN } from './config.js';
import { setupMainHandlers } from './handlers.js';

// Инициализация бота
const bot = new TelegramBot(BOT_TOKEN, {
  polling: true,
  filepath: false,
});

// Настройка обработчиков
setupMainHandlers(bot);

// Обработка ошибок
bot.on('error', (error) => {
  console.error('Ошибка бота:', error);
});

bot.on('polling_error', (error) => {
  console.error('Ошибка polling:', error);
});

console.log('☕ Coffee Bot запущен...');
