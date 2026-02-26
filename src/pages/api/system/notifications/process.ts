import type { APIRoute } from 'astro';
import { processNotificationQueue } from '@/lib/notifications/queue';
import { ok } from '@/lib/utils/http';

export const POST: APIRoute = async (context) => {
  const secret = import.meta.env.NOTIFICATION_CRON_SECRET;
  const provided = context.request.headers.get('x-cron-secret') ?? context.url.searchParams.get('secret');

  if (!secret || provided !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await processNotificationQueue(25);
  return ok(result);
};
