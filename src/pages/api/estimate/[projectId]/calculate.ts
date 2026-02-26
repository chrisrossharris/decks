import type { APIRoute } from 'astro';
import { estimateTotals } from '@/lib/engines/estimate';
import { estimateSettingsSchema } from '@/lib/types/schemas';
import { getProject, latestLaborPlan, latestTakeoff, upsertEstimate } from '@/lib/db/repo';
import { requireUserId } from '@/lib/utils/auth';
import { ok } from '@/lib/utils/http';
import { parseJsonObject } from '@/lib/utils/json';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.projectId as string;

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const rawBody = await context.request.json().catch(() => ({}));
  const parsedBody = parseJsonObject(rawBody, {});
  const payloadResult = estimateSettingsSchema.safeParse(parsedBody);
  if (!payloadResult.success) return new Response('Invalid estimate settings', { status: 400 });
  const payload = payloadResult.data;
  const takeoff = await latestTakeoff(projectId);
  const labor = await latestLaborPlan(projectId);

  if (!takeoff || !labor) return new Response('Missing takeoff/labor', { status: 400 });
  if (!takeoff.id || !labor.id) return new Response('Invalid takeoff/labor ids', { status: 400 });

  const normalizedLabor = parseJsonObject(labor.labor_json, {
    tasks: [],
    total_hours: 0,
    total_labor_cost: 0
  });
  const takeoffItems = Array.isArray(takeoff.items) ? takeoff.items : [];

  const totals = estimateTotals({
    items: takeoffItems,
    labor: {
      tasks: Array.isArray((normalizedLabor as any).tasks) ? (normalizedLabor as any).tasks : [],
      total_hours: Number((normalizedLabor as any).total_hours ?? 0),
      total_labor_cost: Number((normalizedLabor as any).total_labor_cost ?? 0)
    },
    overhead_pct: payload.overhead_pct,
    profit_pct: payload.profit_pct,
    tax_pct: payload.tax_pct,
    tax_mode: payload.tax_mode
  });

  const toFinite = (value: unknown, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  await upsertEstimate(projectId, takeoff.id, labor.id, {
    overhead_pct: toFinite(payload.overhead_pct),
    profit_pct: toFinite(payload.profit_pct),
    tax_pct: toFinite(payload.tax_pct),
    subtotal_materials: toFinite(totals.subtotal_materials),
    subtotal_labor: toFinite(totals.subtotal_labor),
    overhead_amount: toFinite(totals.overhead_amount),
    profit_amount: toFinite(totals.profit_amount),
    tax_amount: toFinite(totals.tax_amount),
    grand_total: toFinite(totals.grand_total)
  });

  return ok(totals);
};
