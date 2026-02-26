import type { APIRoute } from 'astro';
import { createTakeoff, getProject, getProjectAssumptions, latestDesignInputs } from '@/lib/db/repo';
import { generateTakeoff } from '@/lib/engines/takeoff';
import { designInputsSchema } from '@/lib/types/schemas';
import { requireUserId } from '@/lib/utils/auth';
import { parseJsonObject } from '@/lib/utils/json';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.projectId as string;

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
  await createTakeoff(projectId, userId, generated);
  return context.redirect(`/projects/${projectId}/takeoff`);
};
