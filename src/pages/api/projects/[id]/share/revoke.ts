import type { APIRoute } from 'astro';
import { createProjectActivity, deactivateProjectShareLink, getProject } from '@/lib/db/repo';
import { requireProjectEditAccess, requireUserId } from '@/lib/utils/auth';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;
  const editGuard = await requireProjectEditAccess(context, userId, projectId);
  if (editGuard) return editGuard;
  const form = await context.request.formData();
  const linkId = form.get('link_id')?.toString();

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });
  if (!linkId) return new Response('Missing link id', { status: 400 });

  const row = await deactivateProjectShareLink(projectId, linkId);
  if (row) {
    await createProjectActivity({
      projectId,
      actor: project.user_id === userId ? 'owner' : 'collaborator',
      actorRef: userId,
      eventKey: 'share_link_revoked',
      eventJson: { link_id: linkId }
    });
  }
  return context.redirect(`/projects/${projectId}/share`);
};
