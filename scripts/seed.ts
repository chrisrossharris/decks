import postgres from 'postgres';
import { generateTakeoff } from '../src/lib/engines/takeoff';
import { DEFAULT_LABOR_TEMPLATES, generateLaborPlan } from '../src/lib/engines/labor';
import { estimateTotals } from '../src/lib/engines/estimate';
import { loadLocalEnv, requireEnv } from './_env';

loadLocalEnv();
const sql = postgres(requireEnv('DATABASE_URL'), { ssl: 'require' });
const seedUserId = process.env.SEED_USER_ID || 'user_seed_demo';

async function upsertTemplate(name: string, rates: any, production: any) {
  const [existing] = await sql`SELECT id FROM labor_templates WHERE user_id = ${seedUserId} AND name = ${name}`;
  if (existing) return existing.id;
  const [row] = await sql`
    INSERT INTO labor_templates (user_id, name, rates_json, production_json)
    VALUES (${seedUserId}, ${name}, ${JSON.stringify(rates)}::jsonb, ${JSON.stringify(production)}::jsonb)
    RETURNING id
  `;
  return row.id;
}

async function seedProject(name: string, type: 'deck' | 'covered_deck' | 'fence', inputs: any) {
  const [project] = await sql`
    INSERT INTO projects (user_id, name, type, address, status)
    VALUES (${seedUserId}, ${name}, ${type}, '123 Demo Ln', 'estimating')
    RETURNING id
  `;

  await sql`
    INSERT INTO design_inputs (project_id, version, inputs_json, created_by)
    VALUES (${project.id}, 1, ${JSON.stringify(inputs)}::jsonb, ${seedUserId})
  `;

  const generated = generateTakeoff(inputs);
  const [takeoff] = await sql`
    INSERT INTO takeoffs (project_id, version, assumptions_json, totals_json, created_by)
    VALUES (${project.id}, 1, ${JSON.stringify(generated.assumptions)}::jsonb, ${JSON.stringify(generated.totals)}::jsonb, ${seedUserId})
    RETURNING id
  `;

  for (const item of generated.items) {
    await sql`
      INSERT INTO takeoff_items (takeoff_id, category, name, unit, qty, waste_factor, unit_cost, vendor, lead_time_days, notes)
      VALUES (
        ${takeoff.id}, ${item.category}, ${item.name}, ${item.unit}, ${item.qty}, ${item.waste_factor},
        ${item.unit_cost}, ${item.vendor ?? null}, ${item.lead_time_days}, ${item.notes ?? null}
      )
    `;
  }

  const template = type === 'covered_deck'
    ? DEFAULT_LABOR_TEMPLATES[1]
    : type === 'fence'
      ? DEFAULT_LABOR_TEMPLATES[2]
      : DEFAULT_LABOR_TEMPLATES[0];
  const plan = generateLaborPlan(inputs, generated, template);

  const [labor] = await sql`
    INSERT INTO labor_plans (project_id, template_id, labor_json, total_labor_cost)
    VALUES (${project.id}, null, ${JSON.stringify(plan)}::jsonb, ${plan.total_labor_cost})
    RETURNING id
  `;

  const totals = estimateTotals({
    items: generated.items,
    labor: plan,
    overhead_pct: 0.12,
    profit_pct: 0.15,
    tax_pct: 0.0825,
    tax_mode: 'materials_only'
  });

  await sql`
    INSERT INTO estimates (
      project_id, takeoff_id, labor_plan_id, overhead_pct, profit_pct, tax_pct,
      subtotal_materials, subtotal_labor, overhead_amount, profit_amount, tax_amount, grand_total, status
    ) VALUES (
      ${project.id}, ${takeoff.id}, ${labor.id}, 0.12, 0.15, 0.0825,
      ${totals.subtotal_materials}, ${totals.subtotal_labor}, ${totals.overhead_amount},
      ${totals.profit_amount}, ${totals.tax_amount}, ${totals.grand_total}, 'draft'
    )
  `;
}

async function main() {
  for (const template of DEFAULT_LABOR_TEMPLATES) {
    await upsertTemplate(template.name, template.rates_json, template.production_json);
  }

  await seedProject('Seed Deck Project', 'deck', {
    deck_length_ft: 20,
    deck_width_ft: 14,
    deck_height_ft: 5,
    decking_material: 'wood',
    decking_board_width_in: 5.5,
    joist_spacing_in: 16,
    ledger: true,
    beam_count: 1,
    post_size: '6x6',
    post_spacing_ft: 6,
    stair_count: 1,
    stair_width_ft: 3,
    railing_type: 'aluminum',
    railing_sides: 'all',
    custom_railing_lf: null,
    is_covered: false
  });

  await seedProject('Seed Covered Deck Project', 'covered_deck', {
    deck_length_ft: 24,
    deck_width_ft: 14,
    deck_height_ft: 6,
    decking_material: 'composite',
    decking_board_width_in: 5.5,
    joist_spacing_in: 16,
    ledger: true,
    beam_count: 2,
    post_size: '6x6',
    post_spacing_ft: 6,
    stair_count: 1,
    stair_width_ft: 4,
    railing_type: 'cable',
    railing_sides: 'all',
    custom_railing_lf: null,
    is_covered: true,
    roof_type: 'gable',
    roof_length_ft: 24,
    roof_width_ft: 14,
    rafter_spacing_in: 16,
    roofing_material: 'metal',
    ceiling_finish: 'tongue_groove',
    cover_post_count: 6,
    cover_beam_size: 'LVL 1.75x14'
  });

  await seedProject('Seed Fence Project', 'fence', {
    design_mode: 'fence',
    deck_length_ft: 0,
    deck_width_ft: 0,
    deck_height_ft: 0,
    decking_material: 'wood',
    decking_board_width_in: 5.5,
    joist_spacing_in: 16,
    ledger: false,
    beam_count: 1,
    post_size: '6x6',
    post_spacing_ft: 6,
    stair_count: 0,
    stair_width_ft: 3,
    railing_type: 'none',
    railing_sides: 'all',
    custom_railing_lf: null,
    is_covered: false,
    shape_mode: 'rectangle',
    deck_polygon_points: [],
    deck_area_override_sqft: null,
    deck_perimeter_override_lf: null,
    fence_length_ft: 120,
    fence_height_ft: 6,
    fence_material: 'wood',
    fence_style: 'privacy',
    fence_post_spacing_ft: 8,
    fence_rail_count: 2,
    fence_picket_width_in: 5.5,
    fence_picket_gap_in: 0.5,
    fence_gate_count: 1,
    fence_gate_width_ft: 4
  });
}

main()
  .then(() => {
    console.log('Seed complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
