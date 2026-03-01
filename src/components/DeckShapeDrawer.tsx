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

function clampGrid(n: number, max: number, step: number) {
  const safeStep = step > 0 ? step : 1;
  const snapped = Math.round(n / safeStep) * safeStep;
  return Math.max(0, Math.min(max, Number(snapped.toFixed(4))));
}

export default function DeckShapeDrawer({
  points,
  onChange,
  selectedLedgerEdgeIndex,
  onSelectLedgerEdge
}: {
  points: Point[];
  onChange: (next: Point[], areaSqft: number, perimeterLf: number) => void;
  selectedLedgerEdgeIndex?: number | null;
  onSelectLedgerEdge?: (index: number) => void;
}) {
  const cell = 16;
  const gridSize = 20;
  const width = gridSize * cell;

  const [snapOrthogonal, setSnapOrthogonal] = useState(true);
  const [snapStep, setSnapStep] = useState(1);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null);
  const [hoverEdgeIndex, setHoverEdgeIndex] = useState<number | null>(null);
  const [quickLength, setQuickLength] = useState(20);
  const [quickDepth, setQuickDepth] = useState(14);
  const [notchLength, setNotchLength] = useState(6);
  const [notchDepth, setNotchDepth] = useState(6);
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
    const x = clampGrid((event.clientX - rect.left) / cell, gridSize, snapStep);
    const y = clampGrid((event.clientY - rect.top) / cell, gridSize, snapStep);
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
    setCursorPoint(svgCoords(event));
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
    setCursorPoint(null);
    if (dragIndex != null) {
      setDragIndex(null);
      dragAxis.current = null;
      dragOrigin.current = null;
    }
  }

  function setPoint(index: number, axis: 'x' | 'y', value: string) {
    const next = [...points];
    const numeric = clampGrid(Number(value), gridSize, snapStep);
    if (!Number.isFinite(numeric)) return;
    next[index] = { ...next[index], [axis]: numeric };
    commit(next);
  }

  function removePoint(index: number) {
    const next = points.filter((_, i) => i !== index);
    commit(next);
  }

  function makeRectangleShape() {
    const length = clampGrid(quickLength, gridSize, snapStep);
    const depth = clampGrid(quickDepth, gridSize, snapStep);
    if (length <= 0 || depth <= 0) return;
    commit([
      { x: 0, y: 0 },
      { x: length, y: 0 },
      { x: length, y: depth },
      { x: 0, y: depth }
    ]);
    onSelectLedgerEdge?.(0);
  }

  function makeLShape() {
    const length = clampGrid(quickLength, gridSize, snapStep);
    const depth = clampGrid(quickDepth, gridSize, snapStep);
    const notchL = clampGrid(notchLength, gridSize, snapStep);
    const notchD = clampGrid(notchDepth, gridSize, snapStep);
    if (length <= 0 || depth <= 0) return;
    if (notchL <= 0 || notchD <= 0 || notchL >= length || notchD >= depth) return;
    // Axis-aligned L shape built from rectangle with a top-right corner cutout.
    commit([
      { x: 0, y: 0 },
      { x: length, y: 0 },
      { x: length, y: depth - notchD },
      { x: length - notchL, y: depth - notchD },
      { x: length - notchL, y: depth },
      { x: 0, y: depth }
    ]);
    onSelectLedgerEdge?.(0);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label">Shape Drawer (click points or generate a quick shape)</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input type="checkbox" checked={snapOrthogonal} onChange={(e) => setSnapOrthogonal(e.target.checked)} />
            Orthogonal Snap
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            Grid
            <select
              className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
              value={snapStep}
              onChange={(e) => setSnapStep(Number(e.target.value))}
            >
              <option value={1}>1.0 ft</option>
              <option value={0.5}>0.5 ft</option>
              <option value={0.25}>0.25 ft</option>
            </select>
          </label>
        </div>
      </div>

      <p className="text-xs text-slate-500">Draw clockwise around perimeter. Drag points to adjust. Shift-click edge to insert a point.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          <p className="text-xs font-semibold text-slate-700">Quick Rectangle</p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1">
              L
              <input
                className="w-14 rounded border border-slate-300 px-1 py-0.5"
                type="number"
                min={1}
                max={gridSize}
                step={snapStep}
                value={quickLength}
                onChange={(e) => setQuickLength(Number(e.target.value))}
              />
            </label>
            <label className="flex items-center gap-1">
              D
              <input
                className="w-14 rounded border border-slate-300 px-1 py-0.5"
                type="number"
                min={1}
                max={gridSize}
                step={snapStep}
                value={quickDepth}
                onChange={(e) => setQuickDepth(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              onClick={makeRectangleShape}
              className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Apply
            </button>
          </div>
        </div>
        <div className="rounded border border-slate-200 bg-slate-50 p-2">
          <p className="text-xs font-semibold text-slate-700">Quick L-Shape</p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1">
              Notch L
              <input
                className="w-14 rounded border border-slate-300 px-1 py-0.5"
                type="number"
                min={1}
                max={gridSize}
                step={snapStep}
                value={notchLength}
                onChange={(e) => setNotchLength(Number(e.target.value))}
              />
            </label>
            <label className="flex items-center gap-1">
              Notch D
              <input
                className="w-14 rounded border border-slate-300 px-1 py-0.5"
                type="number"
                min={1}
                max={gridSize}
                step={snapStep}
                value={notchDepth}
                onChange={(e) => setNotchDepth(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              onClick={makeLShape}
              className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
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
            <line x1={i * cell} y1={0} x2={i * cell} y2={width} stroke={i % 5 === 0 ? '#cbd5e1' : '#e5e7eb'} strokeWidth={i % 5 === 0 ? '1.2' : '1'} />
            <line x1={0} y1={i * cell} x2={width} y2={i * cell} stroke={i % 5 === 0 ? '#cbd5e1' : '#e5e7eb'} strokeWidth={i % 5 === 0 ? '1.2' : '1'} />
          </g>
        ))}
        {cursorPoint && (
          <>
            <line x1={cursorPoint.x * cell} y1={0} x2={cursorPoint.x * cell} y2={width} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
            <line x1={0} y1={cursorPoint.y * cell} x2={width} y2={cursorPoint.y * cell} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
          </>
        )}
        {cursorPoint && points.length > 0 && (
          <line
            x1={points[points.length - 1].x * cell}
            y1={points[points.length - 1].y * cell}
            x2={cursorPoint.x * cell}
            y2={cursorPoint.y * cell}
            stroke="#0f766e"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
        )}

        {points.length > 1 && (
          <>
            <polyline
              points={points.map((p) => `${p.x * cell},${p.y * cell}`).join(' ')}
              fill="none"
              stroke="#18453b"
              strokeWidth="2"
            />
            {points.length > 2 &&
              points.map((p, i) => {
                const next = points[(i + 1) % points.length];
                if (!next) return null;
                return (
                  <line
                    key={`edge-hit-${i}`}
                    x1={p.x * cell}
                    y1={p.y * cell}
                    x2={next.x * cell}
                    y2={next.y * cell}
                    stroke="rgba(0,0,0,0)"
                    strokeWidth="14"
                    onMouseEnter={() => setHoverEdgeIndex(i)}
                    onMouseLeave={() => setHoverEdgeIndex((current) => (current === i ? null : current))}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.shiftKey) {
                        const midX = clampGrid((p.x + next.x) / 2, gridSize, snapStep);
                        const midY = clampGrid((p.y + next.y) / 2, gridSize, snapStep);
                        const inserted = [...points];
                        inserted.splice(i + 1, 0, { x: midX, y: midY });
                        commit(inserted);
                        return;
                      }
                      onSelectLedgerEdge?.(i);
                    }}
                    style={{ cursor: onSelectLedgerEdge ? 'pointer' : 'default' }}
                  />
                );
              })}
          </>
        )}

        {points.length > 2 && (
          <>
            <polygon
              points={points.map((p) => `${p.x * cell},${p.y * cell}`).join(' ')}
              fill="rgba(24,69,59,0.18)"
              stroke="#18453b"
              strokeWidth="2"
            />
            {selectedLedgerEdgeIndex != null &&
              (() => {
                const idx = ((selectedLedgerEdgeIndex % points.length) + points.length) % points.length;
                const a = points[idx];
                const b = points[(idx + 1) % points.length];
                if (!a || !b) return null;
                return (
                  <>
                    <line
                      x1={a.x * cell}
                      y1={a.y * cell}
                      x2={b.x * cell}
                      y2={b.y * cell}
                      stroke="#0f766e"
                      strokeWidth="4"
                    />
                    <text
                      x={((a.x + b.x) / 2) * cell}
                      y={((a.y + b.y) / 2) * cell - 6}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#0f766e"
                    >
                      Ledger edge {idx + 1}
                    </text>
                  </>
                );
              })()}
          </>
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
        {hoverEdgeIndex != null && points.length > 2 && (
          (() => {
            const idx = ((hoverEdgeIndex % points.length) + points.length) % points.length;
            const a = points[idx];
            const b = points[(idx + 1) % points.length];
            if (!a || !b) return null;
            return (
              <line
                x1={a.x * cell}
                y1={a.y * cell}
                x2={b.x * cell}
                y2={b.y * cell}
                stroke="#1d4ed8"
                strokeWidth="3"
                strokeDasharray="4 2"
                pointerEvents="none"
              />
            );
          })()
        )}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-slate-100 px-2 py-1">Points: {points.length}</span>
        <span className="rounded bg-slate-100 px-2 py-1">Area: {area.toFixed(2)} sqft</span>
        <span className="rounded bg-slate-100 px-2 py-1">Perimeter: {perimeter.toFixed(2)} lf</span>
        {cursorPoint && (
          <span className="rounded bg-slate-100 px-2 py-1">Cursor: ({cursorPoint.x.toFixed(2)}, {cursorPoint.y.toFixed(2)})</span>
        )}
        {selectedLedgerEdgeIndex != null && points.length > 2 && (
          <span className="rounded bg-teal-100 px-2 py-1 text-teal-800">
            Ledger edge: {((selectedLedgerEdgeIndex % points.length) + points.length) % points.length + 1}
          </span>
        )}
      </div>
      {points.length > 2 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          {onSelectLedgerEdge && (
            <>
              <span>Ledger edge:</span>
              <select
                className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
                value={selectedLedgerEdgeIndex ?? 0}
                onChange={(e) => onSelectLedgerEdge(Number(e.target.value))}
              >
                {points.map((_, i) => {
                  const a = points[i];
                  const b = points[(i + 1) % points.length];
                  const len = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
                  return (
                    <option key={`edge-opt-${i}`} value={i}>
                      Edge {i + 1} ({len.toFixed(2)} ft)
                    </option>
                  );
                })}
              </select>
            </>
          )}
          <span>Tip: click edge to set ledger, Shift+click edge to insert midpoint.</span>
        </div>
      )}

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
                      step={snapStep}
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
                      step={snapStep}
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
