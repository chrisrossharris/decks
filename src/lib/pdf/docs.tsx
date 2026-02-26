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

function FramingSchematic({ inputs }: { inputs?: any }) {
  if (!inputs) return null;

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
  const joistSpacingIn = Math.max(1, Number(inputs.joist_spacing_in ?? 16));
  const joistCount = Math.max(1, Math.ceil((lengthFt * 12) / joistSpacingIn));
  const beamCount = Math.max(1, Number(inputs.beam_count ?? 1));
  const postSpacingFt = Math.max(1, Number(inputs.post_spacing_ft ?? 6));
  const postCountPerBeam = Math.ceil(lengthFt / postSpacingFt) + 1;
  const postCountTotal = postCountPerBeam * beamCount;

  const x = 36;
  const y = 28;
  const w = 250;
  const h = 130;
  const drawJoists = Math.max(2, Math.min(joistCount, 80));
  const drawBeams = Math.max(1, Math.min(beamCount, 6));
  const drawPosts = Math.max(2, Math.min(postCountPerBeam, 40));
  const beamSpacingFt = widthFt / (beamCount + 1);

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
              <Line x1={x} y1={y + 17} x2={x + w / (drawJoists - 1)} y2={y + 17} stroke="#334155" strokeWidth={1} />
              <Line x1={x} y1={y + 14} x2={x} y2={y + 20} stroke="#334155" strokeWidth={1} />
              <Line
                x1={x + w / (drawJoists - 1)}
                y1={y + 14}
                x2={x + w / (drawJoists - 1)}
                y2={y + 20}
                stroke="#334155"
                strokeWidth={1}
              />
              <Text style={{ fontSize: 8 }} x={x + w / (drawJoists - 1) / 2 - 16} y={y + 13}>
                {`${joistSpacingIn}" O.C.`}
              </Text>
            </>
          ) : null}

          {inputs.ledger ? (
            <Line x1={x} y1={y} x2={x + w} y2={y} stroke="#0f766e" strokeWidth={3} />
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
          Joists: {joistCount} @ {joistSpacingIn}" O.C. | Ledger: {inputs.ledger ? 'Yes' : 'No'} | Beams: {beamCount} | Structural posts: {postCountTotal} ({postCountPerBeam}/beam)
        </Text>
        <Text style={styles.caption}>
          Post spacing: ~{postSpacingFt.toFixed(1)} ft | Beam spacing: ~{beamSpacingFt.toFixed(1)} ft
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
              <Text style={styles.caption}>Structural post</Text>
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

export function ClientProposalPdf({ project, estimate }: { project: any; estimate: any }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Client Proposal - {project.name}</Text>
        <View style={styles.section}>
          <Text>Scope Summary</Text>
          <Text>- Build deck/covered deck per approved design inputs and site constraints.</Text>
          <Text>- Includes framing, decking, rails, stairs, and optional cover components.</Text>
        </View>
        <View style={styles.section}>
          <Text>Timeline (placeholder): 2-4 weeks from signed approval and material release.</Text>
        </View>
        <View style={styles.section}>
          <Text>Total Proposed Price: {money(estimate.grand_total)}</Text>
        </View>
        <View style={styles.section}>
          <Text>Payment Schedule (placeholder)</Text>
          <Text>- 40% deposit</Text>
          <Text>- 40% mid-project draw</Text>
          <Text>- 20% at substantial completion</Text>
        </View>
      </Page>
    </Document>
  );
}
