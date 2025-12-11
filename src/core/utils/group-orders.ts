import type { Order } from '../stores/order-book.store';

export const groupOrders = (orders: Order[], grouping: number, isBid: boolean): Order[] => {
  if (orders.length === 0) return [];
  const grouped = new Map<number, Order>();
  const limitedOrders = orders.slice(0, 1000);
  const decimalPlaces = Math.max(0, -Math.floor(Math.log10(grouping)));
  limitedOrders.forEach((order) => {
    const groupedPrice = Math.floor(order.price / grouping) * grouping;
    const roundedPrice = parseFloat(groupedPrice.toFixed(decimalPlaces));
    const existing = grouped.get(roundedPrice);
    if (existing) {
      existing.size += order.size;
    } else {
      grouped.set(roundedPrice, { price: roundedPrice, size: order.size });
    }
  });
  const result = Array.from(grouped.values());
  return isBid
    ? result.sort((a, b) => b.price - a.price)
    : result.sort((a, b) => a.price - b.price);
};
