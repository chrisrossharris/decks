import type { APIRoute } from 'astro';
import { processNotificationQueue } from '@/lib/notifications/queue';
import { requireUserId } from '@/lib/utils/auth';

export const POST: APIRoute = async (context) => {
  requireUserId(context);
  const result = await processNotificationQueue(50);
  const params = new URLSearchParams({
    processed: String(result.processed),
    sent: String(result.sent),
    retried: String(result.retried),
    failed: String(result.failed)
  });
  return context.redirect(`/account?queue=done&${params.toString()}`);
};
