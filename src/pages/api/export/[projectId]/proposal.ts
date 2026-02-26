import type { APIRoute } from 'astro';
import { createDocument, getProject, latestEstimate, latestLaborPlan, latestTakeoff } from '@/lib/db/repo';
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

    if (!project) return context.redirect(`/projects/${projectId}/export?error=missing_project`);

    const fallbackEstimate =
      labor && takeoff
        ? (() => {
            const laborJson = parseJsonObject(labor.labor_json, { tasks: [], total_hours: 0, total_labor_cost: 0 });
            return {
              overhead_pct: 0.12,
              profit_pct: 0.15,
              tax_pct: 0.0825,
              ...estimateTotals({
                items: Array.isArray(takeoff.items) ? takeoff.items : [],
                labor: {
                  tasks: Array.isArray((laborJson as any).tasks) ? (laborJson as any).tasks : [],
                  total_hours: Number((laborJson as any).total_hours ?? 0),
                  total_labor_cost: Number((laborJson as any).total_labor_cost ?? 0)
                } as any,
                overhead_pct: 0.12,
                profit_pct: 0.15,
                tax_pct: 0.0825,
                tax_mode: 'materials_only'
              })
            };
          })()
        : null;

    const proposalEstimate = estimate ?? fallbackEstimate;
    if (!proposalEstimate) return context.redirect(`/projects/${projectId}/export?error=missing_proposal_records`);

    const pdf = await buildPdf('proposal', { project, estimate: proposalEstimate });
    const storagePath = `projects/${projectId}/proposal-${Date.now()}.pdf`;
    await storePdf(storagePath, pdf);
    await createDocument(projectId, 'client_proposal_pdf', storagePath);
    return context.redirect(`/projects/${projectId}/export?ok=proposal`);
  } catch {
    return context.redirect(`/projects/${projectId}/export?error=proposal_export_failed`);
  }
};
