import { describe, it, expect } from 'vitest';
import type { Order } from '../stores/order-book.store';
import { groupOrders } from './group-orders';

describe('groupOrders', () => {
  describe('Grouping by tick size', () => {
    it('should group orders by tick size 0.01', () => {
      const orders: Order[] = [
        { price: 100.01, size: 1 },
        { price: 100.02, size: 2 },
        { price: 100.03, size: 3 },
      ];
      const result = groupOrders(orders, 0.01, true);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ price: 100.03, size: 3 });
    });

    it('should group orders by tick size 0.1', () => {
      const orders: Order[] = [
        { price: 100.05, size: 1 },
        { price: 100.09, size: 2 },
        { price: 100.15, size: 3 },
      ];
      const result = groupOrders(orders, 0.1, true);

      expect(result).toHaveLength(2);
      expect(result.find((o) => o.price === 100.0)?.size).toBe(3);
      expect(result.find((o) => o.price === 100.1)?.size).toBe(3);
    });

    it('should group orders by tick size 1.0', () => {
      const orders: Order[] = [
        { price: 100.25, size: 1 },
        { price: 100.75, size: 2 },
        { price: 101.25, size: 3 },
      ];
      const result = groupOrders(orders, 1, true);

      expect(result).toHaveLength(2);
      expect(result.find((o) => o.price === 100)?.size).toBe(3);
      expect(result.find((o) => o.price === 101)?.size).toBe(3);
    });

    it('should accumulate sizes for same grouped price', () => {
      const orders: Order[] = [
        { price: 100.01, size: 1.5 },
        { price: 100.02, size: 2.5 },
        { price: 100.03, size: 3.0 },
      ];
      const result = groupOrders(orders, 0.1, true);

      expect(result).toHaveLength(1);
      expect(result[0].size).toBe(7.0);
    });
  });

  describe('Sorting', () => {
    it('should sort bids in descending order (highest first)', () => {
      const orders: Order[] = [
        { price: 100, size: 1 },
        { price: 102, size: 2 },
        { price: 101, size: 3 },
      ];
      const result = groupOrders(orders, 1, true);

      expect(result[0].price).toBe(102);
      expect(result[1].price).toBe(101);
      expect(result[2].price).toBe(100);
    });

    it('should sort asks in ascending order (lowest first)', () => {
      const orders: Order[] = [
        { price: 100, size: 1 },
        { price: 102, size: 2 },
        { price: 101, size: 3 },
      ];
      const result = groupOrders(orders, 1, false);

      expect(result[0].price).toBe(100);
      expect(result[1].price).toBe(101);
      expect(result[2].price).toBe(102);
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for empty input', () => {
      const result = groupOrders([], 0.01, true);
      expect(result).toEqual([]);
    });

    it('should handle single order', () => {
      const orders: Order[] = [{ price: 100.5, size: 5 }];
      const result = groupOrders(orders, 1, true);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ price: 100, size: 5 });
    });

    it('should limit to 1000 orders', () => {
      const orders: Order[] = Array.from({ length: 1500 }, (_, i) => ({
        price: 100 + i,
        size: 1,
      }));
      const result = groupOrders(orders, 1, true);
      expect(result.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Precision', () => {
    it('should handle floating point precision correctly', () => {
      const orders: Order[] = [
        { price: 100.001, size: 1 },
        { price: 100.002, size: 2 },
        { price: 100.003, size: 3 },
      ];
      const result = groupOrders(orders, 0.01, true);

      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(100.0);
      expect(result[0].size).toBe(6);
    });
  });
});
