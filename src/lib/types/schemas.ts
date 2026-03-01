import { z } from 'zod';

const optionalPositive = z.preprocess((value) => {
  if (value === '' || value === undefined || value === null) return undefined;
  return Number(value);
}, z.number().positive().optional().nullable());

const optionalNonNegative = z.preprocess((value) => {
  if (value === '' || value === undefined || value === null) return undefined;
  return Number(value);
}, z.number().nonnegative().optional().nullable());

const spacingInSchema = z.preprocess((value) => Number(value), z.union([z.literal(12), z.literal(16), z.literal(24)]));

export const designInputsSchema = z.object({
  design_mode: z.enum(['deck', 'fence']).default('deck'),
  deck_length_ft: z.coerce.number().nonnegative().default(0),
  deck_width_ft: z.coerce.number().nonnegative().default(0),
  deck_height_ft: z.coerce.number().nonnegative(),
  decking_material: z.enum(['wood', 'composite']),
  decking_board_width_in: z.coerce.number().positive().default(5.5),
  joist_spacing_in: spacingInSchema.default(16),
  ledger: z.coerce.boolean().default(true),
  ledger_side: z.enum(['top', 'right', 'bottom', 'left']).default('top'),
  beam_count: z.coerce.number().int().min(1).default(1),
  post_size: z.enum(['4x4', '6x6']).default('6x6'),
  post_spacing_ft: z.coerce.number().positive().default(6),
  stair_count: z.coerce.number().int().min(0).default(0),
  stair_width_ft: z.coerce.number().positive().default(4),
  railing_type: z.enum(['none', 'wood', 'aluminum', 'cable']).default('wood'),
  railing_sides: z.enum(['all', '3_sides', 'custom']).default('all'),
  custom_railing_lf: optionalPositive,
  is_covered: z.coerce.boolean().default(false),
  roof_type: z.enum(['shed', 'gable']).optional(),
  roof_pitch: z.enum(['2:12', '3:12', '4:12', '5:12', '6:12', '8:12', '10:12', '12:12']).optional().default('4:12'),
  roof_length_ft: optionalPositive,
  roof_width_ft: optionalPositive,
  rafter_spacing_in: spacingInSchema.optional().default(16),
  roofing_material: z.enum(['shingle', 'metal']).optional(),
  roofing_product_type: z.string().max(80).optional(),
  roofing_color: z.string().max(60).optional(),
  ceiling_finish: z.enum(['none', 'drywall', 'tongue_groove', 'beadboard']).optional().default('none'),
  ceiling_fan_plate_count: z.coerce.number().int().min(0).optional().default(0),
  cover_post_count: z.preprocess((value) => {
    if (value === '' || value === undefined || value === null) return undefined;
    return Number(value);
  }, z.number().int().min(0).optional()),
  cover_beam_size: z.string().max(120).optional(),
  shape_mode: z.enum(['rectangle', 'polygon']).default('rectangle'),
  deck_polygon_points: z.array(z.object({ x: z.number(), y: z.number() })).optional().default([]),
  ledger_line_index: z.preprocess((value) => {
    if (value === '' || value === undefined || value === null) return undefined;
    return Number(value);
  }, z.number().int().min(0).optional().nullable()),
  deck_area_override_sqft: optionalPositive,
  deck_perimeter_override_lf: optionalPositive,
  fence_length_ft: optionalNonNegative.default(0),
  fence_height_ft: optionalNonNegative.default(0),
  fence_material: z.enum(['wood', 'vinyl', 'metal']).optional().default('wood'),
  fence_style: z.enum(['privacy', 'picket', 'panel']).optional().default('privacy'),
  fence_layout: z.enum(['straight', 'corner', 'u_shape']).optional().default('straight'),
  fence_side_a_ft: optionalNonNegative.default(null),
  fence_side_b_ft: optionalNonNegative.default(null),
  fence_side_c_ft: optionalNonNegative.default(null),
  fence_post_spacing_ft: z.coerce.number().positive().optional().default(8),
  fence_rail_count: z.coerce.number().int().min(1).optional().default(2),
  fence_picket_width_in: z.coerce.number().positive().optional().default(5.5),
  fence_picket_gap_in: z.coerce.number().min(0).optional().default(0.5),
  fence_gate_count: z.coerce.number().int().min(0).optional().default(0),
  fence_gate_width_ft: z.coerce.number().positive().optional().default(4)
}).transform((data) => {
  if (data.design_mode === 'deck' && data.decking_material === 'composite') {
    return {
      ...data,
      joist_spacing_in: 12 as const
    };
  }
  return data;
});

export const createProjectSchema = z.object({
  name: z.string().min(2).max(120),
  type: z.enum(['deck', 'covered_deck', 'fence']),
  address: z.string().max(220).optional().default(''),
  status: z.enum(['draft', 'estimating', 'sent', 'won', 'lost']).default('draft')
});

export const estimateSettingsSchema = z.object({
  overhead_pct: z.coerce.number().min(0).max(1),
  profit_pct: z.coerce.number().min(0).max(1),
  tax_pct: z.coerce.number().min(0).max(1),
  tax_mode: z.enum(['materials_only', 'grand_total']).default('materials_only')
});
