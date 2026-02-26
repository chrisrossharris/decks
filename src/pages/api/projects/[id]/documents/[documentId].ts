import type { APIRoute } from 'astro';
import { getProject, getProjectDocument } from '@/lib/db/repo';
import { readPdf } from '@/lib/pdf/exporter';
import { requireUserId } from '@/lib/utils/auth';

export const GET: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;
  const documentId = context.params.documentId as string;

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const document = await getProjectDocument(projectId, documentId);
  if (!document) return new Response('Document not found', { status: 404 });

  const bytes = await readPdf(document.storage_path as string);
  if (!bytes) return new Response('PDF blob missing', { status: 404 });

  const filename = `${String(document.kind).replace(/[^a-z0-9_-]/gi, '_')}-${projectId}.pdf`;
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0, must-revalidate'
    }
  });
};
