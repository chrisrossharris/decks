import type { APIRoute } from 'astro';
import { db } from '@/lib/db/client';
import { requireUserId } from '@/lib/utils/auth';
import { z } from 'zod';

const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().max(240).optional(),
  status: z.enum(['draft', 'estimating', 'sent', 'won', 'lost']).optional()
});

export const PATCH: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const id = context.params.id as string;
  const body = await context.request.json().catch(() => ({}));
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) return new Response('Invalid project update', { status: 400 });
  const payload = parsed.data;

  const [row] = await db()`
    UPDATE projects
    SET name = COALESCE(${payload.name ?? null}, name),
        address = COALESCE(${payload.address ?? null}, address),
        status = COALESCE(${payload.status ?? null}, status),
        updated_at = now()
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING *
  `;

  if (!row) return new Response('Not found', { status: 404 });
  return new Response(JSON.stringify(row), { headers: { 'content-type': 'application/json' } });
};
