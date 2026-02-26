import type { APIRoute } from 'astro';
import { db } from '@/lib/db/client';
import { requireUserId } from '@/lib/utils/auth';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const id = context.params.id as string;

  await db()`DELETE FROM projects WHERE id = ${id} AND user_id = ${userId}`;
  return context.redirect('/projects');
};
