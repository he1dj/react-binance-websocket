import { memo } from 'react';
import type { Order } from '../stores/order-book.store';
import '../styles/OrderRow.css';

interface OrderRowProps {
  order: Order;
  type: 'bid' | 'ask';
  totalVolume: number;
}

export const OrderRow = memo(({ order, type, totalVolume }: OrderRowProps) => {
  const percentage = totalVolume > 0 ? (order.size / totalVolume) * 100 : 0;
  const percentageText = `${percentage.toFixed(1)}%`;

  return (
    <div className={`order-row ${type}`}>
      <div className="price-cell">
        <span className="price-value" style={{ color: type === 'bid' ? '#10b981' : '#ef4444' }}>
          {order.price.toFixed(2)}
        </span>
        <span className="percentage-indicator">{percentageText}</span>
      </div>
      <div className="separator" />
      <div className="size-cell">
        <span className="size-value">{order.size.toFixed(4)}</span>
      </div>
    </div>
  );
});
