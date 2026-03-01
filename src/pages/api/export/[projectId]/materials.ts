import type { APIRoute } from 'astro';
import { createDocument, createProjectActivity, getProject, latestDesignInputs, latestTakeoff } from '@/lib/db/repo';
import { buildPdf, storePdf } from '@/lib/pdf/exporter';
import { requireProjectEditAccess, requireUserId } from '@/lib/utils/auth';
import { parseJsonObject } from '@/lib/utils/json';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.projectId as string;
  const editGuard = await requireProjectEditAccess(context, userId, projectId);
  if (editGuard) return editGuard;

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
    const doc = await createDocument(projectId, 'materials_pdf', storagePath);
    await createProjectActivity({
      projectId,
      actor: project.user_id === userId ? 'owner' : 'collaborator',
      actorRef: userId,
      eventKey: 'materials_pdf_generated',
      eventJson: { document_id: doc.id }
    });

    return context.redirect(`/projects/${projectId}/export?ok=materials`);
  } catch {
    return context.redirect(`/projects/${projectId}/export?error=materials_export_failed`);
  }
};
