import type { LaborPlanResult, TakeoffItem } from '@/lib/types/domain';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function materialsSubtotal(items: TakeoffItem[]) {
  return round2(
    items.reduce((sum, item) => {
      const qty = Number(item.qty);
      const waste = Number(item.waste_factor);
      const unitCost = Number(item.unit_cost);
      return sum + qty * (1 + waste) * unitCost;
    }, 0)
  );
}

export function estimateTotals(args: {
  items: TakeoffItem[];
  labor: LaborPlanResult;
  overhead_pct: number;
  profit_pct: number;
  tax_pct: number;
  tax_mode: 'materials_only' | 'grand_total';
}) {
  const subtotal_materials = materialsSubtotal(args.items);
  const subtotal_labor = Number(args.labor?.total_labor_cost ?? 0);
  const base = subtotal_materials + subtotal_labor;
  const overhead_amount = round2(base * args.overhead_pct);
  const profit_amount = round2((base + overhead_amount) * args.profit_pct);
  const preTax = base + overhead_amount + profit_amount;
  const taxBase = args.tax_mode === 'materials_only' ? subtotal_materials : preTax;
  const tax_amount = round2(taxBase * args.tax_pct);
  const grand_total = round2(preTax + tax_amount);

  return {
    subtotal_materials,
    subtotal_labor,
    overhead_amount,
    profit_amount,
    tax_amount,
    grand_total
  };
}
