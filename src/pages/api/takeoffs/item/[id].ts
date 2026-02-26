import type { APIRoute } from 'astro';
import { updateTakeoffItemForUser } from '@/lib/db/repo';
import { requireUserId } from '@/lib/utils/auth';
import { ok } from '@/lib/utils/http';

export const PATCH: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const itemId = context.params.id as string;
  const body = await context.request.json();
  const row = await updateTakeoffItemForUser(userId, itemId, body);
  if (!row) return new Response('Not found', { status: 404 });
  return ok(row);
};
