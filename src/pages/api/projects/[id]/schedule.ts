import type { APIRoute } from 'astro';
import { createProjectActivity, getProject, upsertScheduleHandoff } from '@/lib/db/repo';
import { requireUserId } from '@/lib/utils/auth';

function parseDate(value: FormDataEntryValue | null) {
  const raw = value?.toString().trim();
  return raw ? raw : null;
}

export const POST: APIRoute = async (context) => {
  const userId = requireUserId(context);
  const projectId = context.params.id as string;
  const project = await getProject(userId, projectId);
  if (!project) return new Response('Project not found', { status: 404 });

  const form = await context.request.formData();
  const stage = form.get('stage')?.toString() as 'backlog' | 'ready' | 'scheduled' | 'in_progress' | 'done';
  if (!['backlog', 'ready', 'scheduled', 'in_progress', 'done'].includes(stage)) {
    return new Response('Invalid stage', { status: 400 });
  }

  const estimatedDurationRaw = form.get('estimated_duration_days')?.toString().trim() ?? '';
  const estimatedDurationDays = estimatedDurationRaw ? Number(estimatedDurationRaw) : null;
  if (estimatedDurationRaw && (!Number.isFinite(estimatedDurationDays) || estimatedDurationDays <= 0)) {
    return new Response('Invalid duration', { status: 400 });
  }

  const row = await upsertScheduleHandoff({
    projectId,
    stage,
    preferredStartDate: parseDate(form.get('preferred_start_date')),
    scheduledStartDate: parseDate(form.get('scheduled_start_date')),
    targetCompletionDate: parseDate(form.get('target_completion_date')),
    estimatedDurationDays,
    assignedLead: form.get('assigned_lead')?.toString().trim() || null,
    notes: form.get('notes')?.toString().trim() || null
  });

  await createProjectActivity({
    projectId,
    actor: 'owner',
    actorRef: userId,
    eventKey: 'schedule_handoff_updated',
    eventJson: { stage: row.stage }
  });

  return context.redirect(`/projects/${projectId}/schedule`);
};
