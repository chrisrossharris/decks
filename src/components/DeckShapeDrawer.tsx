import { useMemo, useRef, useState, type MouseEvent } from 'react';

type Point = { x: number; y: number };

type DragAxis = 'x' | 'y' | null;

function polygonArea(points: Point[]) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function polygonPerimeter(points: Point[]) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

function clampGrid(n: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(n)));
}

export default function DeckShapeDrawer({
  points,
  onChange
}: {
  points: Point[];
  onChange: (next: Point[], areaSqft: number, perimeterLf: number) => void;
}) {
  const cell = 16;
  const gridSize = 20;
  const width = gridSize * cell;

  const [snapOrthogonal, setSnapOrthogonal] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragAxis = useRef<DragAxis>(null);
  const dragOrigin = useRef<Point | null>(null);
  const draggedRecently = useRef(false);

  const area = useMemo(() => polygonArea(points), [points]);
  const perimeter = useMemo(() => polygonPerimeter(points), [points]);

  function commit(next: Point[]) {
    onChange(next, Number(polygonArea(next).toFixed(2)), Number(polygonPerimeter(next).toFixed(2)));
  }

  function svgCoords(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = clampGrid((event.clientX - rect.left) / cell, gridSize);
    const y = clampGrid((event.clientY - rect.top) / cell, gridSize);
    return { x, y };
  }

  function onClick(event: MouseEvent<SVGSVGElement>) {
    if (draggedRecently.current) {
      draggedRecently.current = false;
      return;
    }

    let { x, y } = svgCoords(event);

    if (points.length > 0 && snapOrthogonal) {
      const last = points[points.length - 1];
      const dx = x - last.x;
      const dy = y - last.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        y = last.y;
      } else {
        x = last.x;
      }
      if (last.x === x && last.y === y) return;
    }

    commit([...points, { x, y }]);
  }

  function onPointMouseDown(index: number) {
    setDragIndex(index);
    dragAxis.current = null;
    dragOrigin.current = points[index];
  }

  function onMouseMove(event: MouseEvent<SVGSVGElement>) {
    if (dragIndex == null) return;
    let { x, y } = svgCoords(event);

    const next = [...points];
    const original = dragOrigin.current ?? next[dragIndex];

    if (snapOrthogonal) {
      const dx = x - original.x;
      const dy = y - original.y;
      if (dragAxis.current == null) {
        dragAxis.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      }
      if (dragAxis.current === 'x') {
        y = original.y;
      } else {
        x = original.x;
      }
    }

    if (next[dragIndex].x === x && next[dragIndex].y === y) return;

    next[dragIndex] = { x, y };
    draggedRecently.current = true;
    commit(next);
  }

  function stopDrag() {
    if (dragIndex != null) {
      setDragIndex(null);
      dragAxis.current = null;
      dragOrigin.current = null;
    }
  }

  function setPoint(index: number, axis: 'x' | 'y', value: string) {
    const next = [...points];
    const numeric = clampGrid(Number(value), gridSize);
    if (!Number.isFinite(numeric)) return;
    next[index] = { ...next[index], [axis]: numeric };
    commit(next);
  }

  function removePoint(index: number) {
    const next = points.filter((_, i) => i !== index);
    commit(next);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label">Shape Drawer (click points on grid)</p>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <input type="checkbox" checked={snapOrthogonal} onChange={(e) => setSnapOrthogonal(e.target.checked)} />
          Orthogonal Snap
        </label>
      </div>

      <p className="text-xs text-slate-500">Draw clockwise around deck perimeter. Grid scale: 1 square = 1 ft. Drag points to adjust.</p>
      <svg
        viewBox={`0 0 ${width} ${width}`}
        className="mt-2 w-full max-w-[360px] cursor-crosshair rounded border border-slate-200 bg-slate-50"
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        {Array.from({ length: gridSize + 1 }).map((_, i) => (
          <g key={i}>
            <line x1={i * cell} y1={0} x2={i * cell} y2={width} stroke="#e5e7eb" strokeWidth="1" />
            <line x1={0} y1={i * cell} x2={width} y2={i * cell} stroke="#e5e7eb" strokeWidth="1" />
          </g>
        ))}

        {points.length > 1 && (
          <polyline
            points={points.map((p) => `${p.x * cell},${p.y * cell}`).join(' ')}
            fill="none"
            stroke="#18453b"
            strokeWidth="2"
          />
        )}

        {points.length > 2 && (
          <polygon
            points={points.map((p) => `${p.x * cell},${p.y * cell}`).join(' ')}
            fill="rgba(24,69,59,0.18)"
            stroke="#18453b"
            strokeWidth="2"
          />
        )}

        {points.map((p, i) => (
          <circle
            key={`${p.x}-${p.y}-${i}`}
            cx={p.x * cell}
            cy={p.y * cell}
            r="4"
            fill={dragIndex === i ? '#18453b' : '#e76f51'}
            onMouseDown={(e) => {
              e.stopPropagation();
              onPointMouseDown(i);
            }}
            style={{ cursor: 'move' }}
          />
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-slate-100 px-2 py-1">Points: {points.length}</span>
        <span className="rounded bg-slate-100 px-2 py-1">Area: {area.toFixed(2)} sqft</span>
        <span className="rounded bg-slate-100 px-2 py-1">Perimeter: {perimeter.toFixed(2)} lf</span>
      </div>

      {points.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">X (ft)</th>
                <th className="py-1 pr-2">Y (ft)</th>
                <th className="py-1">Action</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={`row-${i}`} className="border-t border-slate-100">
                  <td className="py-1 pr-2 font-semibold">{i + 1}</td>
                  <td className="py-1 pr-2">
                    <input
                      className="w-16 rounded border border-slate-300 px-1 py-0.5"
                      type="number"
                      min={0}
                      max={gridSize}
                      step={1}
                      value={p.x}
                      onChange={(e) => setPoint(i, 'x', e.target.value)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      className="w-16 rounded border border-slate-300 px-1 py-0.5"
                      type="number"
                      min={0}
                      max={gridSize}
                      step={1}
                      value={p.y}
                      onChange={(e) => setPoint(i, 'y', e.target.value)}
                    />
                  </td>
                  <td className="py-1">
                    <button
                      type="button"
                      onClick={() => removePoint(i)}
                      className="rounded border border-rose-300 px-2 py-0.5 font-semibold text-rose-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => commit(points.slice(0, -1))}
          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
        >
          Undo Point
        </button>
        <button
          type="button"
          onClick={() => onChange([], 0, 0)}
          className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
        >
          Clear Shape
        </button>
      </div>
    </div>
  );
}
