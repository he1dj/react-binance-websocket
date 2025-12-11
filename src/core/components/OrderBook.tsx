import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { GROUPING_VALUES, useOrderBookStore, type Grouping } from '../stores/order-book.store';
import { OrderRow } from './OrderRow';
import { CanvasDepthChart } from './DepthChartCanvas';
import '../styles/OrderBook.css';
import { groupOrders } from '../utils/group-orders';

interface OrderBookProps {
  className?: string;
}

const ROWS_PER_PAGE_OPTIONS = [10, 20, 30, 50] as const;

export const OrderBook = ({ className }: OrderBookProps) => {
  const { bids, asks, grouping, setGrouping, connect, disconnect } = useOrderBookStore();
  const [rowsPerPage, setRowsPerPage] = useState<number>(20);
  const bidsColumnRef = useRef<HTMLDivElement>(null);
  const asksColumnRef = useRef<HTMLDivElement>(null);
  const connectTimerRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);

  const handleRowsChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(Number(e.target.value));
  }, []);

  const handleGroupingClick = useCallback(
    (value: Grouping) => () => {
      setGrouping(value);
    },
    [setGrouping],
  );

  useEffect(() => {
    let isConnected = true;
    const initConnection = () => {
      if (!isConnected || isInitializedRef.current) return;
      connect();
      isInitializedRef.current = true;
    };
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    if (!isInitializedRef.current) {
      connectTimerRef.current = window.setTimeout(initConnection, 500);
    }

    return () => {
      isConnected = false;
      if (connectTimerRef.current) {
        clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }
      if (isInitializedRef.current) {
        disconnect();
        isInitializedRef.current = false;
      }
    };
  }, [connect, disconnect]);

  const groupedBids = useMemo(() => groupOrders(bids, grouping, true), [bids, grouping]);
  const groupedAsks = useMemo(() => groupOrders(asks, grouping, false), [asks, grouping]);

  const limitedBids = useMemo(() => groupedBids.slice(0, rowsPerPage), [groupedBids, rowsPerPage]);
  const limitedAsks = useMemo(() => groupedAsks.slice(0, rowsPerPage), [groupedAsks, rowsPerPage]);

  const totalBidsVolume = useMemo(
    () => limitedBids.reduce((sum, o) => sum + o.size, 0),
    [limitedBids],
  );
  const totalAsksVolume = useMemo(
    () => limitedAsks.reduce((sum, o) => sum + o.size, 0),
    [limitedAsks],
  );

  return (
    <div className={`wrapper ${className || ''}`}>
      <div className="header">
        <div className="header-left">
          <h2>Crypto Order Book</h2>
        </div>
        <div className="header-right">
          <div className="rows-control">
            <label htmlFor="rows-select">Rows:</label>
            <select
              id="rows-select"
              value={rowsPerPage}
              onChange={handleRowsChange}
              className="rows-select">
              {ROWS_PER_PAGE_OPTIONS.map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="controls">
        {GROUPING_VALUES.map((value) => (
          <button
            key={value}
            className={`grouping-btn ${grouping === value ? 'active' : ''}`}
            onClick={handleGroupingClick(value)}>
            {value}
          </button>
        ))}
      </div>

      <div className="columns">
        <div className="asks-section">
          <div className="section-header">
            <h3>Asks ({limitedAsks.length})</h3>
            <div className="section-info">
              <span className="total">Total: {totalAsksVolume.toFixed(4)}</span>
            </div>
          </div>
          <div className="column-container" ref={asksColumnRef}>
            <CanvasDepthChart
              orders={limitedAsks}
              type="ask"
              gradientDirection="ltr"
              totalVolume={totalAsksVolume}
              containerRef={asksColumnRef}
            />
            <div className="column">
              {limitedAsks.map((order, index) => (
                <OrderRow
                  key={`ask-${order.price}-${index}`}
                  order={order}
                  type="ask"
                  totalVolume={totalAsksVolume}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="bids-section">
          <div className="section-header">
            <h3>Bids ({limitedBids.length})</h3>
            <div className="section-info">
              <span className="total">Total: {totalBidsVolume.toFixed(4)}</span>
            </div>
          </div>
          <div className="column-container" ref={bidsColumnRef}>
            <CanvasDepthChart
              orders={limitedBids}
              type="bid"
              gradientDirection="rtl"
              totalVolume={totalBidsVolume}
              containerRef={bidsColumnRef}
            />
            <div className="column">
              {limitedBids.map((order, index) => (
                <OrderRow
                  key={`bid-${order.price}-${index}`}
                  order={order}
                  type="bid"
                  totalVolume={totalBidsVolume}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
