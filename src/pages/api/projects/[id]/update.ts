import type { APIRoute } from 'astro';
import { db } from '@/lib/db/client';
import { requireUserId } from '@/lib/utils/auth';

export const PATCH: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const id = context.params.id as string;
  const body = await context.request.json();

  const [row] = await db()`
    UPDATE projects
    SET name = COALESCE(${body.name ?? null}, name),
        address = COALESCE(${body.address ?? null}, address),
        status = COALESCE(${body.status ?? null}, status),
        updated_at = now()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `;

  if (!row) return new Response('Not found', { status: 404 });
  return new Response(JSON.stringify(row), { headers: { 'content-type': 'application/json' } });
};
