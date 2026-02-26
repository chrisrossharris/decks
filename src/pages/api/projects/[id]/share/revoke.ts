import type { APIRoute } from 'astro';
import { deactivateProjectShareLink, getProject } from '@/lib/db/repo';
import { requireUserId } from '@/lib/utils/auth';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;
  const form = await context.request.formData();
  const linkId = form.get('link_id')?.toString();

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });
  if (!linkId) return new Response('Missing link id', { status: 400 });

  await deactivateProjectShareLink(projectId, linkId);
  return context.redirect(`/projects/${projectId}/share`);
};
