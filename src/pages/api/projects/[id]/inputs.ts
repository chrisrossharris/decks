import type { APIRoute } from 'astro';
import { createDesignInputs, createProjectActivity, getProject, getProjectAssumptions, upsertProjectAssumptions } from '@/lib/db/repo';
import { validateCoveredPackage } from '@/lib/engines/covered';
import { designInputsSchema } from '@/lib/types/schemas';
import { requireProjectEditAccess, requireUserId } from '@/lib/utils/auth';
import { badRequest, ok } from '@/lib/utils/http';
import { parseJsonObject } from '@/lib/utils/json';
import { apiLog } from '@/lib/utils/log';

export const POST: APIRoute = async (context) => {
  try {
    const userId = requireUserId(context);
    const projectId = context.params.id as string;
    const editGuard = await requireProjectEditAccess(context, userId, projectId);
    if (editGuard) return editGuard;

    const project = await getProject(userId, projectId);
    if (!project) return badRequest('Project not found', 404);

    const raw = await context.request.json().catch(() => ({}));
    const json = parseJsonObject(raw, {});
    const requireCompleteCoveredPackageRaw = json.require_complete_covered_package;
    const parsed = designInputsSchema.safeParse(json);
    if (!parsed.success) return badRequest(parsed.error.message);

    const existingAssumptions = (await getProjectAssumptions(projectId)) ?? {};
    const requireCompleteCoveredPackage = typeof requireCompleteCoveredPackageRaw === 'boolean'
      ? requireCompleteCoveredPackageRaw
      : Boolean((existingAssumptions as any).require_complete_covered_package ?? false);

    if (requireCompleteCoveredPackage && parsed.data.design_mode !== 'fence' && parsed.data.is_covered) {
      const validation = validateCoveredPackage(parsed.data);
      if (!validation.ready) {
        return badRequest(`Covered package required before continue. Missing: ${validation.missing.join(', ')}`);
      }
    }

    const row = await createDesignInputs(projectId, userId, parsed.data);
    await upsertProjectAssumptions(projectId, userId, {
      require_complete_covered_package: requireCompleteCoveredPackage
    });
    await createProjectActivity({
      projectId,
      actor: project.user_id === userId ? 'owner' : 'collaborator',
      actorRef: userId,
      eventKey: 'design_inputs_saved',
      eventJson: {
        version: row.version,
        design_mode: parsed.data.design_mode ?? 'deck',
        is_covered: parsed.data.is_covered
      }
    });
    apiLog(context, 'info', 'design_inputs_saved', { project_id: projectId, version: row.version });
    return ok(row, 201);
  } catch (error) {
    apiLog(context, 'error', 'design_inputs_save_failed', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
};
