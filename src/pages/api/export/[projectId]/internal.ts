import type { APIRoute } from 'astro';
import { createDocument, getProject, latestDesignInputs, latestEstimate, latestLaborPlan, latestTakeoff } from '@/lib/db/repo';
import { buildPdf, storePdf } from '@/lib/pdf/exporter';
import { estimateTotals } from '@/lib/engines/estimate';
import { requireUserId } from '@/lib/utils/auth';
import { parseJsonObject } from '@/lib/utils/json';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.projectId as string;

  try {
    const project = await getProject(userId, projectId);
    const estimate = await latestEstimate(projectId);
    const labor = await latestLaborPlan(projectId);
    const takeoff = await latestTakeoff(projectId);
    const inputs = await latestDesignInputs(projectId);

    if (!project || !labor || !takeoff) return context.redirect(`/projects/${projectId}/export?error=missing_internal_records`);

    const laborJson = parseJsonObject(labor.labor_json, { tasks: [], total_hours: 0, total_labor_cost: 0 });
    const normalizedLabor = {
      tasks: Array.isArray((laborJson as any).tasks) ? (laborJson as any).tasks : [],
      total_hours: Number((laborJson as any).total_hours ?? 0),
      total_labor_cost: Number((laborJson as any).total_labor_cost ?? 0)
    };

    const computedEstimate = estimate
      ? estimate
      : {
          overhead_pct: 0.12,
          profit_pct: 0.15,
          tax_pct: 0.0825,
          ...estimateTotals({
            items: Array.isArray(takeoff.items) ? takeoff.items : [],
            labor: normalizedLabor as any,
            overhead_pct: 0.12,
            profit_pct: 0.15,
            tax_pct: 0.0825,
            tax_mode: 'materials_only'
          })
        };

    const pdf = await buildPdf('internal', {
      project,
      estimate: computedEstimate,
      labor: normalizedLabor,
      items: takeoff.items,
      inputs: parseJsonObject(inputs?.inputs_json, {})
    });

    const storagePath = `projects/${projectId}/internal-${Date.now()}.pdf`;
    await storePdf(storagePath, pdf);
    await createDocument(projectId, 'internal_estimate_pdf', storagePath);
    return context.redirect(`/projects/${projectId}/export?ok=internal`);
  } catch {
    return context.redirect(`/projects/${projectId}/export?error=internal_export_failed`);
  }
};
