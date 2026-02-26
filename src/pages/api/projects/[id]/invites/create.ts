import type { APIRoute } from 'astro';
import { createProjectInvite, getProject, isProjectOwner } from '@/lib/db/repo';
import { requireUserId } from '@/lib/utils/auth';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const owner = await isProjectOwner(userId, projectId);
  if (!owner) return new Response('Only owner can invite collaborators', { status: 403 });

  const form = await context.request.formData();
  const invitedEmail = form.get('invited_email')?.toString().trim().toLowerCase();
  const role = form.get('role')?.toString().trim() || 'partner';
  if (!invitedEmail) return new Response('Missing invited email', { status: 400 });

  await createProjectInvite({ projectId, invitedBy: userId, invitedEmail, role });
  return context.redirect(`/projects/${projectId}/collaborators`);
};
