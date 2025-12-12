import { create } from 'zustand';
import { BinaryDecoder, type DecodedData } from '../utils/binary-decoder';
import { env } from '../../environments/env';

export interface Order {
  price: number;
  size: number;
}

export const GROUPING_VALUES = [0.01, 0.1, 1] as const;
export const ROWS_PER_PAGE_OPTIONS = [50, 100, 200, 300, 400, 500] as const;
export type Grouping = (typeof GROUPING_VALUES)[number];
export type RowsPerPage = (typeof ROWS_PER_PAGE_OPTIONS)[number];

interface OrderBookState {
  bids: Order[];
  asks: Order[];
  grouping: Grouping;
  selectedGrouping: Grouping;
  maxVolume: number;
  isConnected: boolean;
  rowsPerPage: RowsPerPage;
  isLoading: boolean;
  connect: () => void;
  disconnect: () => void;
  setGrouping: (grouping: Grouping) => void;
  setRowsPerPage: (rows: RowsPerPage) => void;
}

let ws: WebSocket | null = null;
let decoder: BinaryDecoder | null = null;
let buffer: DecodedData[] = [];
let lastProcessed = 0;
let animationFrameId: number | null = null;
let reconnectTimerId: number | null = null;

const MAX_BUFFER_SIZE = Math.max(...ROWS_PER_PAGE_OPTIONS);
const UPDATE_INTERVAL = 100;
const RECONNECT_DELAY = 3000;

export const useOrderBookStore = create<OrderBookState>((set, get) => ({
  bids: [],
  asks: [],
  grouping: 0.1,
  selectedGrouping: 0.1,
  maxVolume: 1,
  isConnected: false,
  isLoading: true,
  rowsPerPage: 100,
  connect: () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    set({ isLoading: true });
    decoder = new BinaryDecoder();
    try {
      ws = new WebSocket(env.wss);
      ws.binaryType = 'arraybuffer';
      ws.onopen = () => {
        console.log('WebSocket connected');
        set({ isConnected: true, isLoading: true });
      };
      ws.onmessage = (event: MessageEvent) => {
        try {
          const rawData = JSON.parse(event.data);
          if (!decoder) {
            console.warn('Decoder not initialized');
            return;
          }
          const decoded = decoder.decode(rawData);
          buffer.push(decoded);
          if (buffer.length > MAX_BUFFER_SIZE) {
            buffer = buffer.slice(-MAX_BUFFER_SIZE);
          }
          scheduleUpdate(set);
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        set({ isConnected: false, isLoading: false });
      };
      ws.onclose = (event) => {
        console.log('WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        set({ isConnected: false, isLoading: false });
        if (!event.wasClean) {
          scheduleReconnect(get);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      set({ isConnected: false, isLoading: false });
      scheduleReconnect(get);
    }
  },
  disconnect: () => {
    console.log('Disconnecting WebSocket...');
    if (reconnectTimerId !== null) {
      clearTimeout(reconnectTimerId);
      reconnectTimerId = null;
    }
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.onopen = null;
      ws.close();
      ws = null;
    }
    cleanup();
    set({
      isConnected: false,
      isLoading: false,
      bids: [],
      asks: [],
      maxVolume: 1,
    });
  },
  setGrouping: (grouping: Grouping) => {
    set({ grouping, selectedGrouping: grouping });
  },
  setRowsPerPage: (rowsPerPage: RowsPerPage) => {
    set({ rowsPerPage });
  },
}));

const scheduleUpdate = (set: (state: Partial<OrderBookState>) => void): void => {
  if (animationFrameId !== null) {
    return;
  }
  animationFrameId = requestAnimationFrame(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastProcessed;
    if (timeSinceLastUpdate >= UPDATE_INTERVAL && buffer.length > 0) {
      processBuffer(set);
      lastProcessed = now;
    }
    animationFrameId = null;
  });
};

const processBuffer = (set: (state: Partial<OrderBookState>) => void): void => {
  if (buffer.length === 0) return;
  const latest = buffer[buffer.length - 1];
  buffer = [];
  const bids = latest.bids.map((b) => ({ price: b.price, size: b.amount }));
  const asks = latest.asks.map((a) => ({ price: a.price, size: a.amount }));
  const allSizes = [...bids.map((b) => b.size), ...asks.map((a) => a.size)];
  const maxVolume = allSizes.length > 0 ? Math.max(...allSizes) : 1;
  set({
    bids,
    asks,
    maxVolume,
    isLoading: false,
  });
};

const scheduleReconnect = (get: () => OrderBookState): void => {
  if (reconnectTimerId !== null) {
    clearTimeout(reconnectTimerId);
  }
  reconnectTimerId = window.setTimeout(() => {
    reconnectTimerId = null;
    const store = get();
    if (!store.isConnected) {
      console.log('Attempting to reconnect...');
      store.connect();
    }
  }, RECONNECT_DELAY);
};

const cleanup = (): void => {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (reconnectTimerId !== null) {
    clearTimeout(reconnectTimerId);
    reconnectTimerId = null;
  }
  decoder = null;
  buffer = [];
  lastProcessed = 0;
};
