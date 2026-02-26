import type { APIRoute } from 'astro';
import { getProject, upsertProjectAssumptions } from '@/lib/db/repo';
import { requireUserId } from '@/lib/utils/auth';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const form = await context.request.formData();
  const parse = (key: string, fallback: number) => {
    const raw = form.get(key)?.toString();
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  await upsertProjectAssumptions(projectId, userId, {
    max_joist_span_ft: parse('max_joist_span_ft', 10),
    composite_joist_spacing_in: parse('composite_joist_spacing_in', 12),
    railing_post_spacing_ft: parse('railing_post_spacing_ft', 6),
    beam_double_ply_length_ft: parse('beam_double_ply_length_ft', 14),
    beam_triple_ply_length_ft: parse('beam_triple_ply_length_ft', 24)
  });

  return context.redirect(`/projects/${projectId}/takeoff?saved=${Date.now()}`, 303);
};
