import type { APIRoute } from 'astro';
import { createProjectImage, getProject } from '@/lib/db/repo';
import { storeProjectImage } from '@/lib/media';
import { requireUserId } from '@/lib/utils/auth';
import { sanitizeFileName } from '@/lib/utils/file';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const form = await context.request.formData();
  const file = form.get('image');
  const caption = form.get('caption')?.toString().trim() || null;

  if (!(file instanceof File)) return new Response('Missing file', { status: 400 });
  if (!ALLOWED.has(file.type)) return new Response('Unsupported file type', { status: 400 });
  if (file.size > 10 * 1024 * 1024) return new Response('File too large (max 10MB)', { status: 400 });

  const safeName = sanitizeFileName(file.name || 'upload');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const storagePath = `projects/${projectId}/images/${Date.now()}-${safeName}`;

  await storeProjectImage(storagePath, bytes, file.type);
  await createProjectImage({
    projectId,
    uploadedBy: userId,
    storagePath,
    fileName: safeName,
    mimeType: file.type,
    sizeBytes: file.size,
    caption
  });

  return context.redirect(`/projects/${projectId}/media`);
};
