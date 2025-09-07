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
