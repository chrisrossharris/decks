import React from 'react';
import { Circle, Document, Line, Page, Path, Rect, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 11 },
  h1: { fontSize: 18, marginBottom: 10 },
  section: { marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', borderBottom: '1px solid #ddd', paddingVertical: 4 },
  diagramBox: { border: '1px solid #ddd', padding: 8, marginTop: 6 },
  caption: { fontSize: 9, color: '#555', marginTop: 4 }
});

const money = (value: unknown) => {
  const n = Number(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(n) ? n : 0);
};

function toPolygonPath(
  points: Array<{ x: number; y: number }>,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  frame: { x: number; y: number; w: number; h: number }
) {
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const sx = frame.w / spanX;
  const sy = frame.h / spanY;

  return points
    .map((p, i) => {
      const px = frame.x + (p.x - bounds.minX) * sx;
      const py = frame.y + frame.h - (p.y - bounds.minY) * sy;
      return `${i === 0 ? 'M' : 'L'} ${px} ${py}`;
    })
    .join(' ')
    .concat(' Z');
}

function toPolygonScreenPoints(
  points: Array<{ x: number; y: number }>,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  frame: { x: number; y: number; w: number; h: number }
) {
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const sx = frame.w / spanX;
  const sy = frame.h / spanY;
  return points.map((p) => ({
    x: frame.x + (p.x - bounds.minX) * sx,
    y: frame.y + frame.h - (p.y - bounds.minY) * sy
  }));
}

function computePerimeterPointsRect(
  targetCount: number,
  lengthFt: number,
  widthFt: number,
  frame: { x0: number; x1: number; y0: number; y1: number },
  options?: { excludeSide?: 'top' | 'right' | 'bottom' | 'left' | null }
) {
  const corners = [
    { x: frame.x0, y: frame.y1 }, // bottom-left
    { x: frame.x1, y: frame.y1 }, // bottom-right
    { x: frame.x1, y: frame.y0 }, // top-right (ledger corner)
    { x: frame.x0, y: frame.y0 } // top-left (ledger corner)
  ];
  const target = Math.max(0, Math.min(80, Math.floor(targetCount)));
  if (target <= 0) return [] as Array<{ x: number; y: number }>;
  if (target <= 4) return corners.slice(0, target);

  const perimeterFt = Math.max(1, Math.max(lengthFt, 1) + 2 * Math.max(widthFt, 1));
  const remaining = target - 4;
  const allSides = [
    { key: 'bottom', len: Math.max(lengthFt, 1), start: corners[0], end: corners[1] },
    { key: 'right', len: Math.max(widthFt, 1), start: corners[1], end: corners[2] },
    { key: 'top', len: Math.max(lengthFt, 1), start: corners[3], end: corners[2] },
    { key: 'left', len: Math.max(widthFt, 1), start: corners[3], end: corners[0] }
  ];
  const sideDefs = allSides.filter((s) => s.key !== options?.excludeSide);

  const quotas = sideDefs.map((s) => (remaining * s.len) / perimeterFt);
  const extras = quotas.map((q) => Math.floor(q));
  let allocated = extras.reduce((sum, n) => sum + n, 0);
  const remainders = quotas.map((q, i) => ({ i, rem: q - Math.floor(q) })).sort((a, b) => b.rem - a.rem);
  for (let r = 0; allocated < remaining && r < remainders.length; r += 1) {
    extras[remainders[r].i] += 1;
    allocated += 1;
  }

  const points: Array<{ x: number; y: number }> = [...corners];
  for (let sideIndex = 0; sideIndex < sideDefs.length; sideIndex += 1) {
    const side = sideDefs[sideIndex];
    const count = extras[sideIndex];
    for (let i = 1; i <= count; i += 1) {
      const t = i / (count + 1);
      points.push({
        x: side.start.x + (side.end.x - side.start.x) * t,
        y: side.start.y + (side.end.y - side.start.y) * t
      });
    }
  }

  return points.slice(0, target);
}

function polylinePath(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

function FramingSchematic({ inputs }: { inputs?: any }) {
  if (!inputs) return null;
  if (String(inputs.design_mode ?? 'deck') === 'fence') {
    const fenceLayout = String(inputs.fence_layout ?? 'straight');
    const sideA = Math.max(0, Number(inputs.fence_side_a_ft ?? 0));
    const sideB = Math.max(0, Number(inputs.fence_side_b_ft ?? 0));
    const sideC = Math.max(0, Number(inputs.fence_side_c_ft ?? 0));
    const fenceHeight = Math.max(0, Number(inputs.fence_height_ft ?? 0));
    const fenceLengthFallback = Math.max(0, Number(inputs.fence_length_ft ?? 0));
    const segments = (() => {
      if (fenceLayout === 'corner' && sideA > 0 && sideB > 0) return [sideA, sideB];
      if (fenceLayout === 'u_shape' && sideA > 0 && sideB > 0 && sideC > 0) return [sideA, sideB, sideC];
      return [fenceLengthFallback];
    })();
    const fenceLength = segments.reduce((sum, value) => sum + Math.max(0, value), 0) || fenceLengthFallback;
    const postSpacing = Math.max(1, Number(inputs.fence_post_spacing_ft ?? 8));
    const postCount = Math.max(2, Math.ceil(fenceLength / postSpacing) + 1);
    const gateCount = Math.max(0, Number(inputs.fence_gate_count ?? 0));
    const railCount = Math.max(1, Number(inputs.fence_rail_count ?? 2));
    const plot = (() => {
      const left = 28;
      const right = 292;
      const bottom = 86;
      const top = 24;
      const width = right - left;
      const height = bottom - top;
      if (segments.length === 1) return [{ x: left, y: 55 }, { x: right, y: 55 }];
      if (segments.length === 2) {
        const scale = Math.min(width / Math.max(segments[0], 1), height / Math.max(segments[1], 1));
        const a = segments[0] * scale;
        const b = segments[1] * scale;
        return [
          { x: left, y: bottom },
          { x: left + a, y: bottom },
          { x: left + a, y: bottom - b }
        ];
      }
      const horiz = segments[0] + segments[2];
      const scale = Math.min(width / Math.max(horiz, 1), height / Math.max(segments[1], 1));
      const a = segments[0] * scale;
      const b = segments[1] * scale;
      const c = segments[2] * scale;
      return [
        { x: left, y: bottom },
        { x: left + a, y: bottom },
        { x: left + a, y: bottom - b },
        { x: left + a + c, y: bottom - b }
      ];
    })();
    const fencePath = polylinePath(plot);
    const postMarkers = (() => {
      const markers: Array<{ x: number; y: number }> = [];
      let total = 0;
      const segLens: number[] = [];
      for (let i = 1; i < plot.length; i += 1) {
        const a = plot[i - 1];
        const b = plot[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        segLens.push(len);
        total += len;
      }
      if (total <= 0) return markers;
      for (let i = 0; i < postCount; i += 1) {
        const target = (i / Math.max(postCount - 1, 1)) * total;
        let remain = target;
        for (let seg = 0; seg < segLens.length; seg += 1) {
          if (remain <= segLens[seg] || seg === segLens.length - 1) {
            const start = plot[seg];
            const end = plot[seg + 1];
            const t = segLens[seg] > 0 ? remain / segLens[seg] : 0;
            markers.push({
              x: start.x + (end.x - start.x) * t,
              y: start.y + (end.y - start.y) * t
            });
            break;
          }
          remain -= segLens[seg];
        }
      }
      return markers;
    })();

    return (
      <View style={styles.section}>
        <Text>Fence Diagram (conceptual)</Text>
        <View style={styles.diagramBox}>
          <Svg width={340} height={160}>
            <Path d={fencePath} stroke="#7c2d12" strokeWidth={2.5} fill="none" />
            {postMarkers.map((p, i) => (
              <Line key={`post-${i}`} x1={p.x} y1={p.y - 10} x2={p.x} y2={p.y + 10} stroke="#1d4ed8" strokeWidth={2} />
            ))}
            <Text style={{ fontSize: 8 }} x={28} y={120}>{`Fence run: ${fenceLength.toFixed(1)} lf`}</Text>
            <Text style={{ fontSize: 8 }} x={28} y={132}>{`Fence height: ${fenceHeight.toFixed(1)} ft`}</Text>
            <Text style={{ fontSize: 8 }} x={28} y={144}>{`Posts: ${postCount} • Rails: ${railCount} • Gates: ${gateCount}`}</Text>
          </Svg>
          <Text style={styles.caption}>
            Fence material: {String(inputs.fence_material ?? 'wood')} | Style: {String(inputs.fence_style ?? 'privacy')} | Layout: {fenceLayout === 'u_shape' ? 'U-shape' : fenceLayout === 'corner' ? 'Corner (L)' : 'Straight'} | Post spacing: {postSpacing.toFixed(1)} ft
          </Text>
        </View>
      </View>
    );
  }

  const polygonPoints = Array.isArray(inputs.deck_polygon_points)
    ? inputs.deck_polygon_points
        .map((p: any) => ({ x: Number(p?.x), y: Number(p?.y) }))
        .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y))
    : [];
  const isPolygon = inputs.shape_mode === 'polygon' && polygonPoints.length >= 3;

  const polyBounds = isPolygon
    ? {
        minX: Math.min(...polygonPoints.map((p: any) => p.x)),
        maxX: Math.max(...polygonPoints.map((p: any) => p.x)),
        minY: Math.min(...polygonPoints.map((p: any) => p.y)),
        maxY: Math.max(...polygonPoints.map((p: any) => p.y))
      }
    : null;

  const lengthFt = Math.max(
    1,
    Number(isPolygon && polyBounds ? polyBounds.maxX - polyBounds.minX : inputs.deck_length_ft ?? 0)
  );
  const widthFt = Math.max(
    1,
    Number(isPolygon && polyBounds ? polyBounds.maxY - polyBounds.minY : inputs.deck_width_ft ?? 0)
  );
  const joistSpacingInInput = Math.max(1, Number(inputs.joist_spacing_in ?? 16));
  const joistSpacingIn = String(inputs.decking_material ?? '') === 'composite'
    ? Math.min(joistSpacingInInput, 12)
    : joistSpacingInInput;
  const joistCount = Math.max(2, Math.ceil((lengthFt * 12) / joistSpacingIn));
  const ledgerSideRaw = String(inputs.ledger_side ?? 'top').toLowerCase();
  const ledgerSide = (ledgerSideRaw === 'right' || ledgerSideRaw === 'bottom' || ledgerSideRaw === 'left') ? ledgerSideRaw : 'top';
  const ledgerLineIndexRaw = Number(inputs.ledger_line_index ?? -1);
  const ledgerLineIndex = isPolygon && Number.isFinite(ledgerLineIndexRaw) && ledgerLineIndexRaw >= 0
    ? Math.floor(ledgerLineIndexRaw) % Math.max(1, polygonPoints.length)
    : null;
  const polygonHouseSideLengthFt = isPolygon && ledgerLineIndex !== null
    ? Math.hypot(
        (polygonPoints[(ledgerLineIndex + 1) % polygonPoints.length]?.x ?? 0) - (polygonPoints[ledgerLineIndex]?.x ?? 0),
        (polygonPoints[(ledgerLineIndex + 1) % polygonPoints.length]?.y ?? 0) - (polygonPoints[ledgerLineIndex]?.y ?? 0)
      )
    : 0;
  const houseSideLengthFt = isPolygon
    ? polygonHouseSideLengthFt
    : (ledgerSide === 'left' || ledgerSide === 'right') ? Math.max(widthFt, 0) : Math.max(lengthFt, 0);
  const assumptionConstants = (() => {
    const rawAssumptions = (inputs as any).takeoff_assumptions_json;
    if (!rawAssumptions) return {};
    if (typeof rawAssumptions === 'string') {
      try {
        const parsed = JSON.parse(rawAssumptions);
        return typeof parsed?.constants === 'object' && parsed.constants ? parsed.constants : {};
      } catch {
        return {};
      }
    }
    return typeof rawAssumptions?.constants === 'object' && rawAssumptions.constants ? rawAssumptions.constants : {};
  })();

  const beamCountInput = Math.max(1, Number(inputs.beam_count ?? 1));
  const beamCountEffective = Number((assumptionConstants as any).effective_beam_count ?? 0);
  const beamCount = Number.isFinite(beamCountEffective) && beamCountEffective > 0 ? beamCountEffective : beamCountInput;
  const postSpacingFt = Math.max(1, Number(inputs.post_spacing_ft ?? 6));
  const postCountPerBeamRaw = Number((assumptionConstants as any).post_count_per_beam ?? 0);
  const postCountPerBeam = Number.isFinite(postCountPerBeamRaw) && postCountPerBeamRaw > 0
    ? postCountPerBeamRaw
    : Math.ceil(lengthFt / postSpacingFt) + 1;
  const postCountTotalRaw = Number((assumptionConstants as any).beam_support_post_count ?? 0);
  const postCountTotal = Number.isFinite(postCountTotalRaw) && postCountTotalRaw > 0
    ? postCountTotalRaw
    : postCountPerBeam * beamCount;
  const defaultRailingPostSpacingFtRaw = Number((assumptionConstants as any).default_railing_post_spacing_ft ?? 0);
  const defaultRailingPostSpacingFt = Number.isFinite(defaultRailingPostSpacingFtRaw) && defaultRailingPostSpacingFtRaw > 0
    ? defaultRailingPostSpacingFtRaw
    : 6;
  const stairOpeningLf = Math.max(0, Number(inputs.stair_count ?? 0) * Number(inputs.stair_width_ft ?? 0));
  const openRunFallback = Math.max(
    0,
    (inputs.ledger ? Math.max((2 * (Math.max(lengthFt, 0) + Math.max(widthFt, 0))) - houseSideLengthFt, 0) : (2 * (Math.max(lengthFt, 0) + Math.max(widthFt, 0)))) - stairOpeningLf
  );
  const railingSupportRunLfRaw = Number((assumptionConstants as any).railing_support_run_lf ?? 0);
  const railingSupportRunLf = Number.isFinite(railingSupportRunLfRaw) && railingSupportRunLfRaw > 0
    ? railingSupportRunLfRaw
    : openRunFallback;
  const perimeterSupportPostsRaw = Number((assumptionConstants as any).perimeter_railing_support_post_count ?? 0);
  const perimeterSupportPosts = Number.isFinite(perimeterSupportPostsRaw) && perimeterSupportPostsRaw > 0
    ? perimeterSupportPostsRaw
    : Math.max(0, Math.ceil(railingSupportRunLf / defaultRailingPostSpacingFt) + 1);

  const frameOriginX = 36;
  const frameOriginY = 28;
  const frameMaxW = 250;
  const frameMaxH = 130;
  const scale = Math.min(frameMaxW / Math.max(lengthFt, 1), frameMaxH / Math.max(widthFt, 1));
  const w = Math.max(50, Math.min(frameMaxW, Math.max(lengthFt, 1) * scale));
  const h = Math.max(50, Math.min(frameMaxH, Math.max(widthFt, 1) * scale));
  const x = frameOriginX + (frameMaxW - w) / 2;
  const y = frameOriginY + (frameMaxH - h) / 2;
  const drawJoists = Math.max(2, Math.min(joistCount, 80));
  const drawBeams = Math.max(1, Math.min(beamCount, 6));
  const drawPosts = Math.max(2, Math.min(Math.ceil(postCountTotal / Math.max(beamCount, 1)), 40));
  const beamSpacingFt = widthFt / (beamCount + 1);
  const perimeterPoints = isPolygon
    ? toPolygonScreenPoints(polygonPoints, polyBounds!, { x, y, w, h })
    : computePerimeterPointsRect(
        perimeterSupportPosts,
        lengthFt,
        widthFt,
        { x0: x, x1: x + w, y0: y, y1: y + h },
        { excludeSide: inputs.ledger ? (ledgerSide as 'top' | 'right' | 'bottom' | 'left') : null }
      );
  const ledgerLine = (() => {
    if (!inputs.ledger) return null;
    if (isPolygon && polyBounds && ledgerLineIndex !== null) {
      const screenPoints = toPolygonScreenPoints(polygonPoints, polyBounds, { x, y, w, h });
      const a = screenPoints[ledgerLineIndex];
      const b = screenPoints[(ledgerLineIndex + 1) % screenPoints.length];
      if (!a || !b) return null;
      return { x1: a.x, y1: a.y, x2: b.x, y2: b.y, lx: (a.x + b.x) / 2 - 42, ly: (a.y + b.y) / 2 - 8 };
    }
    if (ledgerSide === 'right') return { x1: x + w, y1: y, x2: x + w, y2: y + h, lx: x + w - 42, ly: y - 8 };
    if (ledgerSide === 'bottom') return { x1: x, y1: y + h, x2: x + w, y2: y + h, lx: x, ly: y + h + 12 };
    if (ledgerSide === 'left') return { x1: x, y1: y, x2: x, y2: y + h, lx: x, ly: y - 8 };
    return { x1: x, y1: y, x2: x + w, y2: y, lx: x, ly: y - 8 };
  })();

  return (
    <View style={styles.section}>
      <Text>Framing Diagram (conceptual, not structural)</Text>
      <View style={styles.diagramBox}>
        <Svg width={340} height={230}>
          {isPolygon && polyBounds ? (
            <Path d={toPolygonPath(polygonPoints, polyBounds, { x, y, w, h })} stroke="#222" strokeWidth={1.5} fill="none" />
          ) : (
            <Rect x={x} y={y} width={w} height={h} stroke="#222" strokeWidth={1.5} fill="none" />
          )}

          <Line x1={x} y1={y + h + 22} x2={x + w} y2={y + h + 22} stroke="#334155" strokeWidth={1} />
          <Line x1={x} y1={y + h + 19} x2={x} y2={y + h + 25} stroke="#334155" strokeWidth={1} />
          <Line x1={x + w} y1={y + h + 19} x2={x + w} y2={y + h + 25} stroke="#334155" strokeWidth={1} />
          <Rect x={x + w / 2 - 42} y={y + h + 30} width={84} height={11} fill="#fff" />
          <Text style={{ fontSize: 8 }} x={x + w / 2 - 36} y={y + h + 38}>
            {`Length: ${lengthFt.toFixed(1)} ft`}
          </Text>

          <Line x1={x - 18} y1={y} x2={x - 18} y2={y + h} stroke="#334155" strokeWidth={1} />
          <Line x1={x - 21} y1={y} x2={x - 15} y2={y} stroke="#334155" strokeWidth={1} />
          <Line x1={x - 21} y1={y + h} x2={x - 15} y2={y + h} stroke="#334155" strokeWidth={1} />
          <Rect x={x - 14} y={y - 16} width={62} height={11} fill="#fff" />
          <Text style={{ fontSize: 8 }} x={x - 12} y={y - 8}>
            {`Width: ${widthFt.toFixed(1)} ft`}
          </Text>

          {Array.from({ length: drawJoists }).map((_, i) => {
            const px = x + (w * i) / (drawJoists - 1);
            return <Line key={`joist-${i}`} x1={px} y1={y} x2={px} y2={y + h} stroke="#94a3b8" strokeWidth={0.8} />;
          })}
          {drawJoists > 1 ? (
            <>
              <Line x1={x} y1={y + h + 8} x2={x + w / (drawJoists - 1)} y2={y + h + 8} stroke="#334155" strokeWidth={1} />
              <Line x1={x} y1={y + h + 5} x2={x} y2={y + h + 11} stroke="#334155" strokeWidth={1} />
              <Line
                x1={x + w / (drawJoists - 1)}
                y1={y + h + 5}
                x2={x + w / (drawJoists - 1)}
                y2={y + h + 11}
                stroke="#334155"
                strokeWidth={1}
              />
              <Rect x={x + w / (drawJoists - 1) / 2 - 17} y={y + h + 12} width={34} height={10} fill="#fff" />
              <Text style={{ fontSize: 8 }} x={x + w / (drawJoists - 1) / 2 - 16} y={y + h + 19}>
                {`${joistSpacingIn}" O.C.`}
              </Text>
            </>
          ) : null}

          {ledgerLine ? <Line x1={ledgerLine.x1} y1={ledgerLine.y1} x2={ledgerLine.x2} y2={ledgerLine.y2} stroke="#0f766e" strokeWidth={3} /> : null}
          {ledgerLine ? (
            <Text style={{ fontSize: 8 }} x={ledgerLine.lx} y={ledgerLine.ly}>
              {`Ledger ${isPolygon ? `edge ${Number(ledgerLineIndex ?? 0) + 1}` : `side (${ledgerSide})`}`}
            </Text>
          ) : null}

          {Array.from({ length: drawBeams }).map((_, b) => {
            const py = y + h - (h * (b + 1)) / (drawBeams + 1);
            return <Line key={`beam-${b}`} x1={x} y1={py} x2={x + w} y2={py} stroke="#7c2d12" strokeWidth={2} />;
          })}

          {Array.from({ length: drawBeams }).flatMap((_, b) => {
            const py = y + h - (h * (b + 1)) / (drawBeams + 1);
            return Array.from({ length: drawPosts }).map((__, p) => {
              const px = x + (w * p) / (drawPosts - 1);
              return <Circle key={`post-${b}-${p}`} cx={px} cy={py} r={2.8} fill="#1d4ed8" />;
            });
          })}
          {perimeterPoints.map((pt, i) => (
            <Circle key={`rail-post-${i}`} cx={pt.x} cy={pt.y} r={2.4} stroke="#1d4ed8" strokeWidth={1} fill="#ffffff" />
          ))}

          {isPolygon && polyBounds
            ? toPolygonScreenPoints(polygonPoints, polyBounds, { x, y, w, h }).map((pt, i) => (
                <Circle key={`corner-${i}`} cx={pt.x} cy={pt.y} r={2.6} stroke="#64748b" strokeWidth={1} fill="#ffffff" />
              ))
            : (
              <>
                <Circle cx={x} cy={y} r={2.6} stroke="#64748b" strokeWidth={1} fill="#ffffff" />
                <Circle cx={x + w} cy={y} r={2.6} stroke="#64748b" strokeWidth={1} fill="#ffffff" />
                <Circle cx={x} cy={y + h} r={2.6} stroke="#64748b" strokeWidth={1} fill="#ffffff" />
                <Circle cx={x + w} cy={y + h} r={2.6} stroke="#64748b" strokeWidth={1} fill="#ffffff" />
              </>
            )}
        </Svg>
        <Text style={styles.caption}>
          Joists: {joistCount} @ {joistSpacingIn}" O.C. | Ledger: {inputs.ledger ? 'Yes' : 'No'} | Beams: {beamCount}{beamCount !== beamCountInput ? ` (auto from ${beamCountInput})` : ''} | Beam support posts: {postCountTotal} ({Math.ceil(postCountTotal / Math.max(beamCount, 1))}/beam)
        </Text>
        <Text style={styles.caption}>
          Perimeter railing support posts: {perimeterSupportPosts} (open run {railingSupportRunLf.toFixed(0)} lf @ max {defaultRailingPostSpacingFt.toFixed(0)}ft, no ledger-edge posts on {isPolygon ? `edge ${Number(ledgerLineIndex ?? 0) + 1}` : ledgerSide})
        </Text>
        <Text style={styles.caption}>
          Beam post spacing: ~{postSpacingFt.toFixed(1)} ft | Beam spacing: ~{beamSpacingFt.toFixed(1)} ft
        </Text>
        <View style={{ marginTop: 6 }}>
          <Text style={styles.caption}>Legend:</Text>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 14, height: 2, backgroundColor: '#94a3b8', marginRight: 4 }} />
              <Text style={styles.caption}>Joist</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 14, height: 3, backgroundColor: '#7c2d12', marginRight: 4 }} />
              <Text style={styles.caption}>Beam</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 14, height: 3, backgroundColor: '#0f766e', marginRight: 4 }} />
              <Text style={styles.caption}>Ledger</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#1d4ed8', marginRight: 4 }} />
              <Text style={styles.caption}>Beam support post</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderStyle: 'solid', borderColor: '#1d4ed8', backgroundColor: '#ffffff', marginRight: 4 }} />
              <Text style={styles.caption}>Perimeter railing support post</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderStyle: 'solid', borderColor: '#64748b', backgroundColor: '#ffffff', marginRight: 4 }} />
              <Text style={styles.caption}>Deck corners / shape points</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function MaterialsPdf({ project, items, inputs }: { project: any; items: any[]; inputs?: any }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Materials List - {project.name}</Text>
        <FramingSchematic inputs={inputs} />
        <View style={styles.section}>
          {items.map((item) => (
            <View style={styles.row} key={item.id}>
              <Text>{item.category} - {item.name}</Text>
              <Text>{Number(item.qty).toFixed(2)} {item.unit}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

export function InternalEstimatePdf({ project, estimate, labor, items, inputs }: { project: any; estimate: any; labor: any; items: any[]; inputs?: any }) {
  const isCovered = Boolean(inputs?.is_covered);
  const roofTypeLabel = String(inputs?.roof_type ?? 'shed') === 'gable' ? 'Gable' : 'Lean-to';
  const roofPitch = String(inputs?.roof_pitch ?? '4:12');
  const roofMaterial = String(inputs?.roofing_material ?? 'shingle');
  const roofProductType = String(inputs?.roofing_product_type ?? '').trim();
  const roofColor = String(inputs?.roofing_color ?? '').trim();
  const ceilingFinish = String(inputs?.ceiling_finish ?? 'none');
  const fanPlateCount = Math.max(0, Number(inputs?.ceiling_fan_plate_count ?? 0));
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Internal Estimate - {project.name}</Text>
        <FramingSchematic inputs={inputs} />
        <View style={styles.section}>
          <Text>Materials: {money(estimate.subtotal_materials)}</Text>
          <Text>Labor: {money(estimate.subtotal_labor)}</Text>
          <Text>Overhead: {money(estimate.overhead_amount)}</Text>
          <Text>Profit: {money(estimate.profit_amount)}</Text>
          <Text>Tax: {money(estimate.tax_amount)}</Text>
          <Text>Total: {money(estimate.grand_total)}</Text>
        </View>
        {isCovered ? (
          <View style={styles.section}>
            <Text>Covered Deck Package</Text>
            <Text>{`Roof style: ${roofTypeLabel} • pitch ${roofPitch}`}</Text>
            <Text>{`Roofing: ${roofMaterial}${roofProductType ? ` • ${roofProductType}` : ''}${roofColor ? ` • ${roofColor}` : ''}`}</Text>
            <Text>{`Ceiling: ${ceilingFinish}${fanPlateCount > 0 ? ` • fan plates ${fanPlateCount}` : ''}`}</Text>
          </View>
        ) : null}
        <View style={styles.section}>
          <Text>Labor Breakdown</Text>
          {(labor.tasks ?? []).map((task: any) => (
            <View style={styles.row} key={task.key}><Text>{task.task}</Text><Text>{task.hours}h / {money(task.cost)}</Text></View>
          ))}
        </View>
        <View style={styles.section}>
          <Text>Material Lines: {items.length}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function ClientProposalPdf({ project, estimate, inputs }: { project: any; estimate: any; inputs?: any }) {
  const isFence = String(project?.type ?? '') === 'fence';
  const isCovered = !isFence && Boolean(inputs?.is_covered);
  const roofTypeLabel = String(inputs?.roof_type ?? 'shed') === 'gable' ? 'Gable' : 'Lean-to';
  const roofPitch = String(inputs?.roof_pitch ?? '4:12');
  const roofMaterial = String(inputs?.roofing_material ?? 'shingle');
  const roofProductType = String(inputs?.roofing_product_type ?? '').trim();
  const roofColor = String(inputs?.roofing_color ?? '').trim();
  const ceilingFinish = String(inputs?.ceiling_finish ?? 'none');
  const fanPlateCount = Math.max(0, Number(inputs?.ceiling_fan_plate_count ?? 0));
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Client Proposal - {project.name}</Text>
        <FramingSchematic inputs={inputs} />
        <View style={styles.section}>
          <Text>Scope Summary</Text>
          {isFence ? (
            <>
              <Text>- Install fence per approved layout, style, and site constraints.</Text>
              <Text>- Includes posts/footings, rails or panels/pickets, hardware, and gate installation as listed.</Text>
              <Text>- Utility locates, survey line confirmation, and permit requirements are owner/site dependent unless noted.</Text>
            </>
          ) : (
            <>
              <Text>- Build deck/covered deck per approved design inputs and site constraints.</Text>
              <Text>- Includes framing, decking, rails, stairs, and optional cover components.</Text>
            </>
          )}
        </View>
        {isCovered ? (
          <View style={styles.section}>
            <Text>Covered Deck Package</Text>
            <Text>{`Roof style: ${roofTypeLabel} • pitch ${roofPitch}`}</Text>
            <Text>{`Roofing: ${roofMaterial}${roofProductType ? ` • ${roofProductType}` : ''}${roofColor ? ` • ${roofColor}` : ''}`}</Text>
            <Text>{`Ceiling: ${ceilingFinish}${fanPlateCount > 0 ? ` • fan plates ${fanPlateCount}` : ''}`}</Text>
          </View>
        ) : null}
        <View style={styles.section}>
          <Text>
            Timeline (placeholder): {isFence ? '1-3 weeks' : '2-4 weeks'} from signed approval and material release.
          </Text>
        </View>
        <View style={styles.section}>
          <Text>Total Proposed Price: {money(estimate.grand_total)}</Text>
        </View>
        <View style={styles.section}>
          <Text>Payment Schedule (placeholder)</Text>
          {isFence ? (
            <>
              <Text>- 50% deposit</Text>
              <Text>- 40% at posts/set + framing complete</Text>
              <Text>- 10% at substantial completion</Text>
            </>
          ) : (
            <>
              <Text>- 40% deposit</Text>
              <Text>- 40% mid-project draw</Text>
              <Text>- 20% at substantial completion</Text>
            </>
          )}
        </View>
      </Page>
    </Document>
  );
}
