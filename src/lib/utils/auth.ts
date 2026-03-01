import type { APIContext } from 'astro';
import { canEditProject } from '@/lib/db/repo';

export function requireUserId(context: APIContext): string {
  const userId = context.locals.auth?.().userId;
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}

export async function requireProjectEditAccess(context: APIContext, userId: string, projectId: string) {
  const allowed = await canEditProject(userId, projectId);
  if (!allowed) {
    return new Response('Forbidden', { status: 403 });
  }
  return null;
}
