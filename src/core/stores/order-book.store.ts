import { create } from 'zustand';
import { BinaryDecoder, type DecodedData } from '../utils/binary-decoder';
import { env } from '../../environments/env';

export interface Order {
  price: number;
  size: number;
}

export const GROUPING_VALUES = [0.01, 0.1, 1] as const;
export type Grouping = (typeof GROUPING_VALUES)[number];

interface OrderBookState {
  bids: Order[];
  asks: Order[];
  grouping: Grouping;
  selectedGrouping: Grouping;
  maxVolume: number;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  setGrouping: (grouping: Grouping) => void;
}

let ws: WebSocket | null = null;
let decoder: BinaryDecoder | null = null;
let buffer: DecodedData[] = [];
let lastProcessed = 0;
let animationFrameId: number | null = null;
let reconnectTimerId: number | null = null;


const MAX_BUFFER_SIZE = 50;
const UPDATE_INTERVAL = 100;
const RECONNECT_DELAY = 3000;

export const useOrderBookStore = create<OrderBookState>((set, get) => ({
  bids: [],
  asks: [],
  grouping: 0.1,
  selectedGrouping: 0.1,
  maxVolume: 1,
  isConnected: false,

  connect: () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    decoder = new BinaryDecoder();
    try {
      ws = new WebSocket(env.wss);
      ws.onopen = () => {
        console.log('WebSocket connected');
        set({ isConnected: true });
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
        set({ isConnected: false });
      };
      ws.onclose = (event) => {
        console.log('WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        set({ isConnected: false });
        if (!event.wasClean) {
          scheduleReconnect(get);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      set({ isConnected: false });
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
      bids: [],
      asks: [],
      maxVolume: 1,
    });
  },
  setGrouping: (grouping: Grouping) => {
    set({ grouping, selectedGrouping: grouping });
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
  const allSizes = [...latest.bids.map((b) => b.amount), ...latest.asks.map((a) => a.amount)];
  const maxVolume = allSizes.length > 0 ? Math.max(...allSizes) : 1;
  set({
    bids: latest.bids.map((b) => ({ price: b.price, size: b.amount })),
    asks: latest.asks.map((a) => ({ price: a.price, size: a.amount })),
    maxVolume,
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
