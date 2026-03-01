export type ProjectType = 'deck' | 'covered_deck' | 'fence';
export type ProjectStatus = 'draft' | 'estimating' | 'sent' | 'won' | 'lost';
export type Unit = 'ea' | 'lf' | 'sqft' | 'yd' | 'bag' | 'box';

export type DeckingMaterial = 'wood' | 'composite';
export type RailingType = 'none' | 'wood' | 'aluminum' | 'cable';
export type RailingSides = 'all' | '3_sides' | 'custom';
export type LedgerSide = 'top' | 'right' | 'bottom' | 'left';
export type RoofType = 'shed' | 'gable';
export type RoofingMaterial = 'shingle' | 'metal';
export type RoofPitch = '2:12' | '3:12' | '4:12' | '5:12' | '6:12' | '8:12' | '10:12' | '12:12';
export type CeilingFinish = 'none' | 'drywall' | 'tongue_groove' | 'beadboard';

export interface DesignInputs {
  design_mode?: 'deck' | 'fence';
  deck_length_ft: number;
  deck_width_ft: number;
  deck_height_ft: number;
  decking_material: DeckingMaterial;
  decking_board_width_in: number;
  joist_spacing_in: 12 | 16 | 24;
  ledger: boolean;
  ledger_side?: LedgerSide;
  beam_count: number;
  post_size: '4x4' | '6x6';
  post_spacing_ft: number;
  stair_count: number;
  stair_width_ft: number;
  railing_type: RailingType;
  railing_sides: RailingSides;
  custom_railing_lf?: number | null;
  is_covered: boolean;
  roof_type?: RoofType;
  roof_pitch?: RoofPitch;
  roof_length_ft?: number;
  roof_width_ft?: number;
  rafter_spacing_in?: 12 | 16 | 24;
  roofing_material?: RoofingMaterial;
  roofing_product_type?: string;
  roofing_color?: string;
  ceiling_finish?: CeilingFinish;
  ceiling_fan_plate_count?: number;
  cover_post_count?: number;
  cover_beam_size?: string;
  shape_mode?: 'rectangle' | 'polygon';
  deck_polygon_points?: Array<{ x: number; y: number }>;
  ledger_line_index?: number | null;
  deck_area_override_sqft?: number | null;
  deck_perimeter_override_lf?: number | null;
  fence_length_ft?: number;
  fence_height_ft?: number;
  fence_material?: 'wood' | 'vinyl' | 'metal';
  fence_style?: 'privacy' | 'picket' | 'panel';
  fence_layout?: 'straight' | 'corner' | 'u_shape';
  fence_side_a_ft?: number | null;
  fence_side_b_ft?: number | null;
  fence_side_c_ft?: number | null;
  fence_post_spacing_ft?: number;
  fence_rail_count?: number;
  fence_picket_width_in?: number;
  fence_picket_gap_in?: number;
  fence_gate_count?: number;
  fence_gate_width_ft?: number;
}

export interface TakeoffAssumptions {
  joist_material: string;
  bags_per_footing: number;
  screws_per_100_sqft: number;
  formulas: Record<string, string>;
  constants: Record<string, string | number | boolean>;
}

export interface TakeoffItem {
  category: string;
  sku?: string | null;
  name: string;
  unit: Unit;
  qty: number;
  waste_factor: number;
  unit_cost: number;
  vendor?: string | null;
  lead_time_days: number;
  notes?: string | null;
  is_allowance?: boolean;
}

export interface TakeoffTotals {
  deck_sqft: number;
  materials_subtotal: number;
  item_count: number;
}

export interface TakeoffResult {
  assumptions: TakeoffAssumptions;
  items: TakeoffItem[];
  totals: TakeoffTotals;
}

export interface TakeoffAssumptionOverrides {
  max_joist_span_ft?: number;
  composite_joist_spacing_in?: number;
  railing_post_spacing_ft?: number;
  beam_double_ply_length_ft?: number;
  beam_triple_ply_length_ft?: number;
  require_complete_covered_package?: boolean;
  fence_post_spacing_ft?: number;
  fence_rail_count?: number;
  fence_bags_per_post?: number;
  fence_hardware_kit_lf?: number;
}

export interface LaborTask {
  key: string;
  task: string;
  quantity_driver: string;
  quantity: number;
  hours: number;
  rate: number;
  cost: number;
  overridden?: boolean;
}

export interface LaborTemplate {
  id?: string;
  name: string;
  rates_json: {
    base_rate: number;
    burden_pct?: number;
  };
  production_json: {
    framing_hrs_per_sqft: number;
    decking_hrs_per_sqft: number;
    railing_hrs_per_lf: number;
    stairs_hrs_each: number;
    cover_hrs_per_sqft: number;
    footings_hrs_each: number;
    demo_hrs: number;
    fence_layout_hrs_per_lf?: number;
    fence_rails_hrs_per_lf?: number;
    fence_pickets_hrs_per_lf?: number;
    fence_gate_hrs_each?: number;
  };
}

export interface LaborPlanResult {
  tasks: LaborTask[];
  total_hours: number;
  total_labor_cost: number;
}
