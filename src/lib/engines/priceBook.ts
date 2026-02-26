export const PRICE_BOOK: Record<string, { unit_cost: number; is_allowance?: boolean; vendor?: string }> = {
  '2x8 PT joist': { unit_cost: 2.9, vendor: 'Allowance Lumber Yard' },
  '2x10 PT joist': { unit_cost: 3.8, vendor: 'Allowance Lumber Yard' },
  '2x8 PT rim joist': { unit_cost: 2.95, vendor: 'Allowance Lumber Yard' },
  '2x10 PT rim joist': { unit_cost: 3.95, vendor: 'Allowance Lumber Yard' },
  'PT beam single-ply allowance': { unit_cost: 8.5, vendor: 'Allowance Lumber Yard', is_allowance: true },
  'PT beam double-ply allowance': { unit_cost: 16.5, vendor: 'Allowance Lumber Yard', is_allowance: true },
  'PT beam triple-ply allowance': { unit_cost: 24.5, vendor: 'Allowance Lumber Yard', is_allowance: true },
  'Deck boards - wood': { unit_cost: 4.8, vendor: 'Allowance Lumber Yard' },
  'Deck boards - composite': { unit_cost: 7.6, vendor: 'Allowance Composite Supply', is_allowance: true },
  'Deck board takeoff summary': { unit_cost: 0, vendor: 'Calculated Takeoff', is_allowance: true },
  'Exterior screws box': { unit_cost: 48, vendor: 'Allowance Fasteners' },
  'Joist hanger': { unit_cost: 2.25, vendor: 'Allowance Fasteners' },
  'Ledger flashing': { unit_cost: 4.5, vendor: 'Allowance Waterproofing' },
  'Concrete bag': { unit_cost: 7.8, vendor: 'Allowance Concrete' },
  '4x4 PT structural post': { unit_cost: 24, vendor: 'Allowance Structural Lumber' },
  '6x6 PT structural post': { unit_cost: 42, vendor: 'Allowance Structural Lumber' },
  'Railing - wood allowance': { unit_cost: 42, vendor: 'Allowance Railing', is_allowance: true },
  'Railing - aluminum allowance': { unit_cost: 78, vendor: 'Allowance Railing', is_allowance: true },
  'Railing - cable allowance': { unit_cost: 95, vendor: 'Allowance Railing', is_allowance: true },
  'Railing post': { unit_cost: 32, vendor: 'Allowance Railing', is_allowance: true },
  'Stair stringer': { unit_cost: 38, vendor: 'Allowance Stairs' },
  'Stair tread boards': { unit_cost: 5.5, vendor: 'Allowance Stairs' },
  'Stair railing hardware': { unit_cost: 90, vendor: 'Allowance Stairs', is_allowance: true },
  'Roof sheathing': { unit_cost: 2.1, vendor: 'Allowance Roofing' },
  'Roofing - shingle': { unit_cost: 3.85, vendor: 'Allowance Roofing' },
  'Roofing - metal': { unit_cost: 6.4, vendor: 'Allowance Roofing', is_allowance: true },
  'Ceiling drywall': { unit_cost: 2.35, vendor: 'Allowance Ceiling' },
  'Ceiling tongue & groove': { unit_cost: 5.9, vendor: 'Allowance Ceiling', is_allowance: true },
  'Ceiling fasteners': { unit_cost: 0.22, vendor: 'Allowance Ceiling' },
  'Cover posts allowance': { unit_cost: 165, vendor: 'Allowance Structural', is_allowance: true },
  'Cover beam allowance': { unit_cost: 45, vendor: 'Allowance Structural', is_allowance: true },
  'Fence post': { unit_cost: 28, vendor: 'Allowance Fence Supply' },
  'Fence rail': { unit_cost: 2.7, vendor: 'Allowance Fence Supply' },
  'Fence picket': { unit_cost: 4.4, vendor: 'Allowance Fence Supply' },
  'Fence panel': { unit_cost: 145, vendor: 'Allowance Fence Supply', is_allowance: true },
  'Fence gate allowance': { unit_cost: 240, vendor: 'Allowance Fence Supply', is_allowance: true },
  'Fence hardware kit': { unit_cost: 24, vendor: 'Allowance Fence Supply' }
};

export function lookupPrice(name: string) {
  const framingMatch = name.match(/^(2x(?:8|10) PT joist|2x(?:8|10) PT rim joist) - (\d+)ft$/i);
  if (framingMatch) {
    const baseName = framingMatch[1];
    const lengthFt = Number(framingMatch[2]);
    const base = PRICE_BOOK[baseName];
    if (base) {
      return {
        unit_cost: Number((base.unit_cost * lengthFt).toFixed(2)),
        vendor: base.vendor,
        is_allowance: base.is_allowance
      };
    }
  }

  const beamMatch = name.match(/^(PT beam (?:single|double|triple)-ply allowance) - (\d+)ft$/i);
  if (beamMatch) {
    const baseName = beamMatch[1];
    const lengthFt = Number(beamMatch[2]);
    const base = PRICE_BOOK[baseName];
    if (base) {
      return {
        unit_cost: Number((base.unit_cost * lengthFt).toFixed(2)),
        vendor: base.vendor,
        is_allowance: base.is_allowance
      };
    }
  }

  const boardMatch = name.match(/^Deck board - (wood|composite) (\d+)ft$/i);
  if (boardMatch) {
    const material = boardMatch[1].toLowerCase();
    const lengthFt = Number(boardMatch[2]);
    const perLf = material === 'composite' ? 3.2 : 2.1;
    return {
      unit_cost: Number((lengthFt * perLf).toFixed(2)),
      vendor: material === 'composite' ? 'Allowance Composite Supply' : 'Allowance Lumber Yard',
      is_allowance: material === 'composite'
    };
  }
  return PRICE_BOOK[name] ?? { unit_cost: 0, is_allowance: true };
}
