import type { APIRoute } from 'astro';
import { getProjectImage, resolveShareToken } from '@/lib/db/repo';
import { readProjectImage } from '@/lib/media';

export const GET: APIRoute = async (context) => {
  const token = context.params.token as string;
  const imageId = context.params.imageId as string;

  const share = await resolveShareToken(token);
  if (!share) return new Response('Invalid link', { status: 404 });

  const image = await getProjectImage(share.project_id, imageId);
  if (!image) return new Response('Image not found', { status: 404 });

  const blob = await readProjectImage(image.storage_path);
  if (!blob) return new Response('Image missing', { status: 404 });

  return new Response(blob, {
    headers: {
      'content-type': image.mime_type,
      'cache-control': 'public, max-age=3600'
    }
  });
};
