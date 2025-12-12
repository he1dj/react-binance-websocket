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
      expect(result[1]).toEqual({ price: 100.02, size: 2 });
      expect(result[2]).toEqual({ price: 100.01, size: 1 });
    });
    it('should group orders by tick size 0.1', () => {
      const orders: Order[] = [
        { price: 100.05, size: 1 },
        { price: 100.09, size: 2 },
        { price: 100.15, size: 3 },
      ];
      const result = groupOrders(orders, 0.1, true);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ price: 100.1, size: 3 });
      expect(result[1]).toEqual({ price: 100.0, size: 3 });
    });

    it('should group orders by tick size 1.0', () => {
      const orders: Order[] = [
        { price: 100.25, size: 1 },
        { price: 100.75, size: 2 },
        { price: 101.25, size: 3 },
      ];
      const result = groupOrders(orders, 1, true);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ price: 101, size: 3 });
      expect(result[1]).toEqual({ price: 100, size: 3 });
    });
    it('should accumulate sizes for same grouped price', () => {
      const orders: Order[] = [
        { price: 100.01, size: 1.5 },
        { price: 100.02, size: 2.5 },
        { price: 100.03, size: 3.0 },
      ];
      const result = groupOrders(orders, 0.1, true);
      expect(result).toHaveLength(1);
      expect(result[0].price).toBe(100.0);
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
    it('should limit processed orders based on limit parameter', () => {
      const orders: Order[] = Array.from({ length: 1000 }, (_, i) => ({
        price: 100 + i * 0.01,
        size: 1,
      }));
      const resultNoLimit = groupOrders(orders, 0.01, true);
      expect(resultNoLimit.length).toBeGreaterThan(990);
      const resultWithLimit = groupOrders(orders, 0.01, true, 100);
      expect(resultWithLimit.length).toBe(200);
    });
    it('should process limited number of orders for performance', () => {
      const orders: Order[] = Array.from({ length: 500 }, (_, i) => ({
        price: 100 + i * 0.01,
        size: 1,
      }));
      const result = groupOrders(orders, 0.01, true, 50);
      expect(result.length).toBe(100);
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
    it('should correctly round to decimal places based on grouping', () => {
      const orders: Order[] = [
        { price: 100.123, size: 1 },
        { price: 100.456, size: 2 },
      ];
      const result1 = groupOrders(orders, 0.01, true);
      expect(result1).toHaveLength(2);
      expect(result1[0].price).toBe(100.45);
      expect(result1[1].price).toBe(100.12);
      const result2 = groupOrders(orders, 0.1, true);
      expect(result2).toHaveLength(2);
      expect(result2[0].price).toBe(100.4);
      expect(result2[1].price).toBe(100.1);

      const totalSize = result2.reduce((sum, o) => sum + o.size, 0);
      expect(totalSize).toBe(3);
    });
  });

  describe('Limit functionality', () => {
    it('should process only limit * 2 orders when limit is provided', () => {
      const orders: Order[] = Array.from({ length: 100 }, (_, i) => ({
        price: 100 + i,
        size: i + 1,
      }));
      const result = groupOrders(orders, 1, true, 10);
      expect(result).toHaveLength(20);
      const maxPrice = Math.max(...result.map((o) => o.price));
      expect(maxPrice).toBe(119);
    });
    it('should handle limit larger than available orders', () => {
      const orders: Order[] = [
        { price: 100, size: 1 },
        { price: 101, size: 2 },
        { price: 102, size: 3 },
      ];
      const result = groupOrders(orders, 1, true, 10);
      expect(result).toHaveLength(3);
    });
    it('should work correctly with grouping when limit is applied', () => {
      const orders: Order[] = [
        { price: 100.01, size: 1 },
        { price: 100.02, size: 2 },
        { price: 100.11, size: 3 },
        { price: 100.12, size: 4 },
        { price: 100.21, size: 5 },
        { price: 100.22, size: 6 },
      ];
      const result = groupOrders(orders, 0.1, true, 2);
      expect(result).toHaveLength(2);
      expect(result[0].price).toBe(100.1);
      expect(result[0].size).toBe(7);
      expect(result[1].price).toBe(100.0);
      expect(result[1].size).toBe(3);
    });
  });

  describe('Decimal places calculation', () => {
    it('should calculate correct decimal places for grouping', () => {
      const orders1: Order[] = [
        { price: 100.123456, size: 1 },
        { price: 100.123789, size: 2 },
      ];
      const result1 = groupOrders(orders1, 0.01, true);
      expect(result1[0].price).toBe(100.12);
      const orders2: Order[] = [
        { price: 100.123, size: 1 },
        { price: 100.456, size: 2 },
      ];
      const result2 = groupOrders(orders2, 0.1, true);
      expect(result2).toHaveLength(2);
      const orders3: Order[] = [
        { price: 100.7, size: 1 },
        { price: 100.2, size: 2 },
      ];
      const result3 = groupOrders(orders3, 1, true);
      expect(result3).toHaveLength(1);
      expect(result3[0].price).toBe(100);
      expect(result3[0].size).toBe(3);
    });
  });
});
