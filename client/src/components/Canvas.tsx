import React, { useEffect, useRef, useState } from 'react';
import { Eraser, Paintbrush, PaintBucket, RotateCcw, Trash2 } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { DrawingTool, StrokeRecord } from '../types/shared';
import { floodFillCanvas } from '../utils/floodFill';

const PALETTE = [
  '#18181B', '#EF4444', '#F97316', '#F59E0B', '#2CF08A', '#06B6D4', '#38BDF8',
  '#6366F1', '#A855F7', '#EC4899', '#78350F', '#94A3B8', '#FDE047', '#FFFFFF'
];

const SIZES = [4, 8, 16, 26];

export const Canvas: React.FC = () => {
  const {
    socket,
    myId,
    roomState,
    emitDrawStart,
    emitDrawMove,
    emitDrawEnd,
    emitDrawFill,
    emitUndo,
    emitClear
  } = useSocket();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<StrokeRecord[]>([]);
  const isDrawingRef = useRef(false);

  const [tool, setTool] = useState<DrawingTool>('brush');
  const [color, setColor] = useState('#18181B');
  const [baseSize, setBaseSize] = useState(8);

  const isDrawer = Boolean(
    roomState && roomState.phase === 'DRAWING' && roomState.currentDrawerId === myId
  );

  // Coordinate Normalizer (0.0 - 1.0 Math)
  const renderStroke = (ctx: CanvasRenderingContext2D, stroke: StrokeRecord) => {
    if (!stroke.points.length) return;
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    if (stroke.tool === 'fill') {
      floodFillCanvas(ctx, stroke.points[0].x, stroke.points[0].y, stroke.color);
      return;
    }

    const strokeSize = (stroke.size * canvasWidth) / 800;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color;
    ctx.lineWidth = strokeSize;

    ctx.beginPath();
    const p0 = stroke.points[0];
    ctx.moveTo(p0.x * canvasWidth, p0.y * canvasHeight);
    for (let i = 1; i < stroke.points.length; i++) {
      const pt = stroke.points[i];
      ctx.lineTo(pt.x * canvasWidth, pt.y * canvasHeight);
    }
    if (stroke.points.length === 1) {
      ctx.lineTo(p0.x * canvasWidth + 0.1, p0.y * canvasHeight + 0.1);
    }
    ctx.stroke();
    ctx.restore();
  };

  const replayHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const s of strokesRef.current) {
      renderStroke(ctx, s);
    }
  };

  useEffect(() => {
    if (roomState?.strokes) {
      strokesRef.current = [...roomState.strokes];
      replayHistory();
    }
  }, [roomState?.phase]);

  // ResizeObserver history replay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      replayHistory();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onStart = (stroke: StrokeRecord) => {
      strokesRef.current.push(stroke);
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) renderStroke(ctx, stroke);
    };

    const onMove = ({ strokeId, x, y }: { strokeId?: string; x: number; y: number }) => {
      const target = strokeId
        ? strokesRef.current.find((s) => s.id === strokeId)
        : strokesRef.current[strokesRef.current.length - 1];
      if (target) {
        target.points.push({ x, y });
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) renderStroke(ctx, target);
      }
    };

    const onHistory = (strokes: StrokeRecord[]) => {
      strokesRef.current = [...strokes];
      replayHistory();
    };

    const onClear = () => {
      strokesRef.current = [];
      replayHistory();
    };

    socket.on('draw:start', onStart);
    socket.on('draw:move', onMove);
    socket.on('draw:history', onHistory);
    socket.on('draw:clear', onClear);

    return () => {
      socket.off('draw:start', onStart);
      socket.off('draw:move', onMove);
      socket.off('draw:history', onHistory);
      socket.off('draw:clear', onClear);
    };
  }, [socket]);

  const getNormalizedCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x: nx, y: ny };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getNormalizedCoords(e);

    if (tool === 'fill') {
      emitDrawFill({ x, y, color, size: baseSize, tool: 'fill' });
      return;
    }

    isDrawingRef.current = true;
    emitDrawStart({
      x,
      y,
      color: tool === 'eraser' ? '#FFFFFF' : color,
      size: baseSize,
      tool
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingRef.current) return;
    const { x, y } = getNormalizedCoords(e);
    emitDrawMove({ x, y });
  };

  const handlePointerUp = () => {
    if (!isDrawer || !isDrawingRef.current) return;
    isDrawingRef.current = false;
    emitDrawEnd();
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 border-slate-700 bg-white shadow-2xl">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`w-full h-full touch-none ${isDrawer ? 'cursor-crosshair' : 'cursor-default'}`}
        />
      </div>

      {isDrawer && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => {
                  setColor(hex);
                  if (tool === 'eraser') setTool('brush');
                }}
                className={`w-6 h-6 rounded-full border ${
                  color === hex && tool !== 'eraser'
                    ? 'scale-115 ring-2 ring-[#2CF08A] border-white'
                    : 'border-slate-600'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTool('brush')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 ${
                tool === 'brush' ? 'bg-[#2CF08A] text-[#010413]' : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" /> Brush
            </button>
            <button
              type="button"
              onClick={() => setTool('fill')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 ${
                tool === 'fill' ? 'bg-[#2CF08A] text-[#010413]' : 'bg-slate-800 text-slate-300'
              }`}
            >
              <PaintBucket className="w-3.5 h-3.5" /> Fill
            </button>
            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 ${
                tool === 'eraser' ? 'bg-[#2CF08A] text-[#010413]' : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Eraser className="w-3.5 h-3.5" /> Eraser
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {SIZES.map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => setBaseSize(sz)}
                className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
                  baseSize === sz ? 'border-[#2CF08A] bg-slate-800' : 'border-slate-700'
                }`}
              >
                <span
                  className="rounded-full bg-white"
                  style={{ width: Math.min(18, sz), height: Math.min(18, sz) }}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={emitUndo}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Undo
            </button>
            <button
              type="button"
              onClick={emitClear}
              className="px-2.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
