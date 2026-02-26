import type { APIRoute } from 'astro';
import { createDocument, getProject, latestDesignInputs, latestTakeoff } from '@/lib/db/repo';
import { buildPdf, storePdf } from '@/lib/pdf/exporter';
import { requireUserId } from '@/lib/utils/auth';
import { parseJsonObject } from '@/lib/utils/json';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.projectId as string;

  try {
    const project = await getProject(userId, projectId);
    const takeoff = await latestTakeoff(projectId);
    const inputs = await latestDesignInputs(projectId);
    if (!project || !takeoff) return context.redirect(`/projects/${projectId}/export?error=missing_project_or_takeoff`);
    const normalizedInputs = parseJsonObject(inputs?.inputs_json, {});

    const pdf = await buildPdf('materials', {
      project,
      items: takeoff.items,
      inputs: {
        ...normalizedInputs,
        takeoff_assumptions_json: takeoff.assumptions_json
      }
    });
    const storagePath = `projects/${projectId}/materials-${Date.now()}.pdf`;
    await storePdf(storagePath, pdf);
    await createDocument(projectId, 'materials_pdf', storagePath);

    return context.redirect(`/projects/${projectId}/export?ok=materials`);
  } catch {
    return context.redirect(`/projects/${projectId}/export?error=materials_export_failed`);
  }
};
