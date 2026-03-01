import type { APIRoute } from 'astro';
import { createProjectActivity, createTakeoff, getProject, getProjectAssumptions, latestDesignInputs } from '@/lib/db/repo';
import { generateTakeoff } from '@/lib/engines/takeoff';
import { designInputsSchema } from '@/lib/types/schemas';
import { requireProjectEditAccess, requireUserId } from '@/lib/utils/auth';
import { parseJsonObject } from '@/lib/utils/json';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.projectId as string;
  const editGuard = await requireProjectEditAccess(context, userId, projectId);
  if (editGuard) return editGuard;

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const inputs = await latestDesignInputs(projectId);
  if (!inputs) return new Response('No design inputs', { status: 400 });

  const parsedInputs = parseJsonObject(inputs.inputs_json, {});
  const normalized = designInputsSchema.safeParse(parsedInputs);
  if (!normalized.success) {
    return new Response('Invalid design inputs for takeoff generation', { status: 400 });
  }
  const overrides = await getProjectAssumptions(projectId);
  const generated = generateTakeoff(normalized.data, overrides ?? undefined);
  const row = await createTakeoff(projectId, userId, generated);
  await createProjectActivity({
    projectId,
    actor: project.user_id === userId ? 'owner' : 'collaborator',
    actorRef: userId,
    eventKey: 'takeoff_generated',
    eventJson: {
      version: row.version,
      item_count: generated.items.length,
      deck_sqft: generated.totals.deck_sqft
    }
  });
  return context.redirect(`/projects/${projectId}/takeoff`);
};
