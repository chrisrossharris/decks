import { describe, expect, it } from 'vitest';
import { generateTakeoff } from '../src/lib/engines/takeoff';

const baseInputs = {
  deck_length_ft: 20,
  deck_width_ft: 12,
  deck_height_ft: 5,
  decking_material: 'wood' as const,
  decking_board_width_in: 5.5,
  joist_spacing_in: 16 as const,
  ledger: true,
  ledger_side: 'top' as const,
  beam_count: 1,
  post_size: '6x6' as const,
  post_spacing_ft: 6,
  stair_count: 1,
  stair_width_ft: 3,
  railing_type: 'aluminum' as const,
  railing_sides: 'all' as const,
  custom_railing_lf: null,
  is_covered: false
};

describe('takeoff engine', () => {
  it('calculates joists count and hanger quantity', () => {
    const result = generateTakeoff(baseInputs);
    const joists = result.items.find((i) => i.name.includes('PT joist') && i.category === 'Framing');
    const hangers = result.items.find((i) => i.name === 'Joist hanger');
    expect(joists?.notes).toContain('15');
    expect(joists?.notes).toContain('stock:');
    expect(hangers?.qty).toBe(15);
  });

  it('calculates railing LF from open perimeter (ledger side removed) minus stair opening', () => {
    const result = generateTakeoff(baseInputs);
    const railing = result.items.find((i) => i.category === 'Railing');
    expect(railing?.qty).toBe(41);
  });

  it('calculates roof area derived lines for covered deck', () => {
    const result = generateTakeoff({
      ...baseInputs,
      is_covered: true,
      roof_length_ft: 20,
      roof_width_ft: 10,
      rafter_spacing_in: 16,
      roofing_material: 'shingle',
      ceiling_finish: 'none',
      roof_type: 'shed',
      cover_post_count: 4,
      cover_beam_size: 'LVL'
    });
    const sheathing = result.items.find((i) => i.name === 'Roof sheathing');
    const roofing = result.items.find((i) => i.name === 'Roofing - shingle');
    expect(sheathing?.qty).toBe(210);
    expect(roofing?.qty).toBe(220);
  });

  it('includes covered package roof metadata and fan plate allowance', () => {
    const result = generateTakeoff({
      ...baseInputs,
      is_covered: true,
      roof_length_ft: 20,
      roof_width_ft: 14,
      rafter_spacing_in: 16,
      roofing_material: 'metal',
      roofing_product_type: 'standing seam',
      roofing_color: 'charcoal',
      roof_pitch: '6:12',
      roof_type: 'gable',
      ceiling_finish: 'beadboard',
      ceiling_fan_plate_count: 2,
      cover_post_count: 4,
      cover_beam_size: 'LVL'
    });
    const roofing = result.items.find((i) => i.name === 'Roofing - metal');
    const ceiling = result.items.find((i) => i.name === 'Ceiling beadboard');
    const fanPlates = result.items.find((i) => i.name === 'Fan-rated ceiling plate');
    expect(roofing?.notes).toContain('gable');
    expect(roofing?.notes).toContain('pitch 6:12');
    expect(roofing?.notes).toContain('type standing seam');
    expect(roofing?.notes).toContain('color charcoal');
    expect(ceiling?.qty).toBe(280);
    expect(fanPlates?.qty).toBe(2);
  });

  it('rounds fasteners up at one box per 100 sqft', () => {
    const result = generateTakeoff({ ...baseInputs, deck_length_ft: 13, deck_width_ft: 11 });
    const fasteners = result.items.find((i) => i.name === 'Exterior screws box');
    expect(fasteners?.qty).toBe(2);
  });

  it('forces composite spacing to 12in O.C. when input is larger', () => {
    const result = generateTakeoff({
      ...baseInputs,
      decking_material: 'composite',
      joist_spacing_in: 24
    });
    const joists = result.items.find((i) => i.category === 'Framing' && i.name.includes('PT joist'));
    expect(joists?.notes).toContain('12" O.C.');
  });

  it('increases beam count to keep joist span at or below 10ft', () => {
    const result = generateTakeoff({
      ...baseInputs,
      deck_length_ft: 30,
      beam_count: 1
    });
    const concrete = result.items.find((i) => i.name === 'Concrete bag');
    expect(concrete?.qty).toBe(24);
  });

  it('adds perimeter railing support posts when spans exceed 6ft', () => {
    const result = generateTakeoff(baseInputs);
    const posts = result.items.find((i) => i.name === '6x6 PT structural post');
    expect(posts?.qty).toBe(8);
  });

  it('generates decking board length piece counts', () => {
    const result = generateTakeoff({
      ...baseInputs,
      deck_length_ft: 22,
      deck_width_ft: 14,
      decking_material: 'composite'
    });
    const boardLines = result.items.filter((i) => i.name.startsWith('Deck board - composite '));
    const totalLf = boardLines.reduce((sum, item) => {
      const match = item.name.match(/(\d+)ft$/);
      const len = Number(match?.[1] ?? 0);
      return sum + len * item.qty;
    }, 0);
    expect(boardLines.length).toBeGreaterThan(0);
    expect(totalLf).toBeGreaterThanOrEqual(22 * 31);
  });

  it('uses polygon area and perimeter overrides for custom deck shapes', () => {
    const result = generateTakeoff({
      ...baseInputs,
      ledger: false,
      shape_mode: 'polygon',
      deck_polygon_points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 4 },
        { x: 6, y: 4 },
        { x: 6, y: 10 },
        { x: 0, y: 10 }
      ],
      deck_area_override_sqft: 999,
      deck_perimeter_override_lf: 999,
      stair_count: 0
    });
    const decking = result.items.find((i) => i.category === 'Decking');
    const railing = result.items.find((i) => i.category === 'Railing');
    expect(decking?.qty).toBe(76);
    expect(railing?.qty).toBe(40);
  });

  it('uses selected ledger side when computing open railing run', () => {
    const result = generateTakeoff({
      ...baseInputs,
      ledger_side: 'left'
    });
    const railing = result.items.find((i) => i.category === 'Railing');
    expect(railing?.qty).toBe(49);
  });

  it('generates fence takeoff items for fence mode', () => {
    const result = generateTakeoff({
      ...baseInputs,
      design_mode: 'fence',
      fence_length_ft: 120,
      fence_height_ft: 6,
      fence_style: 'privacy',
      fence_post_spacing_ft: 8,
      fence_rail_count: 2,
      fence_picket_width_in: 5.5,
      fence_picket_gap_in: 0.5,
      fence_gate_count: 1,
      fence_gate_width_ft: 4
    });
    const posts = result.items.find((i) => i.name === 'Fence post');
    const rails = result.items.find((i) => i.name === 'Fence rail');
    const gates = result.items.find((i) => i.name === 'Fence gate allowance');
    expect(posts?.qty).toBe(18);
    expect(rails?.qty).toBe(240);
    expect(gates?.qty).toBe(1);
  });
});
