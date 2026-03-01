import type { APIRoute } from 'astro';
import { createProjectActivity, getProject, getProjectAssumptions, upsertProjectAssumptions } from '@/lib/db/repo';
import { requireProjectEditAccess, requireUserId } from '@/lib/utils/auth';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;
  const editGuard = await requireProjectEditAccess(context, userId, projectId);
  if (editGuard) return editGuard;

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const form = await context.request.formData();
  const parse = (key: string, fallback: number) => {
    const raw = form.get(key)?.toString();
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };

  const existing = (await getProjectAssumptions(projectId)) ?? {};
  const rawToggle = form.get('require_complete_covered_package')?.toString();
  const requireCompleteCoveredPackage = rawToggle == null
    ? Boolean((existing as any).require_complete_covered_package ?? false)
    : rawToggle === 'true' || rawToggle === '1' || rawToggle === 'on';

  await upsertProjectAssumptions(projectId, userId, {
    max_joist_span_ft: parse('max_joist_span_ft', 10),
    composite_joist_spacing_in: parse('composite_joist_spacing_in', 12),
    railing_post_spacing_ft: parse('railing_post_spacing_ft', 6),
    beam_double_ply_length_ft: parse('beam_double_ply_length_ft', 14),
    beam_triple_ply_length_ft: parse('beam_triple_ply_length_ft', 24),
    require_complete_covered_package: requireCompleteCoveredPackage,
    fence_post_spacing_ft: parse('fence_post_spacing_ft', 8),
    fence_rail_count: parse('fence_rail_count', 2),
    fence_bags_per_post: parse('fence_bags_per_post', 2),
    fence_hardware_kit_lf: parse('fence_hardware_kit_lf', 50)
  });

  await createProjectActivity({
    projectId,
    actor: project.user_id === userId ? 'owner' : 'collaborator',
    actorRef: userId,
    eventKey: 'assumptions_saved',
    eventJson: { require_complete_covered_package: requireCompleteCoveredPackage }
  });

  return context.redirect(`/projects/${projectId}/takeoff?saved=${Date.now()}`, 303);
};
