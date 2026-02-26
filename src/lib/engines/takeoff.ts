import type { DesignInputs, TakeoffAssumptionOverrides, TakeoffItem, TakeoffResult } from '@/lib/types/domain';
import { lookupPrice } from './priceBook';

const SCREW_BOX_PER_100_SQFT = 1;
const DEFAULT_WASTE = 0.1;
const MAX_JOIST_SPAN_FT = 10;
const COMPOSITE_JOIST_SPACING_IN = 12;
const DEFAULT_RAILING_POST_SPACING_FT = 6;
const DEFAULT_BAGS_PER_FOOTING = 2;
const AVAILABLE_BOARD_LENGTHS_FT = [8, 10, 12, 14, 16];
const AVAILABLE_FRAMING_LENGTHS_FT = [8, 10, 12, 14, 16];

const round2 = (n: number) => Math.round(n * 100) / 100;
const ceil = (n: number) => Math.ceil(n);

function polygonArea(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function polygonPerimeter(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

function polygonBounds(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    length_ft: Math.max(...xs) - Math.min(...xs),
    width_ft: Math.max(...ys) - Math.min(...ys)
  };
}

function polygonAverageWidth(areaSqft: number, lengthFt: number) {
  const safeLength = Math.max(1, lengthFt);
  return Math.max(1, areaSqft / safeLength);
}

function withPrice(base: Omit<TakeoffItem, 'unit_cost' | 'vendor' | 'is_allowance'>): TakeoffItem {
  const price = lookupPrice(base.name);
  return {
    ...base,
    unit_cost: price.unit_cost,
    vendor: price.vendor ?? null,
    is_allowance: price.is_allowance ?? false
  };
}

function bestBoardMixForRun(runLengthFt: number, availableLengthsFt: number[]) {
  const target = Math.max(1, ceil(runLengthFt * 10));
  const lengths = availableLengthsFt.map((v) => Math.round(v * 10)).sort((a, b) => a - b);
  const maxLen = lengths[lengths.length - 1] ?? 160;
  const limit = target + maxLen;

  const pieces = Array(limit + 1).fill(Number.POSITIVE_INFINITY);
  const prev = Array(limit + 1).fill(-1);
  const used = Array(limit + 1).fill(-1);
  pieces[0] = 0;

  for (let total = 1; total <= limit; total += 1) {
    for (const len of lengths) {
      const from = total - len;
      if (from >= 0 && Number.isFinite(pieces[from])) {
        const candidate = pieces[from] + 1;
        if (candidate < pieces[total]) {
          pieces[total] = candidate;
          prev[total] = from;
          used[total] = len;
        }
      }
    }
  }

  let bestTotal = -1;
  let bestOver = Number.POSITIVE_INFINITY;
  let bestPieces = Number.POSITIVE_INFINITY;
  for (let total = target; total <= limit; total += 1) {
    if (!Number.isFinite(pieces[total])) continue;
    const over = total - target;
    if (over < bestOver || (over === bestOver && pieces[total] < bestPieces)) {
      bestOver = over;
      bestPieces = pieces[total];
      bestTotal = total;
    }
  }

  const counts = new Map<number, number>();
  let cursor = bestTotal;
  while (cursor > 0 && prev[cursor] >= 0) {
    const len = used[cursor] / 10;
    counts.set(len, (counts.get(len) ?? 0) + 1);
    cursor = prev[cursor];
  }

  return {
    counts,
    run_overage_ft: round2((bestTotal - target) / 10)
  };
}

function accumulateStockMix(
  runsFt: number[],
  repeatCount: number,
  stockLengthsFt: number[]
) {
  const totals = new Map<number, number>();
  let overage = 0;
  for (const run of runsFt) {
    const mix = bestBoardMixForRun(run, stockLengthsFt);
    overage += mix.run_overage_ft * repeatCount;
    for (const [lengthFt, count] of mix.counts.entries()) {
      totals.set(lengthFt, (totals.get(lengthFt) ?? 0) + count * repeatCount);
    }
  }
  return { totals, overage_ft: round2(overage) };
}

function formatStockMix(mix: Map<number, number>) {
  const entries = [...mix.entries()].sort((a, b) => b[0] - a[0]);
  if (entries.length === 0) return 'no stock lengths';
  return entries.map(([length, qty]) => `${length}ft x ${qty}`).join(', ');
}

export function generateTakeoff(inputs: DesignInputs, overrides?: TakeoffAssumptionOverrides): TakeoffResult {
  const maxJoistSpanFt = overrides?.max_joist_span_ft ?? MAX_JOIST_SPAN_FT;
  const compositeJoistSpacingIn = overrides?.composite_joist_spacing_in ?? COMPOSITE_JOIST_SPACING_IN;
  const railingPostSpacingFt = overrides?.railing_post_spacing_ft ?? DEFAULT_RAILING_POST_SPACING_FT;
  const beamDoublePlyLengthFt = overrides?.beam_double_ply_length_ft ?? 14;
  const beamTriplePlyLengthFt = overrides?.beam_triple_ply_length_ft ?? 24;

  if (inputs.design_mode === 'fence') {
    const fenceLengthFt = inputs.fence_length_ft ?? 0;
    const fenceSpacingFt = inputs.fence_post_spacing_ft ?? 8;
    const fenceRailCount = inputs.fence_rail_count ?? 2;
    const gateCount = inputs.fence_gate_count ?? 0;
    const gateWidthFt = inputs.fence_gate_width_ft ?? 4;
    const style = inputs.fence_style ?? 'privacy';
    const picketWidthIn = inputs.fence_picket_width_in ?? 5.5;
    const picketGapIn = inputs.fence_picket_gap_in ?? 0.5;

    const linePosts = ceil(fenceLengthFt / fenceSpacingFt) + 1;
    const gatePosts = gateCount * 2;
    const postCount = linePosts + gatePosts;
    const concreteBags = postCount * 2;
    const railLf = fenceLengthFt * fenceRailCount;
    const picketCount = style === 'panel'
      ? 0
      : ceil((fenceLengthFt * 12) / Math.max(picketWidthIn + picketGapIn, 0.25));
    const panelCount = style === 'panel' ? ceil(fenceLengthFt / 8) : 0;
    const hardwareKits = ceil(fenceLengthFt / 50);

    const items: TakeoffItem[] = [
      withPrice({
        category: 'Fence',
        name: 'Fence post',
        unit: 'ea',
        qty: postCount,
        waste_factor: 0.05,
        lead_time_days: 3,
        notes: `${linePosts} line posts + ${gatePosts} gate posts`
      }),
      withPrice({
        category: 'Fence',
        name: 'Concrete bag',
        unit: 'bag',
        qty: concreteBags,
        waste_factor: 0.05,
        lead_time_days: 2,
        notes: '2 bags per post footing allowance'
      }),
      withPrice({
        category: 'Fence',
        name: 'Fence rail',
        unit: 'lf',
        qty: round2(railLf),
        waste_factor: 0.08,
        lead_time_days: 3,
        notes: `${fenceRailCount} rails x run length`
      }),
      withPrice({
        category: 'Fence',
        name: 'Fence hardware kit',
        unit: 'ea',
        qty: hardwareKits,
        waste_factor: 0,
        lead_time_days: 2,
        notes: 'Hardware allowance kits per 50 lf'
      })
    ];

    if (style === 'panel') {
      items.push(
        withPrice({
          category: 'Fence',
          name: 'Fence panel',
          unit: 'ea',
          qty: panelCount,
          waste_factor: 0.05,
          lead_time_days: 5,
          notes: 'Panel count at 8 lf sections'
        })
      );
    } else {
      items.push(
        withPrice({
          category: 'Fence',
          name: 'Fence picket',
          unit: 'ea',
          qty: picketCount,
          waste_factor: 0.08,
          lead_time_days: 4,
          notes: `${style} pickets with width+gap spacing`
        })
      );
    }

    if (gateCount > 0) {
      items.push(
        withPrice({
          category: 'Fence',
          name: 'Fence gate allowance',
          unit: 'ea',
          qty: gateCount,
          waste_factor: 0,
          lead_time_days: 7,
          notes: `${gateCount} gate(s) @ ${gateWidthFt}ft allowance`
        })
      );
    }

    const materialsSubtotal = items.reduce((sum, item) => sum + item.qty * (1 + item.waste_factor) * item.unit_cost, 0);
    const fenceSqft = round2(fenceLengthFt * (inputs.fence_height_ft ?? 0));

    return {
      assumptions: {
        joist_material: 'N/A (fence mode)',
        bags_per_footing: 2,
        screws_per_100_sqft: 0,
        formulas: {
          fence_posts: 'ceil(fence_length_ft/fence_post_spacing_ft)+1 + (gate_count*2)',
          fence_concrete_bags: 'fence_posts * 2',
          fence_rail_lf: 'fence_length_ft * fence_rail_count',
          fence_pickets: style === 'panel' ? '0' : 'ceil((fence_length_ft*12)/(picket_width_in+picket_gap_in))',
          fence_panels: style === 'panel' ? 'ceil(fence_length_ft/8)' : '0'
        },
        constants: {
          default_fence_post_spacing_ft: fenceSpacingFt,
          default_fence_rail_count: fenceRailCount,
          cost_formula: 'line_total = qty*(1+waste_factor)*unit_cost; materials_subtotal = sum(line_total)',
          non_structural_disclaimer: true
        }
      },
      items,
      totals: {
        deck_sqft: fenceSqft,
        materials_subtotal: round2(materialsSubtotal),
        item_count: items.length
      }
    };
  }

  const polygonPoints = inputs.deck_polygon_points ?? [];
  const hasCustomShape = inputs.shape_mode === 'polygon' && polygonPoints.length >= 3;
  const bounds = hasCustomShape ? polygonBounds(polygonPoints) : null;
  const effectiveDeckLengthFt = bounds?.length_ft && bounds.length_ft > 0 ? bounds.length_ft : inputs.deck_length_ft;
  const effectiveDeckWidthFt = bounds?.width_ft && bounds.width_ft > 0 ? bounds.width_ft : inputs.deck_width_ft;
  const deckSqft = hasCustomShape
    ? polygonArea(polygonPoints)
    : inputs.deck_area_override_sqft
      ? Number(inputs.deck_area_override_sqft)
      : inputs.deck_length_ft * inputs.deck_width_ft;
  const effectiveJoistSpacingIn = inputs.decking_material === 'composite'
    ? Math.min(inputs.joist_spacing_in, compositeJoistSpacingIn)
    : inputs.joist_spacing_in;

  let effectiveBeamCount = Math.max(inputs.beam_count, 1);
  const supportLinesFromLedger = inputs.ledger ? 1 : 0;
  while (effectiveDeckLengthFt / (effectiveBeamCount + supportLinesFromLedger) > maxJoistSpanFt) {
    effectiveBeamCount += 1;
  }

  const joistSpanFt = effectiveDeckLengthFt / (effectiveBeamCount + supportLinesFromLedger);
  const joistSize = joistSpanFt > 8 ? '2x10' : '2x8';
  const joistName = `${joistSize} PT joist`;
  const rimName = `${joistSize} PT rim joist`;
  const framingDepthFt = hasCustomShape
    ? polygonAverageWidth(deckSqft, effectiveDeckLengthFt)
    : effectiveDeckWidthFt;
  const joistCount = Math.max(1, ceil((effectiveDeckLengthFt * 12) / effectiveJoistSpacingIn));
  const rimLf = hasCustomShape ? polygonPerimeter(polygonPoints) : 2 * effectiveDeckLengthFt + 2 * effectiveDeckWidthFt;
  const screwsBoxes = ceil((deckSqft / 100) * SCREW_BOX_PER_100_SQFT);
  const postCountPerBeam = ceil(effectiveDeckLengthFt / inputs.post_spacing_ft) + 1;

  const perimeter = hasCustomShape
    ? polygonPerimeter(polygonPoints)
    : inputs.deck_perimeter_override_lf
      ? Number(inputs.deck_perimeter_override_lf)
      : 2 * (inputs.deck_length_ft + inputs.deck_width_ft);
  const stairOpening = inputs.stair_count > 0 ? inputs.stair_width_ft * inputs.stair_count : 0;
  const railingLf = inputs.custom_railing_lf && inputs.railing_sides === 'custom'
    ? inputs.custom_railing_lf
    : Math.max(perimeter - stairOpening, 0);

  let railingSupportRunLf = 0;
  if (inputs.railing_type !== 'none') {
    if (inputs.railing_sides === 'custom' && inputs.custom_railing_lf) {
      railingSupportRunLf = Math.max(inputs.custom_railing_lf, 0);
    } else if (hasCustomShape) {
      const houseSideApproxLf = Math.max(effectiveDeckLengthFt, 0);
      const openPerimeterLf = inputs.ledger ? Math.max(perimeter - houseSideApproxLf, 0) : perimeter;
      railingSupportRunLf = Math.max(openPerimeterLf - stairOpening, 0);
    } else {
      const openRectRunLf = inputs.ledger
        ? Math.max(effectiveDeckLengthFt + 2 * effectiveDeckWidthFt, 0)
        : Math.max(2 * (effectiveDeckLengthFt + effectiveDeckWidthFt), 0);
      railingSupportRunLf = Math.max(openRectRunLf - stairOpening, 0);
    }
  }
  const railingSpans = inputs.railing_type === 'none' ? 0 : ceil(railingSupportRunLf / railingPostSpacingFt);
  const railingPosts = inputs.railing_type === 'none' ? 0 : railingSpans + 1;
  const structuralBeamPosts = postCountPerBeam * effectiveBeamCount;
  const perimeterRailingSupportPosts = inputs.railing_type === 'none' ? 0 : railingPosts;
  const postCount = Math.max(structuralBeamPosts, perimeterRailingSupportPosts, 4);
  const footings = postCount;
  const deckBagsPerFooting = DEFAULT_BAGS_PER_FOOTING;
  const beamPly = effectiveBeamCount >= 3 || effectiveDeckLengthFt > beamTriplePlyLengthFt
    ? 3
    : effectiveBeamCount >= 2 || effectiveDeckLengthFt > beamDoublePlyLengthFt
      ? 2
      : 1;
  const joistStock = accumulateStockMix([framingDepthFt], joistCount, AVAILABLE_FRAMING_LENGTHS_FT);
  const rimStock = hasCustomShape
    ? accumulateStockMix([rimLf], 1, AVAILABLE_FRAMING_LENGTHS_FT)
    : accumulateStockMix([effectiveDeckLengthFt, effectiveDeckWidthFt], 2, AVAILABLE_FRAMING_LENGTHS_FT);
  const beamStock = accumulateStockMix([effectiveDeckLengthFt], effectiveBeamCount * beamPly, AVAILABLE_FRAMING_LENGTHS_FT);

  const boardCourses = ceil((framingDepthFt * 12) / inputs.decking_board_width_in);
  const boardMix = bestBoardMixForRun(effectiveDeckLengthFt, AVAILABLE_BOARD_LENGTHS_FT);
  const boardMixEntries = [...boardMix.counts.entries()].sort((a, b) => b[0] - a[0]);
  const beamName =
    beamPly === 3
      ? 'PT beam triple-ply allowance'
      : beamPly === 2
        ? 'PT beam double-ply allowance'
        : 'PT beam single-ply allowance';

  const risers = ceil((inputs.deck_height_ft * 12) / 7.5);
  const treads = Math.max(risers - 1, 0);
  const stringersPerStair = ceil(inputs.stair_width_ft / 1.5) + 1;
  const totalStringers = stringersPerStair * inputs.stair_count;

  const items: TakeoffItem[] = [
    {
      category: 'Framing',
      name: `${joistName} (LF summary)`,
      unit: 'lf',
      qty: round2(joistCount * framingDepthFt),
      waste_factor: DEFAULT_WASTE,
      unit_cost: 0,
      vendor: 'Calculated',
      is_allowance: true,
      lead_time_days: 2,
      notes: `Joists: ${joistCount} @ ${round2(framingDepthFt)}ft (${effectiveJoistSpacingIn}" O.C.); stock: ${formatStockMix(joistStock.totals)}`
    },
    {
      category: 'Framing',
      name: `${rimName} (LF summary)`,
      unit: 'lf',
      qty: round2(rimLf),
      waste_factor: DEFAULT_WASTE,
      unit_cost: 0,
      vendor: 'Calculated',
      is_allowance: true,
      lead_time_days: 2,
      notes: `Perimeter rim joists; stock: ${formatStockMix(rimStock.totals)}`
    },
    {
      category: 'Framing',
      name: `${beamName} (LF summary)`,
      unit: 'lf',
      qty: round2(effectiveBeamCount * effectiveDeckLengthFt),
      waste_factor: DEFAULT_WASTE,
      unit_cost: 0,
      vendor: 'Calculated',
      is_allowance: true,
      lead_time_days: 3,
      notes: `${effectiveBeamCount} beam line(s), ${beamPly}-ply allowance; stock: ${formatStockMix(beamStock.totals)}`
    },
    withPrice({
      category: 'Decking',
      name: 'Deck board takeoff summary',
      unit: 'sqft',
      qty: round2(deckSqft),
      waste_factor: DEFAULT_WASTE,
      lead_time_days: 4,
      notes: `${inputs.decking_material} decking summary; detailed board counts listed below`
    }),
    withPrice({
      category: 'Fasteners',
      name: 'Exterior screws box',
      unit: 'box',
      qty: screwsBoxes,
      waste_factor: 0,
      lead_time_days: 1,
      notes: '1 box per 100 sqft (rounded up)'
    }),
    withPrice({
      category: 'Footings',
      name: `${inputs.post_size} PT structural post`,
      unit: 'ea',
      qty: postCount,
      waste_factor: 0.08,
      lead_time_days: 3,
      notes: `${effectiveBeamCount} beam line(s) x ${postCountPerBeam} posts per beam (min ${railingPostSpacingFt}ft railing support)`
    }),
    withPrice({
      category: 'Footings',
      name: 'Concrete bag',
      unit: 'bag',
      qty: footings * deckBagsPerFooting,
      waste_factor: 0.05,
      lead_time_days: 2,
      notes: `${footings} footings x ${deckBagsPerFooting} bags`
    })
  ];

  for (const [lengthFt, pieceCount] of [...joistStock.totals.entries()].sort((a, b) => b[0] - a[0])) {
    items.push(
      withPrice({
        category: 'Framing',
        name: `${joistName} - ${lengthFt}ft`,
        unit: 'ea',
        qty: pieceCount,
        waste_factor: DEFAULT_WASTE,
        lead_time_days: 2,
        notes: 'Stock purchase count for joists'
      })
    );
  }

  for (const [lengthFt, pieceCount] of [...rimStock.totals.entries()].sort((a, b) => b[0] - a[0])) {
    items.push(
      withPrice({
        category: 'Framing',
        name: `${rimName} - ${lengthFt}ft`,
        unit: 'ea',
        qty: pieceCount,
        waste_factor: DEFAULT_WASTE,
        lead_time_days: 2,
        notes: 'Stock purchase count for rim joists'
      })
    );
  }

  for (const [lengthFt, pieceCount] of [...beamStock.totals.entries()].sort((a, b) => b[0] - a[0])) {
    items.push(
      withPrice({
        category: 'Framing',
        name: `${beamName} - ${lengthFt}ft`,
        unit: 'ea',
        qty: pieceCount,
        waste_factor: DEFAULT_WASTE,
        lead_time_days: 3,
        notes: 'Stock purchase count for beam plies'
      })
    );
  }

  for (const [lengthFt, countPerRun] of boardMixEntries) {
    const totalPieces = countPerRun * boardCourses;
    items.push(
      withPrice({
        category: 'Decking',
        name: `Deck board - ${inputs.decking_material} ${lengthFt}ft`,
        unit: 'ea',
        qty: totalPieces,
        waste_factor: DEFAULT_WASTE,
        lead_time_days: 4,
        notes: `${countPerRun} per course x ${boardCourses} courses`
      })
    );
  }

  if (inputs.ledger) {
    items.push(
      withPrice({
        category: 'Hardware',
        name: 'Joist hanger',
        unit: 'ea',
        qty: joistCount,
        waste_factor: 0.05,
        lead_time_days: 2,
        notes: 'One per joist with ledger'
      }),
      withPrice({
        category: 'Waterproofing',
        name: 'Ledger flashing',
        unit: 'lf',
        qty: round2(inputs.deck_length_ft),
        waste_factor: 0.05,
        lead_time_days: 2,
        notes: 'Ledger flashing length'
      })
    );
  }

  if (inputs.railing_type !== 'none') {
    const railName = `Railing - ${inputs.railing_type} allowance` as const;
    items.push(
      withPrice({
        category: 'Railing',
        name: railName,
        unit: 'lf',
        qty: round2(railingLf),
        waste_factor: 0.08,
        lead_time_days: 10,
        notes: 'Allowance pricing; edit to supplier quote'
      }),
      withPrice({
        category: 'Railing',
        name: 'Railing post',
        unit: 'ea',
        qty: railingPosts,
        waste_factor: 0.08,
        lead_time_days: 7,
        notes: `Post spacing allowance at ~${railingPostSpacingFt}ft`
      })
    );
  }

  if (inputs.stair_count > 0) {
    items.push(
      withPrice({
        category: 'Stairs',
        name: 'Stair stringer',
        unit: 'ea',
        qty: totalStringers,
        waste_factor: 0.1,
        lead_time_days: 4,
        notes: `${stringersPerStair} per stair`
      }),
      withPrice({
        category: 'Stairs',
        name: 'Stair tread boards',
        unit: 'lf',
        qty: round2(treads * inputs.stair_width_ft * inputs.stair_count),
        waste_factor: 0.12,
        lead_time_days: 4,
        notes: `${treads} treads per stair`
      })
    );

    if (inputs.railing_type !== 'none') {
      items.push(
        withPrice({
          category: 'Stairs',
          name: 'Stair railing hardware',
          unit: 'ea',
          qty: inputs.stair_count,
          waste_factor: 0,
          lead_time_days: 5,
          notes: 'Allowance per stair run'
        })
      );
    }
  }

  if (inputs.is_covered && inputs.roof_length_ft && inputs.roof_width_ft) {
    const roofArea = inputs.roof_length_ft * inputs.roof_width_ft;
    const rafters = Math.floor((inputs.roof_width_ft * 12) / (inputs.rafter_spacing_in ?? 16)) + 1;

    items.push(
      withPrice({
        category: 'Cover',
        name: '2x8 PT joist',
        unit: 'lf',
        qty: round2(rafters * inputs.roof_length_ft),
        waste_factor: DEFAULT_WASTE,
        lead_time_days: 5,
        notes: `Rafters: ${rafters} @ ${inputs.roof_length_ft}ft`
      }),
      withPrice({
        category: 'Cover',
        name: 'Roof sheathing',
        unit: 'sqft',
        qty: round2(roofArea * 1.05),
        waste_factor: 0.03,
        lead_time_days: 5,
        notes: 'Roof area x 1.05'
      }),
      withPrice({
        category: 'Cover',
        name: inputs.roofing_material === 'metal' ? 'Roofing - metal' : 'Roofing - shingle',
        unit: 'sqft',
        qty: round2(roofArea * 1.1),
        waste_factor: 0.03,
        lead_time_days: 7,
        notes: 'Roof area x 1.10'
      })
    );

    if (inputs.ceiling_finish && inputs.ceiling_finish !== 'none') {
      items.push(
        withPrice({
          category: 'Ceiling',
          name: inputs.ceiling_finish === 'drywall' ? 'Ceiling drywall' : 'Ceiling tongue & groove',
          unit: 'sqft',
          qty: round2(roofArea),
          waste_factor: 0.1,
          lead_time_days: 6,
          notes: 'Ceiling finish allowance'
        }),
        withPrice({
          category: 'Ceiling',
          name: 'Ceiling fasteners',
          unit: 'ea',
          qty: ceil(roofArea / 20),
          waste_factor: 0,
          lead_time_days: 2,
          notes: '1 fastener unit per 20 sqft'
        })
      );
    }

    if (inputs.cover_post_count && inputs.cover_post_count > 0) {
      items.push(
        withPrice({
          category: 'Cover',
          name: 'Cover posts allowance',
          unit: 'ea',
          qty: inputs.cover_post_count,
          waste_factor: 0,
          lead_time_days: 7,
          notes: `Post allowance (${inputs.post_size})`
        })
      );
    }

    if (inputs.cover_beam_size) {
      items.push(
        withPrice({
          category: 'Cover',
          name: 'Cover beam allowance',
          unit: 'lf',
          qty: round2(inputs.roof_length_ft),
          waste_factor: 0,
          lead_time_days: 7,
          notes: `Beam size allowance: ${inputs.cover_beam_size}`
        })
      );
    }
  }

  const materialsSubtotal = items.reduce((sum, item) => sum + item.qty * (1 + item.waste_factor) * item.unit_cost, 0);

  return {
    assumptions: {
      joist_material: `${joistSize} PT`,
      bags_per_footing: deckBagsPerFooting,
      screws_per_100_sqft: SCREW_BOX_PER_100_SQFT,
      formulas: {
        deck_sqft: 'length_ft * width_ft',
        deck_sqft_custom: "if shape_mode='polygon', compute shoelace area from polygon points",
        effective_joist_spacing_in: "decking_material='composite' ? min(input_spacing,12) : input_spacing",
        joist_count: 'ceil((deck_length_ft*12)/effective_joist_spacing_in)',
        beam_count_effective: `increase beam_count until (deck_length_ft/(beam_count + ledger_support)) <= ${maxJoistSpanFt}ft`,
        joist_size: "joist_span_ft>8 ? '2x10' : '2x8'",
        decking_board_count: 'board_courses * sum(board_mix_per_course)',
        decking_board_mix: 'optimize board lengths per course to minimize overage, then multiply by courses',
        rim_joists_lf: '2*length + 2*width',
        perimeter_lf: "if shape_mode='polygon', compute perimeter from polygon points",
        fasteners_boxes: 'ceil(deck_sqft/100)',
        post_count: 'max(beam_support_posts, perimeter_railing_support_posts, 4), where beam_support_posts=post_count_per_beam*effective_beam_count and perimeter_railing_support_posts=ceil(railing_support_run_lf/railing_post_spacing_ft)+1',
        railing_posts: `ceil(railing_support_run_lf/${railingPostSpacingFt})+1`,
        stairs_stringers: 'ceil(stair_width_ft/1.5)+1',
        roof_area: 'roof_length_ft*roof_width_ft',
        rafters_count: 'floor((roof_width_ft*12)/rafter_spacing_in)+1'
      },
      constants: {
        default_waste_factor: DEFAULT_WASTE,
        max_joist_span_ft: maxJoistSpanFt,
        composite_joist_spacing_in: compositeJoistSpacingIn,
        default_railing_post_spacing_ft: railingPostSpacingFt,
        beam_double_ply_length_ft: beamDoublePlyLengthFt,
        beam_triple_ply_length_ft: beamTriplePlyLengthFt,
        available_board_lengths_ft: AVAILABLE_BOARD_LENGTHS_FT.join(','),
        available_framing_lengths_ft: AVAILABLE_FRAMING_LENGTHS_FT.join(','),
        joist_stock_mix: formatStockMix(joistStock.totals),
        rim_stock_mix: formatStockMix(rimStock.totals),
        beam_stock_mix: formatStockMix(beamStock.totals),
        board_mix_per_course: boardMixEntries.map(([len, count]) => `${len}ft x ${count}`).join(', '),
        board_mix_run_overage_ft: boardMix.run_overage_ft,
        shape_geometry_source: hasCustomShape ? 'polygon_points' : 'rectangular_inputs',
        post_count_total: postCount,
        beam_support_post_count: structuralBeamPosts,
        perimeter_railing_support_post_count: perimeterRailingSupportPosts,
        railing_support_run_lf: round2(railingSupportRunLf),
        railing_support_spans: railingSpans,
        post_count_per_beam: postCountPerBeam,
        bags_per_footing: deckBagsPerFooting,
        screw_boxes_per_100_sqft: SCREW_BOX_PER_100_SQFT,
        cost_formula: 'line_total = qty*(1+waste_factor)*unit_cost; materials_subtotal = sum(line_total)',
        non_structural_disclaimer: true
      }
    },
    items,
    totals: {
      deck_sqft: round2(deckSqft),
      materials_subtotal: round2(materialsSubtotal),
      item_count: items.length
    }
  };
}

export function computeTakeoffDiff(
  previous: Array<{ key: string; name: string; qty: number }>,
  current: Array<{ key: string; name: string; qty: number }>
) {
  const prevMap = new Map(previous.map((i) => [i.key, i]));
  const currMap = new Map(current.map((i) => [i.key, i]));

  const added = current.filter((i) => !prevMap.has(i.key));
  const removed = previous.filter((i) => !currMap.has(i.key));
  const changed = current
    .filter((i) => prevMap.has(i.key) && prevMap.get(i.key)?.qty !== i.qty)
    .map((i) => ({ name: i.name, from: prevMap.get(i.key)?.qty ?? 0, to: i.qty }));

  return { added, removed, changed };
}
