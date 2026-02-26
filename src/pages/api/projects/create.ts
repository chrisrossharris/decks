import type { APIRoute } from 'astro';
import { createProject } from '@/lib/db/repo';
import { createProjectSchema } from '@/lib/types/schemas';
import { requireUserId } from '@/lib/utils/auth';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const form = await context.request.formData();

  const parsed = createProjectSchema.safeParse({
    name: form.get('name'),
    type: form.get('type'),
    address: form.get('address')?.toString() ?? '',
    status: 'draft'
  });

  if (!parsed.success) {
    return new Response('Invalid project', { status: 400 });
  }

  const project = await createProject(userId, parsed.data);
  return context.redirect(`/projects/${project.id}/inputs`);
};
