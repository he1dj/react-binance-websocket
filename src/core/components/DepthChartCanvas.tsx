import { useEffect, useRef, useCallback } from 'react';

interface CanvasDepthChartProps {
  orders: { price: number; size: number }[];
  type: 'bid' | 'ask';
  totalVolume: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  gradientDirection?: 'ltr' | 'rtl';
}

const VISIBLE_ROWS_BUFFER = 2;

interface VisibleRowsResult {
  visibleRows: Element[];
  rowIndices: number[];
  minY: number;
  maxY: number;
  visibleHeight: number;
}

export const CanvasDepthChart = ({
  orders,
  type,
  totalVolume,
  containerRef,
  gradientDirection,
}: CanvasDepthChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const lastCanvasHeightRef = useRef<number>(0);
  const lastMinYRef = useRef<number>(0);

  const getVisibleRowsInfo = useCallback((): VisibleRowsResult => {
    const container = containerRef.current;
    if (!container)
      return {
        visibleRows: [],
        rowIndices: [],
        minY: 0,
        maxY: 0,
        visibleHeight: 0,
      };
    const rows = container.querySelectorAll('.order-row');
    if (rows.length === 0)
      return {
        visibleRows: [],
        rowIndices: [],
        minY: 0,
        maxY: 0,
        visibleHeight: 0,
      };
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const containerHeight = containerRect.height;
    const visibleRows: Element[] = [];
    const rowIndices: number[] = [];
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowRect = row.getBoundingClientRect();
      const rowTop = rowRect.top - containerRect.top + scrollTop;
      const rowBottom = rowTop + rowRect.height;

      const buffer = VISIBLE_ROWS_BUFFER * rowRect.height;
      const isVisible =
        rowBottom >= scrollTop - buffer && rowTop <= scrollTop + containerHeight + buffer;
      if (isVisible) {
        visibleRows.push(row);
        rowIndices.push(i);
        minY = Math.min(minY, rowTop);
        maxY = Math.max(maxY, rowBottom);
      }
      if (visibleRows.length > 50) break;
    }
    if (visibleRows.length === 0) {
      return {
        visibleRows: [],
        rowIndices: [],
        minY: 0,
        maxY: 0,
        visibleHeight: 0,
      };
    }
    const visibleHeight = maxY - minY;
    return { visibleRows, rowIndices, minY, maxY, visibleHeight };
  }, [containerRef]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || orders.length === 0 || totalVolume === 0) return;
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const { visibleRows, rowIndices, minY, visibleHeight } = getVisibleRowsInfo();
    if (visibleRows.length === 0) {
      if (canvas.height > 0) {
        canvas.width = 0;
        canvas.height = 0;
        canvas.style.width = '0';
        canvas.style.height = '0';
        canvas.style.transform = 'translateY(0)';
        lastCanvasHeightRef.current = 0;
        lastMinYRef.current = 0;
      }
      return;
    }
    const heightChanged = Math.abs(visibleHeight - lastCanvasHeightRef.current) > 1;
    const positionChanged = Math.abs(minY - lastMinYRef.current) > 1;
    if (heightChanged || positionChanged) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvasWidth = containerRect.width * dpr;
      const canvasHeight = visibleHeight * dpr;
      if (canvasHeight > 16384 || canvasWidth > 16384) {
        console.warn('Canvas size too large, reducing quality');
        canvas.width = Math.min(canvasWidth, 16384);
        canvas.height = Math.min(canvasHeight, 16384);
      } else {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
      }
      canvas.style.width = `${containerRect.width}px`;
      canvas.style.height = `${visibleHeight}px`;
      canvas.style.transform = `translateY(${minY}px)`;
      lastCanvasHeightRef.current = visibleHeight;
      lastMinYRef.current = minY;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.translate(0, -minY);
    for (let i = 0; i < visibleRows.length; i++) {
      const row = visibleRows[i];
      const rowIndex = rowIndices[i];
      const order = orders[rowIndex];
      if (!order) continue;
      const rowRect = row.getBoundingClientRect();
      const y = rowRect.top - containerRect.top + scrollTop;
      const height = rowRect.height;
      const percentage = (order.size / totalVolume) * 100;
      const width = (containerRect.width * percentage) / 100;
      const isLTR = gradientDirection === 'ltr';
      const shouldBeLTR = isLTR || (!gradientDirection && type === 'ask');
      const x = shouldBeLTR ? 0 : containerRect.width - width;
      const gradient = ctx.createLinearGradient(x, y, x + width, y);
      if (type === 'bid') {
        gradient.addColorStop(
          0,
          shouldBeLTR ? 'rgba(16, 185, 129, 0.6)' : 'rgba(16, 185, 129, 0.05)',
        );
        gradient.addColorStop(
          1,
          shouldBeLTR ? 'rgba(16, 185, 129, 0.05)' : 'rgba(16, 185, 129, 0.6)',
        );
      } else {
        gradient.addColorStop(
          0,
          shouldBeLTR ? 'rgba(239, 68, 68, 0.6)' : 'rgba(239, 68, 68, 0.05)',
        );
        gradient.addColorStop(
          1,
          shouldBeLTR ? 'rgba(239, 68, 68, 0.05)' : 'rgba(239, 68, 68, 0.6)',
        );
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, width, height);
    }
  }, [orders, type, totalVolume, containerRef, gradientDirection, getVisibleRowsInfo]);

  const scheduleDraw = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(() => {
      try {
        draw();
      } catch (error) {
        console.error('Error drawing canvas:', error);
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
          canvas.style.width = '0';
          canvas.style.height = '0';
          lastCanvasHeightRef.current = 0;
          lastMinYRef.current = 0;
        }
      }
    });
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      scheduleDraw();
    };
    const handleResize = () => {
      scheduleDraw();
    };
    let resizeObserver: ResizeObserver | null = null;
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver((entries) => {
        const hasRowChange = entries.some((entry) =>
          (entry.target as Element).classList.contains('order-row'),
        );
        if (hasRowChange) {
          scheduleDraw();
        }
      });
      resizeObserver.observe(container);
      const rows = container.querySelectorAll('.order-row');
      rows.forEach((row) => resizeObserver!.observe(row));
    }
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    const initialTimer = setTimeout(() => {
      scheduleDraw();
    }, 100);
    const intervalId = setInterval(() => {
      scheduleDraw();
    }, 2000);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      clearTimeout(initialTimer);
      clearInterval(intervalId);
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef, scheduleDraw]);

  return (
    <canvas
      ref={canvasRef}
      className="canvas-depth-chart"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 0,
        willChange: 'transform',
      }}
    />
  );
};
