import type { APIRoute } from 'astro';
import { getProjectImage, resolveShareToken } from '@/lib/db/repo';
import { readProjectImage } from '@/lib/media';
import { checkRateLimit, getClientIp } from '@/lib/utils/rate-limit';
import { apiLog } from '@/lib/utils/log';

export const GET: APIRoute = async (context) => {
  const token = context.params.token as string;
  const imageId = context.params.imageId as string;
  const ip = getClientIp(context.request);
  const limiter = checkRateLimit({
    key: `review_image:${token}:${ip}`,
    limit: 240,
    windowMs: 60_000
  });
  if (!limiter.allowed) {
    apiLog(context, 'warn', 'rate_limited_review_image', { token, image_id: imageId, ip });
    return new Response('Too many requests', {
      status: 429,
      headers: { 'retry-after': String(limiter.retryAfterSec) }
    });
  }

  const share = await resolveShareToken(token);
  if (!share) return new Response('Invalid link', { status: 404 });

  const image = await getProjectImage(share.project_id, imageId);
  if (!image) return new Response('Image not found', { status: 404 });

  const blob = await readProjectImage(image.storage_path);
  if (!blob) return new Response('Image missing', { status: 404 });

  apiLog(context, 'info', 'review_image_served', {
    token,
    image_id: imageId,
    project_id: share.project_id,
    ip
  });

  return new Response(blob, {
    headers: {
      'content-type': image.mime_type,
      'cache-control': 'public, max-age=3600'
    }
  });
};
