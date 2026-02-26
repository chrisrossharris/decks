import type { APIRoute } from 'astro';
import { createDesignInputs, getProject } from '@/lib/db/repo';
import { designInputsSchema } from '@/lib/types/schemas';
import { requireUserId } from '@/lib/utils/auth';
import { badRequest, ok } from '@/lib/utils/http';
import { parseJsonObject } from '@/lib/utils/json';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;

  const project = await getProject(userId, projectId);
  if (!project) return badRequest('Project not found', 404);

  const raw = await context.request.json().catch(() => ({}));
  const json = parseJsonObject(raw, {});
  const parsed = designInputsSchema.safeParse(json);
  if (!parsed.success) return badRequest(parsed.error.message);

  const row = await createDesignInputs(projectId, userId, parsed.data);
  return ok(row, 201);
};
