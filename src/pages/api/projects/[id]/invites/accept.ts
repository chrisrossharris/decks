import type { APIRoute } from 'astro';
import { acceptProjectInvite, getProject } from '@/lib/db/repo';
import { requireUserId } from '@/lib/utils/auth';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;
  const form = await context.request.formData();
  const inviteCode = form.get('invite_code')?.toString().trim();
  if (!inviteCode) return new Response('Missing invite code', { status: 400 });

  const accepted = await acceptProjectInvite({ inviteCode, userId });
  if (!accepted || accepted.project_id !== projectId) {
    return new Response('Invite invalid for this project', { status: 400 });
  }

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Access not granted', { status: 403 });
  return context.redirect(`/projects/${projectId}/inputs`);
};
