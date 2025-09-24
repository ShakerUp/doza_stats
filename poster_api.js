import axios from 'axios';
import { POSTER_TOKEN, COFFEE_CATEGORIES, EXCLUDED_PRODUCTS } from './config.js';

export async function getCoffeeSales(date = null) {
  try {
    // Если дата не указана, используем сегодняшнюю
    let targetDate = date;
    if (!targetDate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      targetDate = `${year}${month}${day}`;
    }
    const url = `https://joinposter.com/api/dash.getProductsSales?token=${POSTER_TOKEN}&date_from=${targetDate}&date_to=${targetDate}`;

    const response = await axios.get(url);
    const data = response.data;

    // Фильтруем только кофейные категории И исключаем ненужные товары
    const coffeeSales = data.response.filter(
      (item) =>
        COFFEE_CATEGORIES.includes(item.category_id?.toString()) &&
        !EXCLUDED_PRODUCTS.some((excluded) =>
          item.product_name?.toLowerCase().includes(excluded.toLowerCase()),
        ),
    );

    return { sales: coffeeSales, date: targetDate };
  } catch (error) {
    console.error('Ошибка при получении данных из Poster:', error);
    return { sales: [], date: null };
  }
}

export async function getSalesAnalyticsStat(date = null) {
  try {
    let targetDate = date;
    if (!targetDate) {
      targetDate = formatDate(new Date());
    }

    const url = `https://joinposter.com/api/dash.getAnalytics?format=json&token=${POSTER_TOKEN}&dateFrom=${targetDate}&dateTo=${targetDate}`;
    const response = await axios.get(url);
    const data = response.data;

    return { analytics: data.response, date: targetDate };
  } catch (error) {
    console.error('Ошибка при получении аналитики из Poster:', error);
    return { analytics: null, date: null };
  }
}

// 🔥 Новая функция: аналитика за диапазон
export async function getSalesAnalyticsRange(startDate, endDate) {
  try {
    let from = startDate;
    let to = endDate;

    if (!from) from = formatDate(new Date());
    if (!to) to = formatDate(new Date());

    const url = `https://joinposter.com/api/dash.getAnalytics?format=json&token=${POSTER_TOKEN}&dateFrom=${from}&dateTo=${to}`;
    const response = await axios.get(url);
    const data = response.data;

    return {
      analytics: data.response,
      start: from,
      end: to,
    };
  } catch (error) {
    console.error('Ошибка при получении аналитики за период из Poster:', error);
    return { analytics: null, start: null, end: null };
  }
}
