import type { APIRoute } from 'astro';
import { createOrReplaceLaborPlan, createProjectActivity, getProject, latestDesignInputs, latestTakeoff, listLaborTemplates } from '@/lib/db/repo';
import { DEFAULT_LABOR_TEMPLATES, generateLaborPlan } from '@/lib/engines/labor';
import { designInputsSchema } from '@/lib/types/schemas';
import { requireProjectEditAccess, requireUserId } from '@/lib/utils/auth';
import { ok } from '@/lib/utils/http';
import { parseJsonObject } from '@/lib/utils/json';
import type { TakeoffResult } from '@/lib/types/domain';

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.projectId as string;
  const editGuard = await requireProjectEditAccess(context, userId, projectId);
  if (editGuard) return editGuard;
  const rawBody = await context.request.json().catch(() => ({}));
  const body = parseJsonObject<{ template_id?: string; include_demo?: boolean }>(rawBody, {});

  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const inputs = await latestDesignInputs(projectId);
  const takeoff = await latestTakeoff(projectId);
  if (!inputs || !takeoff) return new Response('Missing inputs/takeoff', { status: 400 });

  const templates = await listLaborTemplates(userId);
  const template = templates.find((t: any) => t.id === body.template_id) ?? templates[0] ?? DEFAULT_LABOR_TEMPLATES[0];

  const parsedInputs = parseJsonObject(inputs.inputs_json, {});
  const normalized = designInputsSchema.safeParse(parsedInputs);
  if (!normalized.success) {
    return new Response('Invalid design inputs for labor generation', { status: 400 });
  }

  const normalizedTakeoff: TakeoffResult = {
    assumptions: parseJsonObject((takeoff as any).assumptions ?? (takeoff as any).assumptions_json, { formulas: {}, constants: {} } as any),
    totals: parseJsonObject((takeoff as any).totals ?? (takeoff as any).totals_json, {
      deck_sqft: 0,
      materials_subtotal: 0,
      item_count: 0
    }),
    items: Array.isArray((takeoff as any).items) ? (takeoff as any).items : []
  };

  const plan = generateLaborPlan(normalized.data, normalizedTakeoff, template as any, {
    includeDemo: Boolean(body.include_demo)
  });

  const row = await createOrReplaceLaborPlan(projectId, template.id ?? null, plan, plan.total_labor_cost);
  await createProjectActivity({
    projectId,
    actor: project.user_id === userId ? 'owner' : 'collaborator',
    actorRef: userId,
    eventKey: 'labor_generated',
    eventJson: {
      template: template.name,
      total_hours: plan.total_hours,
      total_labor_cost: plan.total_labor_cost
    }
  });
  return ok({ ...plan, id: row.id });
};
