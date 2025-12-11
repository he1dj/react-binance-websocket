import { useEffect, useRef, useCallback } from 'react';

interface CanvasDepthChartProps {
  orders: { price: number; size: number }[];
  type: 'bid' | 'ask';
  totalVolume: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  gradientDirection?: 'ltr' | 'rtl';
}

export const CanvasDepthChart = ({
  orders,
  type,
  totalVolume,
  containerRef,
  gradientDirection,
}: CanvasDepthChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const column = container.querySelector('.column');
    if (!column) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || orders.length === 0 || totalVolume === 0) return;

    const containerRect = container.getBoundingClientRect();
    const columnRect = column.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = containerRect.width * dpr;
    canvas.height = columnRect.height * dpr;
    canvas.style.width = `${containerRect.width}px`;
    canvas.style.height = `${columnRect.height}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, containerRect.width, columnRect.height);
    const rows = container.querySelectorAll('.order-row');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const order = orders[i];
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
  }, [orders, type, totalVolume, containerRef, gradientDirection]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const requestDraw = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(draw);
    };
    const handleScroll = requestDraw;
    const handleResize = requestDraw;
    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    requestDraw();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="canvas-depth-chart"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
};
