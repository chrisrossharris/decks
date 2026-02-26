import type { APIRoute } from 'astro';
import { getProject, getProjectImage } from '@/lib/db/repo';
import { readProjectImage } from '@/lib/media';
import { requireUserId } from '@/lib/utils/auth';

export const GET: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;
  const imageId = context.params.imageId as string;

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const image = await getProjectImage(projectId, imageId);
  if (!image) return new Response('Image not found', { status: 404 });

  const data = await readProjectImage(image.storage_path);
  if (!data) return new Response('Image blob missing', { status: 404 });

  return new Response(data, {
    headers: {
      'content-type': image.mime_type,
      'cache-control': 'private, max-age=3600'
    }
  });
};
