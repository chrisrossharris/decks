import type { DesignInputs, LaborPlanResult, LaborTask, LaborTemplate, TakeoffResult } from '@/lib/types/domain';

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
};

export const DEFAULT_LABOR_TEMPLATES: LaborTemplate[] = [
  {
    name: 'Deck Only - Standard',
    rates_json: { base_rate: 55, burden_pct: 0.18 },
    production_json: {
      framing_hrs_per_sqft: 0.06,
      decking_hrs_per_sqft: 0.04,
      railing_hrs_per_lf: 0.15,
      stairs_hrs_each: 6,
      cover_hrs_per_sqft: 0,
      footings_hrs_each: 0.75,
      demo_hrs: 0
    }
  },
  {
    name: 'Covered Deck - Standard',
    rates_json: { base_rate: 55, burden_pct: 0.18 },
    production_json: {
      framing_hrs_per_sqft: 0.06,
      decking_hrs_per_sqft: 0.04,
      railing_hrs_per_lf: 0.15,
      stairs_hrs_each: 6,
      cover_hrs_per_sqft: 0.08,
      footings_hrs_each: 0.9,
      demo_hrs: 0
    }
  },
  {
    name: 'Fence - Standard',
    rates_json: { base_rate: 55, burden_pct: 0.18 },
    production_json: {
      framing_hrs_per_sqft: 0,
      decking_hrs_per_sqft: 0,
      railing_hrs_per_lf: 0,
      stairs_hrs_each: 0,
      cover_hrs_per_sqft: 0,
      footings_hrs_each: 0,
      demo_hrs: 0,
      fence_layout_hrs_per_lf: 0.05,
      fence_rails_hrs_per_lf: 0.07,
      fence_pickets_hrs_per_lf: 0.08,
      fence_gate_hrs_each: 2.5
    }
  }
];

function task(key: string, taskName: string, quantityDriver: string, quantity: number, hours: number, rate: number): LaborTask {
  return {
    key,
    task: taskName,
    quantity_driver: quantityDriver,
    quantity: round2(quantity),
    hours: round2(hours),
    rate: round2(rate),
    cost: round2(hours * rate)
  };
}

export function generateLaborPlan(
  inputs: DesignInputs,
  takeoff: TakeoffResult,
  template: LaborTemplate,
  options?: { includeDemo?: boolean; overrides?: Record<string, { hours?: number; rate?: number }> }
): LaborPlanResult {
  const rawRates = asObject(template?.rates_json);
  const rawProduction = asObject(template?.production_json);
  const rates = {
    base_rate: num(rawRates.base_rate, 55),
    burden_pct: num(rawRates.burden_pct, 0.18)
  };
  const production = {
    framing_hrs_per_sqft: num(rawProduction.framing_hrs_per_sqft, 0.06),
    decking_hrs_per_sqft: num(rawProduction.decking_hrs_per_sqft, 0.04),
    railing_hrs_per_lf: num(rawProduction.railing_hrs_per_lf, 0.15),
    stairs_hrs_each: num(rawProduction.stairs_hrs_each, 6),
    cover_hrs_per_sqft: num(rawProduction.cover_hrs_per_sqft, 0.08),
    footings_hrs_each: num(rawProduction.footings_hrs_each, 0.75),
    demo_hrs: num(rawProduction.demo_hrs, 0),
    fence_layout_hrs_per_lf: num(rawProduction.fence_layout_hrs_per_lf, 0.05),
    fence_rails_hrs_per_lf: num(rawProduction.fence_rails_hrs_per_lf, 0.07),
    fence_pickets_hrs_per_lf: num(rawProduction.fence_pickets_hrs_per_lf, 0.08),
    fence_gate_hrs_each: num(rawProduction.fence_gate_hrs_each, 2.5)
  };
  const burdenedRate = rates.base_rate * (1 + rates.burden_pct);
  const isFence = inputs.design_mode === 'fence';

  if (isFence) {
    const fenceLength = inputs.fence_length_ft ?? 0;
    const gateCount = inputs.fence_gate_count ?? 0;
    const demoHours = production.demo_hrs > 0 ? production.demo_hrs : Math.max(2, fenceLength * 0.02);

    const fenceTasks: LaborTask[] = [];
    if (options?.includeDemo) {
      fenceTasks.push(task('demo', 'Demo', 'include_demo', 1, demoHours, burdenedRate));
    }

    fenceTasks.push(
      task(
        'fence_layout',
        'Layout + post install',
        'fence_length_ft',
        fenceLength,
        fenceLength * production.fence_layout_hrs_per_lf,
        burdenedRate
      ),
      task(
        'fence_rails',
        'Rails + panel framing',
        'fence_length_ft',
        fenceLength,
        fenceLength * production.fence_rails_hrs_per_lf,
        burdenedRate
      ),
      task(
        'fence_finish',
        'Pickets / panel install',
        'fence_length_ft',
        fenceLength,
        fenceLength * production.fence_pickets_hrs_per_lf,
        burdenedRate
      ),
      task(
        'fence_gates',
        'Gate install',
        'fence_gate_count',
        gateCount,
        gateCount * production.fence_gate_hrs_each,
        burdenedRate
      )
    );

    const overriddenFence = fenceTasks.map((t) => {
      const override = options?.overrides?.[t.key];
      if (!override) return t;
      const hours = override.hours ?? t.hours;
      const rate = override.rate ?? t.rate;
      return { ...t, hours, rate, cost: round2(hours * rate), overridden: true };
    });

    const totalFenceHours = overriddenFence.reduce((s, t) => s + t.hours, 0);
    const totalFenceCost = overriddenFence.reduce((s, t) => s + t.cost, 0);
    return {
      tasks: overriddenFence,
      total_hours: round2(totalFenceHours),
      total_labor_cost: round2(totalFenceCost)
    };
  }

  const deckSqft = Number(takeoff?.totals?.deck_sqft ?? 0);
  const takeoffItems = Array.isArray(takeoff?.items) ? takeoff.items : [];
  const railingItem = takeoffItems.find((i) => i.category === 'Railing');
  const railingLf = Number(railingItem?.qty ?? 0);
  const structuralPostItem = takeoffItems.find(
    (i) => i.category === 'Footings' && /PT structural post$/i.test(i.name)
  );
  const demoHours = production.demo_hrs > 0 ? production.demo_hrs : Math.max(4, deckSqft * 0.01);

  const legacyPostCount = Math.ceil(inputs.deck_length_ft / inputs.post_spacing_ft + 1) * Math.max(inputs.beam_count, 1);
  const postCount = Number(structuralPostItem?.qty ?? legacyPostCount);
  const roofSqft = inputs.is_covered && inputs.roof_length_ft && inputs.roof_width_ft
    ? inputs.roof_length_ft * inputs.roof_width_ft
    : 0;

  const baseTasks: LaborTask[] = [];

  if (options?.includeDemo) {
    baseTasks.push(task('demo', 'Demo', 'include_demo', 1, demoHours, burdenedRate));
  }

  baseTasks.push(
    task('footings', 'Footings/posts', 'post_count', postCount, postCount * production.footings_hrs_each, burdenedRate),
    task('framing', 'Framing', 'deck_sqft', deckSqft, deckSqft * production.framing_hrs_per_sqft, burdenedRate),
    task('decking', 'Decking install', 'deck_sqft', deckSqft, deckSqft * production.decking_hrs_per_sqft, burdenedRate),
    task('railing', 'Railing', 'railing_lf', railingLf, railingLf * production.railing_hrs_per_lf, burdenedRate),
    task('stairs', 'Stairs', 'stair_count', inputs.stair_count, inputs.stair_count * production.stairs_hrs_each, burdenedRate)
  );

  if (inputs.is_covered) {
    baseTasks.push(task('cover', 'Cover framing + roofing', 'roof_sqft', roofSqft, roofSqft * production.cover_hrs_per_sqft, burdenedRate));
  }

  const overridden = baseTasks.map((t) => {
    const override = options?.overrides?.[t.key];
    if (!override) return t;
    const hours = override.hours ?? t.hours;
    const rate = override.rate ?? t.rate;
    return { ...t, hours, rate, cost: round2(hours * rate), overridden: true };
  });

  const totalHours = overridden.reduce((s, t) => s + t.hours, 0);
  const totalCost = overridden.reduce((s, t) => s + t.cost, 0);

  return {
    tasks: overridden,
    total_hours: round2(totalHours),
    total_labor_cost: round2(totalCost)
  };
}
